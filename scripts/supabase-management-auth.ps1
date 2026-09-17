# Uses the existing Supabase CLI login; never writes or prints credentials.
function Get-SupabaseManagementHeaders {
  if (-not ('VerticalsCredentialReader' -as [type])) {
    Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class VerticalsCredentialReader {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct Credential { public uint Flags; public uint Type; public string TargetName; public string Comment; public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten; public uint CredentialBlobSize; public IntPtr CredentialBlob; public uint Persist; public uint AttributeCount; public IntPtr Attributes; public string TargetAlias; public string UserName; }
  [DllImport("advapi32.dll", EntryPoint="CredReadW", CharSet=CharSet.Unicode, SetLastError=true)] public static extern bool Read(string target, uint type, uint flags, out IntPtr credential);
  [DllImport("advapi32.dll")] public static extern void CredFree(IntPtr credential);
}
"@
  }
  $credentialPointer = [IntPtr]::Zero
  if (-not [VerticalsCredentialReader]::Read('Supabase CLI:supabase', 1, 0, [ref]$credentialPointer)) { throw 'Supabase CLI login is unavailable.' }
  try {
    $credential = [Runtime.InteropServices.Marshal]::PtrToStructure($credentialPointer, [type][VerticalsCredentialReader+Credential])
    $bytes = New-Object byte[] $credential.CredentialBlobSize
    [Runtime.InteropServices.Marshal]::Copy($credential.CredentialBlob, $bytes, 0, $bytes.Length)
    $token = [Text.Encoding]::UTF8.GetString($bytes).Trim([char]0)
    if ($token.Contains([string][char]0)) { $token = [Text.Encoding]::Unicode.GetString($bytes).Trim([char]0) }
    if (-not $token.StartsWith('sbp_')) { throw 'Unsupported Supabase credential format.' }
    return @{ Authorization = "Bearer $token" }
  } finally { [VerticalsCredentialReader]::CredFree($credentialPointer) }
}
