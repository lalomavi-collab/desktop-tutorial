<#
.SYNOPSIS
Weekly encrypted copy of every Supabase Storage bucket of lalum-app, kept outside Supabase.

.DESCRIPTION
Supabase's database backups do not include Storage files. This script reads every bucket of the
project through the Supabase S3 endpoint and copies it into a new dated snapshot inside an rclone
crypt folder, by default in OneDrive for work (lalum.co). It then compares the snapshot byte for
byte with Supabase, and stores an MD5 manifest and a summary inside the encrypted snapshot.

It never writes to or deletes from Supabase, never deletes anything at the destination and never
overwrites a file there. Secrets are read from Windows Credential Manager and reach rclone only
through environment variables of this process.

Procedure, in Hebrew: docs/infra/storage-offsite-backup.md

.PARAMETER DryRun
Checks the credentials, lists the buckets with their file counts and sizes, and shows where the
snapshot would go. Writes nothing to the destination.

.PARAMETER Register
Registers the weekly scheduled task (Sunday 10:00, current user, only while logged on, and as soon
as possible after a missed start) that runs this script with the same -Destination and
-ExcludeBucket, then exits.

.PARAMETER Unregister
Removes that scheduled task, then exits.

.PARAMETER Destination
Folder or rclone remote path that holds the encrypted backup.
Default: "LALUM offsite backup" inside the OneDrive for work folder.

.PARAMETER ExcludeBucket
Bucket names to skip.

.PARAMETER ProjectRef
Supabase project ref. Default: meoymkcotomoluwlwues (lalum-app).

.PARAMETER Region
Region of the Supabase project. Default: eu-central-1.

.PARAMETER SourceRemote
Advanced: an rclone path to read instead of the Supabase S3 endpoint, for a test against a local
folder. Its top level folders are treated as buckets.

.PARAMETER RclonePath
Full path of rclone.exe when it is not on PATH.

.EXAMPLE
powershell -NoProfile -ExecutionPolicy Bypass -File .\Backup-LalumStorage.ps1 -DryRun

.EXAMPLE
powershell -NoProfile -ExecutionPolicy Bypass -File .\Backup-LalumStorage.ps1

.EXAMPLE
powershell -NoProfile -ExecutionPolicy Bypass -File .\Backup-LalumStorage.ps1 -Register
#>
[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$Register,
    [switch]$Unregister,
    [string]$Destination,
    [string[]]$ExcludeBucket = @(),
    [string]$ProjectRef = 'meoymkcotomoluwlwues',
    [string]$Region = 'eu-central-1',
    [string]$SourceRemote,
    [string]$RclonePath
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'LalumOffsite.psm1') -Force

# -File passes "a,b" as one string, so split it here.
$ExcludeBucket = @($ExcludeBucket | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })

$ScriptVersion = '1.0.0'
$TaskName = 'LALUM offsite backup'
# A bucket that lost more than this share of its files since the last good snapshot is reported.
$ShrinkWarning = 0.10

if ($Register -and $Unregister) { throw 'Use -Register or -Unregister, not both.' }

if ($Unregister) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Removed the scheduled task '$TaskName'."
    exit 0
}

