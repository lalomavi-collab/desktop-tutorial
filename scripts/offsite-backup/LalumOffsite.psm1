# Shared helpers for Backup-LalumStorage.ps1 and Restore-LalumStorage.ps1.
#
# Secrets come from Windows Credential Manager and reach rclone only through RCLONE_CONFIG_*
# environment variables of the running process. Nothing is written to rclone.conf, to disk or
# to the log, and Clear-LalumEnvironment removes the variables when a run ends.
# Procedure (Hebrew): docs/infra/storage-offsite-backup.md

Set-StrictMode -Version 2.0

$script:MinRcloneVersion = [version]'1.60'
$script:Rclone = $null
$script:Utf8NoBom = New-Object System.Text.UTF8Encoding $false

# Generic credentials the owner creates once with cmdkey.
$script:CredS3 = 'lalum-supabase-s3'
$script:CredCrypt = 'lalum-offsite-crypt'
$script:CredCryptSalt = 'lalum-offsite-crypt-salt'

# Remote names rclone sees. They exist only as environment variables.
$script:SourceRemoteName = 'lalumsupa'
$script:CryptRemoteName = 'lalumoffsite'

# Layout inside the encrypted folder: snapshots/<snapshot>/<bucket>/... and
# snapshots/<snapshot>/_manifest/<bucket>.md5 plus summary.json.
$script:SnapshotRoot = 'snapshots'
$script:ManifestDir = '_manifest'

# Encryption settings. Never change them: a snapshot written with one set cannot be read with
# another. base32768 keeps encrypted paths well under the 400 character limit of OneDrive.
$script:CryptSettings = [ordered]@{
    FILENAME_ENCRYPTION       = 'standard'
    DIRECTORY_NAME_ENCRYPTION = 'true'
    FILENAME_ENCODING         = 'base32768'
}

function Test-LalumWindows {
    return ($PSVersionTable.PSEdition -eq 'Desktop') -or ((Test-Path variable:IsWindows) -and $IsWindows)
}

# Reads a generic credential. Returns $null when it does not exist. Kept in a variable so a test
# on another platform can replace it from inside the module scope.
$script:CredentialReader = {
    param([string]$Target)
    if (-not (Test-LalumWindows)) {
        throw 'Windows Credential Manager is only available on Windows.'
    }
    if (-not ('LalumOffsite.CredMan' -as [type])) {
        Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

namespace LalumOffsite {
    public static class CredMan {
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        private struct CREDENTIAL {
            public UInt32 Flags;
            public UInt32 Type;
            public IntPtr TargetName;
            public IntPtr Comment;
            public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
            public UInt32 CredentialBlobSize;
            public IntPtr CredentialBlob;
            public UInt32 Persist;
            public UInt32 AttributeCount;
            public IntPtr Attributes;
            public IntPtr TargetAlias;
            public IntPtr UserName;
        }

        [DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern bool CredRead(string target, UInt32 type, UInt32 flags, out IntPtr credential);

        [DllImport("advapi32.dll", EntryPoint = "CredFree")]
        private static extern void CredFree(IntPtr credential);

        // Returns { user name, secret } of a generic credential (type 1), or null.
        public static string[] ReadGeneric(string target) {
            IntPtr p;
            if (!CredRead(target, 1, 0, out p)) { return null; }
            try {
                CREDENTIAL c = (CREDENTIAL)Marshal.PtrToStructure(p, typeof(CREDENTIAL));
                string user = c.UserName == IntPtr.Zero ? "" : Marshal.PtrToStringUni(c.UserName);
                string secret = c.CredentialBlobSize == 0 ? "" : Marshal.PtrToStringUni(c.CredentialBlob, (int)(c.CredentialBlobSize / 2));
                return new string[] { user, secret };
            } finally {
                CredFree(p);
            }
        }
    }
}
'@
    }
    $pair = [LalumOffsite.CredMan]::ReadGeneric($Target)
    if ($null -eq $pair) { return $null }
    return [pscustomobject]@{ User = $pair[0]; Secret = $pair[1] }
}

function Get-LalumSecret {
    param(
        [Parameter(Mandatory = $true)][string]$Target,
        [string]$Hint
    )
    $cred = & $script:CredentialReader $Target
    if ($null -eq $cred -or [string]::IsNullOrEmpty($cred.Secret)) {
        throw "Credential '$Target' was not found in Windows Credential Manager. $Hint"
    }
    return $cred
}

function Get-LalumStateDir {
    $base = $env:LOCALAPPDATA
    if (-not $base) { $base = Join-Path $HOME '.local/share' }
    $dir = Join-Path $base 'LalumBackup'
    foreach ($d in @($dir, (Join-Path $dir 'logs'))) {
        if (-not (Test-Path -LiteralPath $d)) { New-Item -ItemType Directory -Path $d | Out-Null }
    }
    return $dir
}

function Write-LalumLog {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string[]]$Lines
    )
    $stamp = (Get-Date).ToString('yyyy/MM/dd HH:mm:ss')
    $text = (@($Lines) | ForEach-Object { "$stamp LALUM : $_" }) -join [Environment]::NewLine
    [System.IO.File]::AppendAllText($Path, $text + [Environment]::NewLine, $script:Utf8NoBom)
    foreach ($line in $Lines) { Write-Host $line }
}

