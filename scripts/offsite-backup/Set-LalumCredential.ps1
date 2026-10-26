<#
.SYNOPSIS
Stores one secret for the LALUM offsite backup in Windows Credential Manager (generic credential).

.DESCRIPTION
Same result as "cmdkey /generic:<target> /user:<user> /pass", with two differences that matter when
the hidden cmdkey prompt swallows an empty line: the prompt shows asterisks while you paste, and the
script refuses to store an empty value. It never prints the secret; it reports the stored length only.
The secret never appears on a command line and is not written to any file or history.

.EXAMPLE
powershell -NoProfile -ExecutionPolicy Bypass -File .\Set-LalumCredential.ps1 -Target lalum-supabase-s3
(asks for the Access key ID, then for the Secret access key)

.EXAMPLE
powershell -NoProfile -ExecutionPolicy Bypass -File .\Set-LalumCredential.ps1 -Target lalum-offsite-crypt
(user name is "crypt"; asks for the password only)

.EXAMPLE
powershell -NoProfile -ExecutionPolicy Bypass -File .\Set-LalumCredential.ps1 -Target lalum-offsite-crypt -Generate
(creates a random 32-character password, stores it, and shows it once so it can be saved in the
password manager; only for the two crypt targets, never for the S3 key)
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('lalum-supabase-s3', 'lalum-offsite-crypt', 'lalum-offsite-crypt-salt')]
    [string]$Target,
    [string]$User,
    [switch]$Generate
)

$ErrorActionPreference = 'Stop'

if (-not $User) {
    if ($Target -eq 'lalum-supabase-s3') {
        $User = Read-Host 'Access key ID (shown on screen, it is not the secret)'
    } else {
        $User = 'crypt'
    }
}
$User = $User.Trim()
if (-not $User) { throw 'The user name is empty. Nothing was stored.' }

if ($Generate) {
    if ($Target -eq 'lalum-supabase-s3') {
        throw 'The S3 secret comes from Supabase and cannot be generated here. Run without -Generate and paste it.'
    }
    $alphabet = [char[]]((48..57) + (65..90) + (97..122))
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    $plain = -join ($bytes | ForEach-Object { $alphabet[$_ % $alphabet.Length] })
} else {
    $secure = Read-Host ("Paste the secret for '{0}' (asterisks appear while you paste) and press Enter" -f $Target) -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
    $plain = $plain.Trim()
    if ($plain.Length -lt 8) {
        throw ("Only {0} characters were pasted. Nothing was stored. Copy the secret again and rerun." -f $plain.Length)
    }
}

if (-not ('LalumCredWrite' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class LalumCredWrite {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct CREDENTIAL {
        public uint Flags;
        public uint Type;
        public string TargetName;
        public string Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public uint CredentialBlobSize;
        public IntPtr CredentialBlob;
        public uint Persist;
        public uint AttributeCount;
        public IntPtr Attributes;
        public string TargetAlias;
        public string UserName;
    }
    [DllImport("advapi32.dll", EntryPoint = "CredWriteW", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool CredWrite(ref CREDENTIAL cred, uint flags);
    [DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool CredRead(string target, uint type, uint flags, out IntPtr credential);
    [DllImport("advapi32.dll", EntryPoint = "CredFree")]
    static extern void CredFree(IntPtr credential);

    // Writes a generic credential (type 1), persisted for this user on this machine (2).
    public static void Write(string target, string user, string secret) {
        byte[] blob = System.Text.Encoding.Unicode.GetBytes(secret);
        IntPtr p = Marshal.AllocHGlobal(blob.Length);
        try {
            Marshal.Copy(blob, 0, p, blob.Length);
            CREDENTIAL c = new CREDENTIAL();
            c.Type = 1;
            c.TargetName = target;
            c.UserName = user;
            c.Persist = 2;
            c.CredentialBlob = p;
            c.CredentialBlobSize = (uint)blob.Length;
            if (!CredWrite(ref c, 0)) {
                throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
            }
        } finally {
            Array.Clear(blob, 0, blob.Length);
            Marshal.FreeHGlobal(p);
        }
    }

    // The stored secret of a target, or null when the credential does not exist. Used only to
    // refuse a crypt password that equals the other crypt password; never printed.
    public static string ReadSecret(string target) {
        IntPtr p;
        if (!CredRead(target, 1, 0, out p)) { return null; }
        try {
            CREDENTIAL c = (CREDENTIAL)Marshal.PtrToStructure(p, typeof(CREDENTIAL));
            if (c.CredentialBlobSize == 0) { return ""; }
            return Marshal.PtrToStringUni(c.CredentialBlob, (int)(c.CredentialBlobSize / 2));
        } finally {
            CredFree(p);
        }
    }

    // Number of characters stored for the target, -1 when the credential does not exist.
    public static int StoredChars(string target) {
        IntPtr p;
        if (!CredRead(target, 1, 0, out p)) { return -1; }
        try {
            CREDENTIAL c = (CREDENTIAL)Marshal.PtrToStructure(p, typeof(CREDENTIAL));
            return (int)(c.CredentialBlobSize / 2);
        } finally {
            CredFree(p);
        }
    }
}
'@
}

# The password and the salt must differ, or the backup script refuses to run.
$otherTarget = switch ($Target) {
    'lalum-offsite-crypt'      { 'lalum-offsite-crypt-salt' }
    'lalum-offsite-crypt-salt' { 'lalum-offsite-crypt' }
    default                    { $null }
}
if ($otherTarget) {
    $other = [LalumCredWrite]::ReadSecret($otherTarget)
    if ($other -and $other -ceq $plain) {
        $other = $null
        throw ("This value is identical to '{0}'. The password and the salt must differ. Nothing was stored." -f $otherTarget)
    }
    $other = $null
}

[LalumCredWrite]::Write($Target, $User, $plain)
$stored = [LalumCredWrite]::StoredChars($Target)
"Stored '{0}' for user '{1}': {2} characters." -f $Target, $User, $stored
if ($Generate) {
    ""
    "SAVE THIS NOW in your password manager, entry '{0}', user '{1}'. It is shown only once:" -f $Target, $User
    ""
    "    " + $plain
    ""
    "Then run: cls"
}
$plain = $null
