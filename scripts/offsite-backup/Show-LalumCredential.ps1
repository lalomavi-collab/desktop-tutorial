# Shows one LALUM backup encryption secret from Windows Credential Manager on this screen only,
# so it can be copied into the password manager (passwords.google.com, site offsite-backup.lalum.co).
# Never paste the output anywhere else. Run `cls` right after copying.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\Show-LalumCredential.ps1 -Target lalum-offsite-crypt
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\Show-LalumCredential.ps1 -Target lalum-offsite-crypt-salt
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('lalum-offsite-crypt', 'lalum-offsite-crypt-salt')]
    [string]$Target
)

$code = @'
using System;
using System.Runtime.InteropServices;
public static class LalumCredShow {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct CREDENTIAL {
        public uint Flags; public uint Type; public IntPtr TargetName; public IntPtr Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public uint CredentialBlobSize; public IntPtr CredentialBlob; public uint Persist;
        public uint AttributeCount; public IntPtr Attributes; public IntPtr TargetAlias; public IntPtr UserName;
    }
    [DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool CredRead(string target, uint type, uint flags, out IntPtr cred);
    [DllImport("advapi32.dll")]
    static extern void CredFree(IntPtr cred);
    public static string Read(string target) {
        IntPtr p;
        if (!CredRead(target, 1, 0, out p)) { throw new Exception("Credential '" + target + "' was not found in Windows Credential Manager."); }
        try {
            var c = (CREDENTIAL)Marshal.PtrToStructure(p, typeof(CREDENTIAL));
            return Marshal.PtrToStringUni(c.CredentialBlob, (int)(c.CredentialBlobSize / 2));
        } finally { CredFree(p); }
    }
}
'@
Add-Type -TypeDefinition $code

$secret = [LalumCredShow]::Read($Target)
Write-Host ''
Write-Host "Secret '$Target' (user 'crypt'), $($secret.Length) characters. Copy it into your password manager now, then run: cls"
Write-Host 'Do not paste this screen anywhere else.'
Write-Host ''
Write-Host "    $secret"
Write-Host ''