# Holds a lock file open for the whole run, so a scheduled run and a manual one never overlap.
function Open-LalumLock {
    param([Parameter(Mandatory = $true)][string]$Path)
    try {
        return [System.IO.File]::Open($Path, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
    } catch {
        throw 'Another backup or restore is already running on this PC.'
    }
}

# Runs rclone and returns its exit code, stdout lines and stderr lines. With -LogFile, rclone
# logs to that file at NOTICE level: warnings, errors and the final stats, never each file name
# it copies. -InputText goes to rclone's standard input.
function Invoke-LalumRclone {
    param(
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [string]$LogFile,
        [string]$InputText
    )
    if (-not $script:Rclone) { throw 'rclone has not been located yet (Find-LalumRclone).' }
    $argList = @($Arguments)
    if ($LogFile) { $argList += @("--log-file=$LogFile", '--log-level=NOTICE') }
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        if ($PSBoundParameters.ContainsKey('InputText')) {
            # Same bytes on Windows PowerShell 5.1 (ASCII default) and PowerShell 7 (UTF-8).
            $OutputEncoding = $script:Utf8NoBom
            $all = @($InputText | & $script:Rclone @argList 2>&1)
        } else {
            $all = @(& $script:Rclone @argList 2>&1)
        }
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previous
    }
    $out = @()
    $err = @()
    foreach ($item in $all) {
        if ($item -is [System.Management.Automation.ErrorRecord]) { $err += $item.ToString() } else { $out += [string]$item }
    }
    if ($LogFile -and $err.Count -gt 0) { Write-LalumLog -Path $LogFile -Lines $err }
    return [pscustomobject]@{ ExitCode = $code; Output = $out; Errors = $err }
}