if ($Register) {
    $extra = @()
    if ($Destination) { $extra += "-Destination `"$Destination`"" }
    if ($ExcludeBucket.Count -gt 0) { $extra += "-ExcludeBucket `"$($ExcludeBucket -join ',')`"" }
    if ($RclonePath) { $extra += "-RclonePath `"$RclonePath`"" }
    $command = Register-LalumBackupTask -ScriptPath $PSCommandPath -TaskName $TaskName -ExtraArguments ($extra -join ' ')
    Write-Host "Registered '$TaskName': every Sunday at 10:00, or at the next logon if the PC was off."
    Write-Host "It runs: $command"
    exit 0
}

$stateDir = Get-LalumStateDir
# Seconds included: a run takes longer than that and the lock prevents overlap, so every run gets
# a folder of its own and --immutable never meets a file from an earlier run.
$snapshot = (Get-Date).ToString('yyyy-MM-dd_HHmmss')
$mode = 'backup'
if ($DryRun) { $mode = 'dryrun' }
$log = Join-Path (Join-Path $stateDir 'logs') "$mode-$snapshot.log"
$historyFile = Join-Path $stateDir 'history.jsonl'
$started = Get-Date
$lock = $null
$exitCode = 1
$errors = New-Object System.Collections.Generic.List[string]
$warnings = New-Object System.Collections.Generic.List[string]
$results = New-Object System.Collections.Generic.List[object]
$cryptReady = $false

function Get-LastGoodRun {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    $last = $null
    foreach ($line in [System.IO.File]::ReadAllLines($Path)) {
        if (-not $line.Trim()) { continue }
        try { $entry = $line | ConvertFrom-Json } catch { continue }
        if ($entry.result -eq 'ok' -and $entry.mode -eq 'backup') { $last = $entry }
    }
    return $last
}

try {
    $lock = Open-LalumLock -Path (Join-Path $stateDir 'backup.lock')
    Write-LalumLog -Path $log -Lines "LALUM offsite backup $ScriptVersion, $mode, snapshot $snapshot"

    $rclone = Find-LalumRclone -Path $RclonePath
    Write-LalumLog -Path $log -Lines "rclone: $rclone ($(Get-LalumRcloneVersion))"

    if (-not $Destination) { $Destination = Get-LalumDefaultDestination }
    if (-not $Destination) {
        throw 'OneDrive for work was not found on this PC. Sign in to OneDrive with avraham@lalum.co, or pass -Destination.'
    }
    if (Test-LalumLocalPath -Path $Destination) {
        $parent = Split-Path -Parent $Destination
        if ($parent -and -not (Test-Path -LiteralPath $parent)) {
            throw "The folder that should hold the backup does not exist: $parent"
        }
    }
    Write-LalumLog -Path $log -Lines "Destination (encrypted): $Destination"

    if ($SourceRemote) {
        $sourceRoot = $SourceRemote
        Write-LalumLog -Path $log -Lines "Source: $SourceRemote (test source, not Supabase)"
    } else {
        $sourceRoot = Set-LalumSourceEnvironment -ProjectRef $ProjectRef -Region $Region
        Write-LalumLog -Path $log -Lines "Source: Supabase project $ProjectRef ($Region), S3 endpoint, read only"
    }
    Set-LalumCryptEnvironment -Destination $Destination
    $cryptReady = $true

    $manifestDir = Get-LalumManifestDir
    $buckets = @(Get-LalumFolders -Path $sourceRoot -LogFile $log | Where-Object { $ExcludeBucket -notcontains $_ })
    if ($buckets.Count -eq 0) {
        throw 'No buckets were found. Check that the S3 key belongs to this project and was not revoked.'
    }
    if ($buckets -contains $manifestDir) { throw "A bucket named '$manifestDir' clashes with the manifest folder." }
    Write-LalumLog -Path $log -Lines "Buckets: $($buckets -join ', ')"

    foreach ($bucket in $buckets) {
        $src = Join-LalumRemote -Root $sourceRoot -Child $bucket
        $dst = Get-LalumSnapshotPath -Snapshot $snapshot -Child $bucket
        $item = [ordered]@{ bucket = $bucket; files = 0; bytes = 0; verified = $false; error = $null }
        $results.Add($item)
        try {
            $srcSize = Get-LalumSize -Path $src -LogFile $log
            $item.files = $srcSize.Count
            $item.bytes = $srcSize.Bytes
            if ($DryRun) {
                Write-LalumLog -Path $log -Lines "${bucket}: $($srcSize.Count) files, $(Format-LalumBytes $srcSize.Bytes) (dry run, nothing copied)"
                continue
            }
            if ($srcSize.Count -eq 0) {
                $item.verified = $true
                Write-LalumLog -Path $log -Lines "${bucket}: empty, nothing to copy"
                continue
            }

            # --immutable: never overwrite a file that already exists at the destination.
            $r = Invoke-LalumRclone -LogFile $log -Arguments @('copy', $src, $dst, '--immutable',
                '--stats=1m', '--stats-one-line', '--stats-log-level=NOTICE')
            if ($r.ExitCode -ne 0) { throw "copy failed (rclone exit code $($r.ExitCode))" }

            # Byte for byte: downloads the source again and decrypts the copy.
            $r = Invoke-LalumRclone -LogFile $log -Arguments @('check', $src, $dst, '--one-way', '--download')
            if ($r.ExitCode -ne 0) { throw "verification failed: the copy differs from Supabase (rclone exit code $($r.ExitCode))" }

            $dstSize = Get-LalumSize -Path $dst -LogFile $log
            if ($dstSize.Count -lt $srcSize.Count) {
                throw "the copy has $($dstSize.Count) files, Supabase has $($srcSize.Count)"
            }

            # The manifest lists file names, so it is written to a temporary file, copied into the
            # encrypted snapshot, and deleted.
            $tmp = [System.IO.Path]::GetTempFileName()
            try {
                $r = Invoke-LalumRclone -LogFile $log -Arguments @('hashsum', 'MD5', $dst, '--download', "--output-file=$tmp")
                if ($r.ExitCode -ne 0) { throw "manifest failed (rclone exit code $($r.ExitCode))" }
                $r = Invoke-LalumRclone -LogFile $log -Arguments @('copyto', $tmp, (Get-LalumSnapshotPath -Snapshot $snapshot -Child "$manifestDir/$bucket.md5"))
                if ($r.ExitCode -ne 0) { throw "saving the manifest failed (rclone exit code $($r.ExitCode))" }
            } finally {
                Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
            }

            $item.verified = $true
            Write-LalumLog -Path $log -Lines "${bucket}: $($srcSize.Count) files, $(Format-LalumBytes $srcSize.Bytes), copied and verified"
        } catch {
            $item.error = $_.Exception.Message
            $errors.Add("${bucket}: $($_.Exception.Message)")
            Write-LalumLog -Path $log -Lines "ERROR ${bucket}: $($_.Exception.Message)"
        }
    }

    $previous = Get-LastGoodRun -Path $historyFile
    if ($null -ne $previous) {
        foreach ($p in @($previous.buckets)) {
            $now = @($results | Where-Object { $_.bucket -eq $p.bucket })
            if ($now.Count -eq 0) {
                if ($ExcludeBucket -notcontains $p.bucket) { $warnings.Add("$($p.bucket) is gone (it had $($p.files) files on $($previous.snapshot))") }
            } elseif ($p.files -ge 10 -and $now[0].files -lt [math]::Floor($p.files * (1 - $ShrinkWarning))) {
                $warnings.Add("$($p.bucket) shrank from $($p.files) to $($now[0].files) files since $($previous.snapshot)")
            }
        }
    } elseif (-not $DryRun) {
        $warnings.Add('First snapshot: make sure both encryption passwords are saved in your password manager. Without them nobody can read this backup.')
    }
    foreach ($w in $warnings) { Write-LalumLog -Path $log -Lines "WARNING $w" }

    if ($errors.Count -eq 0) { $exitCode = 0 }
} catch {
    $errors.Add($_.Exception.Message)
    try { Write-LalumLog -Path $log -Lines "ERROR $($_.Exception.Message)" } catch { Write-Host "ERROR $($_.Exception.Message)" }
} finally {
    $finished = Get-Date
    $result = 'failed'
    if ($exitCode -eq 0) { $result = 'ok' }
    $totalFiles = [int64]0
    $totalBytes = [int64]0
    foreach ($i in $results) { $totalFiles += $i.files; $totalBytes += $i.bytes }
    $summary = [ordered]@{
        snapshot       = $snapshot
        mode           = $mode
        result         = $result
        started        = $started.ToString('o')
        finished       = $finished.ToString('o')
        script_version = $ScriptVersion
        computer       = [Environment]::MachineName
        destination    = $Destination
        total_files    = $totalFiles
        total_bytes    = $totalBytes
        buckets        = $results.ToArray()
        warnings       = $warnings.ToArray()
        errors         = $errors.ToArray()
    }
    $json = $summary | ConvertTo-Json -Depth 5 -Compress

    # The summary has counts and sizes only, no file names, so it is also kept in the local history.
    if (-not $DryRun -and $cryptReady -and $results.Count -gt 0) {
        $tmp = [System.IO.Path]::GetTempFileName()
        try {
            [System.IO.File]::WriteAllText($tmp, $json, (New-Object System.Text.UTF8Encoding $false))
            $r = Invoke-LalumRclone -LogFile $log -Arguments @('copyto', $tmp, (Get-LalumSnapshotPath -Snapshot $snapshot -Child "$(Get-LalumManifestDir)/summary.json"))
            if ($r.ExitCode -ne 0) { Write-LalumLog -Path $log -Lines 'WARNING the summary could not be saved inside the snapshot' }
        } catch {
            Write-Host "WARNING the summary could not be saved inside the snapshot: $($_.Exception.Message)"
        } finally {
            Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
        }
    }
    try {
        [System.IO.File]::AppendAllText($historyFile, $json + [Environment]::NewLine, (New-Object System.Text.UTF8Encoding $false))
    } catch {
        Write-Host "WARNING the local history could not be updated: $($_.Exception.Message)"
    }

    Clear-LalumEnvironment
    if ($null -ne $lock) { $lock.Dispose() }

    $line = "Result: $result. $totalFiles files, $(Format-LalumBytes $totalBytes), $($results.Count) buckets. Log: $log"
    try { Write-LalumLog -Path $log -Lines $line } catch { Write-Host $line }

    if (-not $DryRun) {
        if ($exitCode -eq 0) {
            $text = "$totalFiles files in $($results.Count) buckets, verified. Snapshot $snapshot."
            if ($warnings.Count -gt 0) { $text += ' ' + ($warnings -join ' ') }
            Show-LalumToast -Title 'LALUM backup OK' -Text $text
        } else {
            $first = 'unknown error'
            if ($errors.Count -gt 0) { $first = $errors[0] }
            Show-LalumToast -Title 'LALUM backup FAILED' -Text "$first Log: $log"
        }
    }
}
exit $exitCode
