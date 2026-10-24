<#
.SYNOPSIS
Lists the encrypted snapshots made by Backup-LalumStorage.ps1, or decrypts one into a local folder
and verifies it against the manifest written at backup time.

.DESCRIPTION
Reads only the encrypted backup. It never connects to Supabase and never uploads anything: putting
a file back into Supabase is a separate, deliberate step (see docs/infra/storage-offsite-backup.md).
The restored folder holds client files in the clear, so delete it when you are done.

.PARAMETER List
Lists the snapshots with their result, file count and size. This is the default.

.PARAMETER Snapshot
Name of the snapshot to restore (as shown by -List), or "latest".

.PARAMETER To
Local folder to restore into. It must not exist yet, or be empty.

.PARAMETER Bucket
Restore only these buckets of the snapshot.

.PARAMETER Destination
Folder or rclone remote path that holds the encrypted backup. Default: as in Backup-LalumStorage.ps1.

.PARAMETER RclonePath
Full path of rclone.exe when it is not on PATH.

.EXAMPLE
powershell -NoProfile -ExecutionPolicy Bypass -File .\Restore-LalumStorage.ps1 -List

.EXAMPLE
powershell -NoProfile -ExecutionPolicy Bypass -File .\Restore-LalumStorage.ps1 -Snapshot latest -To C:\Temp\lalum-restore-test
#>
[CmdletBinding(DefaultParameterSetName = 'List')]
param(
    [Parameter(ParameterSetName = 'List')][switch]$List,
    [Parameter(ParameterSetName = 'Restore', Mandatory = $true)][string]$Snapshot,
    [Parameter(ParameterSetName = 'Restore', Mandatory = $true)][string]$To,
    [Parameter(ParameterSetName = 'Restore')][string[]]$Bucket = @(),
    [string]$Destination,
    [string]$RclonePath
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'LalumOffsite.psm1') -Force

$Bucket = @($Bucket | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
$stateDir = Get-LalumStateDir
$log = Join-Path (Join-Path $stateDir 'logs') ('restore-' + (Get-Date).ToString('yyyy-MM-dd_HHmmss') + '.log')
$lock = $null
$exitCode = 1

function Read-SnapshotSummary {
    param([string]$Name)
    $r = Invoke-LalumRclone -LogFile $log -Arguments @('cat', (Get-LalumSnapshotPath -Snapshot $Name -Child "$(Get-LalumManifestDir)/summary.json"))
    if ($r.ExitCode -ne 0 -or $r.Output.Count -eq 0) { return $null }
    try { return (($r.Output -join '') | ConvertFrom-Json) } catch { return $null }
}

try {
    $lock = Open-LalumLock -Path (Join-Path $stateDir 'backup.lock')
    Find-LalumRclone -Path $RclonePath | Out-Null
    if (-not $Destination) { $Destination = Get-LalumDefaultDestination }
    if (-not $Destination) { throw 'OneDrive for work was not found on this PC. Pass -Destination.' }
    Set-LalumCryptEnvironment -Destination $Destination
    Write-LalumLog -Path $log -Lines "Encrypted backup: $Destination"

    $snapshots = @()
    $listing = Invoke-LalumRclone -LogFile $log -Arguments @('lsf', '--dirs-only', (Get-LalumSnapshotPath))
    if ($listing.ExitCode -eq 0) {
        $snapshots = @($listing.Output | Where-Object { $_ -and $_.Trim() } | ForEach-Object { $_.Trim().TrimEnd('/') } | Sort-Object)
    }
    if ($snapshots.Count -eq 0) {
        throw 'No snapshots were found. If there should be some, the encryption passwords in Credential Manager differ from the ones the backup was made with.'
    }

    if ($PSCmdlet.ParameterSetName -eq 'List') {
        foreach ($s in $snapshots) {
            $sum = Read-SnapshotSummary -Name $s
            if ($null -eq $sum) {
                Write-Host ("{0}  no summary (the run did not finish)" -f $s)
            } else {
                Write-Host ("{0}  {1,-6}  {2,6} files  {3,10}" -f $s, $sum.result, $sum.total_files, (Format-LalumBytes ([int64]$sum.total_bytes)))
            }
        }
        $exitCode = 0
    } else {
        if ($Snapshot -eq 'latest') { $Snapshot = $snapshots[-1] }
        if ($snapshots -notcontains $Snapshot) { throw "There is no snapshot named '$Snapshot'. Run with -List." }
        if ((Test-Path -LiteralPath $To) -and @(Get-ChildItem -LiteralPath $To -Force).Count -gt 0) {
            throw "The folder $To is not empty. Restore into a new or empty folder."
        }
        if (-not (Test-Path -LiteralPath $To)) { New-Item -ItemType Directory -Path $To | Out-Null }

        $manifestDir = Get-LalumManifestDir
        $available = @(Get-LalumFolders -Path (Get-LalumSnapshotPath -Snapshot $Snapshot) -LogFile $log | Where-Object { $_ -ne $manifestDir })
        $wanted = $available
        if ($Bucket.Count -gt 0) {
            foreach ($b in $Bucket) { if ($available -notcontains $b) { throw "Snapshot $Snapshot has no bucket '$b'." } }
            $wanted = $Bucket
        }
        Write-LalumLog -Path $log -Lines "Restoring snapshot $Snapshot ($($wanted -join ', ')) into $To"

        $failed = 0
        foreach ($b in $wanted) {
            $target = Join-Path $To $b
            $sumFile = Join-Path (Join-Path $To $manifestDir) "$b.md5"
            $r = Invoke-LalumRclone -LogFile $log -Arguments @('copy', (Get-LalumSnapshotPath -Snapshot $Snapshot -Child $b), $target)
            if ($r.ExitCode -ne 0) { $failed++; Write-LalumLog -Path $log -Lines "ERROR ${b}: copy failed (rclone exit code $($r.ExitCode))"; continue }
            $r = Invoke-LalumRclone -LogFile $log -Arguments @('copyto', (Get-LalumSnapshotPath -Snapshot $Snapshot -Child "$manifestDir/$b.md5"), $sumFile)
            if ($r.ExitCode -ne 0) { $failed++; Write-LalumLog -Path $log -Lines "ERROR ${b}: the snapshot has no manifest for this bucket"; continue }
            # Every file in the manifest must be present with the same MD5, and nothing extra.
            $r = Invoke-LalumRclone -LogFile $log -Arguments @('checksum', 'MD5', $sumFile, $target)
            if ($r.ExitCode -ne 0) { $failed++; Write-LalumLog -Path $log -Lines "ERROR ${b}: the restored files do not match the manifest"; continue }
            $size = Get-LalumSize -Path $target -LogFile $log
            Write-LalumLog -Path $log -Lines "${b}: $($size.Count) files, $(Format-LalumBytes $size.Bytes), match the manifest"
        }
        if ($failed -eq 0) {
            $exitCode = 0
            Write-LalumLog -Path $log -Lines "Restored and verified into $To. It holds client files in the clear: delete it when you are done."
        }
    }
} catch {
    try { Write-LalumLog -Path $log -Lines "ERROR $($_.Exception.Message)" } catch { Write-Host "ERROR $($_.Exception.Message)" }
} finally {
    Clear-LalumEnvironment
    if ($null -ne $lock) { $lock.Dispose() }
}
exit $exitCode