function Find-LalumRclone {
    param([string]$Path)
    $candidates = @()
    if ($Path) { $candidates += $Path }
    $cmd = Get-Command rclone -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($cmd) { $candidates += $cmd.Path }
    if ($env:LOCALAPPDATA) { $candidates += (Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Links\rclone.exe') }
    foreach ($c in $candidates) {
        if ($c -and (Test-Path -LiteralPath $c -PathType Leaf)) {
            $script:Rclone = $c
            $version = Get-LalumRcloneVersion
            if ($version -lt $script:MinRcloneVersion) {
                throw "rclone $version is too old; $($script:MinRcloneVersion) or later is needed. Run: winget upgrade Rclone.Rclone"
            }
            return $c
        }
    }
    throw 'rclone was not found. Install it with: winget install Rclone.Rclone (then open a new PowerShell window).'
}

function Get-LalumRcloneVersion {
    $r = Invoke-LalumRclone -Arguments @('version')
    $first = ''
    if ($r.Output.Count -gt 0) { $first = $r.Output[0] }
    if ($r.ExitCode -ne 0 -or $first -notmatch 'v(\d+)\.(\d+)(\.(\d+))?') {
        throw "Could not read the rclone version from '$($script:Rclone)'."
    }
    $patch = 0
    if ($Matches[4]) { $patch = [int]$Matches[4] }
    return [version]('{0}.{1}.{2}' -f [int]$Matches[1], [int]$Matches[2], $patch)
}

# rclone wants crypt passwords obscured. The plain text goes through stdin, never the command line.
function ConvertTo-LalumObscured {
    param([Parameter(Mandatory = $true)][string]$Plain)
    $r = Invoke-LalumRclone -Arguments @('obscure', '-') -InputText $Plain
    if ($r.ExitCode -ne 0 -or $r.Output.Count -lt 1 -or -not $r.Output[0].Trim()) {
        throw 'rclone could not prepare the encryption password.'
    }
    $obscured = $r.Output[0].Trim()
    # The result is base64 (no padding) of a 16 byte IV plus the password. If stdin arrived empty,
    # rclone would silently obscure an empty string or "-", and the backup would be encrypted with
    # that instead of the real password. The length shows whether the whole password went through.
    $expected = [int][math]::Ceiling((16 + [System.Text.Encoding]::UTF8.GetByteCount($Plain)) * 4 / 3)
    if ($obscured.Length -ne $expected) {
        throw 'rclone did not receive the whole encryption password; nothing was encrypted.'
    }
    return $obscured
}

function Set-LalumEnv {
    param([string]$Remote, [string]$Key, [string]$Value)
    Set-Item -LiteralPath ('Env:RCLONE_CONFIG_' + $Remote.ToUpperInvariant() + '_' + $Key) -Value $Value
}

# Defines the read side: the project's Supabase S3 endpoint. The S3 key opens every bucket for
# reading and writing; the scripts only ever read through it.
function Set-LalumSourceEnvironment {
    param(
        [Parameter(Mandatory = $true)][string]$ProjectRef,
        [Parameter(Mandatory = $true)][string]$Region
    )
    $hint = "Create it with: cmdkey /generic:$($script:CredS3) /user:<ACCESS_KEY_ID> /pass"
    $key = Get-LalumSecret -Target $script:CredS3 -Hint $hint
    if ([string]::IsNullOrEmpty($key.User)) {
        throw "Credential '$($script:CredS3)' has no user name; it must be the S3 Access key ID. $hint"
    }
    $n = $script:SourceRemoteName
    Set-LalumEnv $n 'TYPE' 's3'
    Set-LalumEnv $n 'PROVIDER' 'Other'
    Set-LalumEnv $n 'ACCESS_KEY_ID' $key.User
    Set-LalumEnv $n 'SECRET_ACCESS_KEY' $key.Secret
    Set-LalumEnv $n 'ENDPOINT' "https://$ProjectRef.storage.supabase.co/storage/v1/s3"
    Set-LalumEnv $n 'REGION' $Region
    Set-LalumEnv $n 'FORCE_PATH_STYLE' 'true'
    Set-LalumEnv $n 'NO_CHECK_BUCKET' 'true'
    return "$($n):"
}

# Defines the encrypted side: a crypt remote over the destination folder or rclone path.
function Set-LalumCryptEnvironment {
    param([Parameter(Mandatory = $true)][string]$Destination)
    $pw = Get-LalumSecret -Target $script:CredCrypt -Hint "Create it with: cmdkey /generic:$($script:CredCrypt) /user:crypt /pass"
    $salt = Get-LalumSecret -Target $script:CredCryptSalt -Hint "Create it with: cmdkey /generic:$($script:CredCryptSalt) /user:crypt /pass"
    foreach ($s in @($pw.Secret, $salt.Secret)) {
        if ($s.Length -lt 20 -or $s -match '[^\x20-\x7E]' -or $s -ne $s.Trim()) {
            throw 'Each encryption password must be at least 20 characters of English letters, digits and symbols, with no space at either end.'
        }
    }
    if ($pw.Secret -ceq $salt.Secret) { throw 'The two encryption passwords must be different.' }
    $n = $script:CryptRemoteName
    Set-LalumEnv $n 'TYPE' 'crypt'
    Set-LalumEnv $n 'REMOTE' $Destination
    Set-LalumEnv $n 'PASSWORD' (ConvertTo-LalumObscured -Plain $pw.Secret)
    Set-LalumEnv $n 'PASSWORD2' (ConvertTo-LalumObscured -Plain $salt.Secret)
    foreach ($k in $script:CryptSettings.Keys) { Set-LalumEnv $n $k $script:CryptSettings[$k] }
}

function Clear-LalumEnvironment {
    $prefixes = @($script:SourceRemoteName, $script:CryptRemoteName) | ForEach-Object { 'RCLONE_CONFIG_' + $_.ToUpperInvariant() + '_' }
    Get-ChildItem -Path Env: | Where-Object {
        $name = $_.Name
        @($prefixes | Where-Object { $name.StartsWith($_, [System.StringComparison]::OrdinalIgnoreCase) }).Count -gt 0
    } | ForEach-Object { Remove-Item -LiteralPath ('Env:' + $_.Name) -ErrorAction SilentlyContinue }
}

function Get-LalumDefaultDestination {
    if ($env:OneDriveCommercial) { return (Join-Path $env:OneDriveCommercial 'LALUM offsite backup') }
    return $null
}

# True for a local folder (C:\..., \\server\share, /...), false for an rclone remote (name:path).
function Test-LalumLocalPath {
    param([Parameter(Mandatory = $true)][string]$Path)
    if ($Path -match '^[A-Za-z]:[\\/]' -or $Path -match '^\\\\' -or $Path -match '^[/.~]') { return $true }
    return -not ($Path -match '^[^\\/:]{2,}:')
}

function Join-LalumRemote {
    param([string]$Root, [string]$Child)
    if ($Root.EndsWith(':') -or $Root.EndsWith('/')) { return $Root + $Child }
    return $Root + '/' + $Child
}

function Get-LalumSnapshotPath {
    param([string]$Snapshot, [string]$Child)
    $p = "$($script:CryptRemoteName):$($script:SnapshotRoot)"
    if ($Snapshot) { $p += "/$Snapshot" }
    if ($Child) { $p += "/$Child" }
    return $p
}

function Get-LalumManifestDir { return $script:ManifestDir }

# Top level folders of an rclone path: the buckets of the S3 endpoint, or the snapshots.
function Get-LalumFolders {
    param([Parameter(Mandatory = $true)][string]$Path, [string]$LogFile)
    $r = Invoke-LalumRclone -Arguments @('lsf', '--dirs-only', $Path) -LogFile $LogFile
    if ($r.ExitCode -ne 0) { throw "Could not list $Path (rclone exit code $($r.ExitCode))." }
    return @($r.Output | Where-Object { $_ -and $_.Trim() } | ForEach-Object { $_.Trim().TrimEnd('/') })
}

function Get-LalumSize {
    param([Parameter(Mandatory = $true)][string]$Path, [string]$LogFile)
    $r = Invoke-LalumRclone -Arguments @('size', '--json', $Path) -LogFile $LogFile
    if ($r.ExitCode -ne 0) { throw "Could not measure $Path (rclone exit code $($r.ExitCode))." }
    $j = ($r.Output -join '') | ConvertFrom-Json
    return [pscustomobject]@{ Count = [int64]$j.count; Bytes = [int64]$j.bytes }
}

function Format-LalumBytes {
    param([int64]$Bytes)
    if ($Bytes -ge 1GB) { return ('{0:N1} GB' -f ($Bytes / 1GB)) }
    if ($Bytes -ge 1MB) { return ('{0:N1} MB' -f ($Bytes / 1MB)) }
    if ($Bytes -ge 1KB) { return ('{0:N1} KB' -f ($Bytes / 1KB)) }
    return "$Bytes B"
}

# Windows toast notification. Silent where toasts are not available (PowerShell 7, other OS).
function Show-LalumToast {
    param([string]$Title, [string]$Text)
    if (-not (Test-LalumWindows)) { return }
    try {
        $t = [System.Security.SecurityElement]::Escape($Title)
        $b = [System.Security.SecurityElement]::Escape($Text)
        $toastXml = "<toast><visual><binding template='ToastGeneric'><text>$t</text><text>$b</text></binding></visual></toast>"
        # Built from a string so PowerShell 7, which has no WinRT types, only fails here at run time.
        $code = @'
param($ToastXml)
$null = [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]
$null = [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime]
$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml($ToastXml)
$app = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe'
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($app).Show((New-Object Windows.UI.Notifications.ToastNotification $xml))
'@
        & ([scriptblock]::Create($code)) $toastXml
    } catch {
        return
    }
}

# Weekly task: Sunday 10:00, the current user, only while logged on (Credential Manager and
# OneDrive need the user's session), and as soon as possible after a missed start.
function Register-LalumBackupTask {
    param(
        [Parameter(Mandatory = $true)][string]$ScriptPath,
        [Parameter(Mandatory = $true)][string]$TaskName,
        [string]$ExtraArguments
    )
    if (-not (Test-LalumWindows)) { throw 'The weekly task can only be registered on Windows.' }
    $hostExe = (Get-Process -Id $PID).Path
    $arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`""
    if ($ExtraArguments) { $arguments += " $ExtraArguments" }
    $action = New-ScheduledTaskAction -Execute $hostExe -Argument $arguments -WorkingDirectory (Split-Path -Parent $ScriptPath)
    $trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At '10:00'
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 3) -MultipleInstances IgnoreNew
    $user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    $principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Weekly encrypted copy of the lalum-app Supabase Storage buckets (scripts/offsite-backup in the desktop-tutorial repo).' -Force | Out-Null
    return "$hostExe $arguments"
}

Export-ModuleMember -Function Test-LalumWindows, Get-LalumSecret, Get-LalumStateDir, Write-LalumLog, Open-LalumLock,
    Invoke-LalumRclone, Find-LalumRclone, Get-LalumRcloneVersion, Set-LalumSourceEnvironment, Set-LalumCryptEnvironment,
    Clear-LalumEnvironment, Get-LalumDefaultDestination, Test-LalumLocalPath, Join-LalumRemote, Get-LalumSnapshotPath,
    Get-LalumManifestDir, Get-LalumFolders, Get-LalumSize, Format-LalumBytes, Show-LalumToast, Register-LalumBackupTask
