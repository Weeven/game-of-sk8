param(
  [Parameter(Mandatory = $true)][string]$Executable,
  [Parameter(Mandatory = $true)][string]$Icon
)

Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class KeeSk8Resources
{
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern IntPtr BeginUpdateResource(string fileName, bool deleteExistingResources);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool UpdateResource(IntPtr updateHandle, IntPtr type, IntPtr name, ushort language, byte[] data, uint dataSize);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool EndUpdateResource(IntPtr updateHandle, bool discard);

    public static IntPtr ResourceId(ushort id)
    {
        return new IntPtr(id);
    }
}
'@

$ico = [System.IO.File]::ReadAllBytes($Icon)
if ($ico.Length -lt 6) { throw "Invalid ICO file: $Icon" }
$count = [BitConverter]::ToUInt16($ico, 4)
if ($count -lt 1) { throw "ICO contains no images: $Icon" }

$handle = [KeeSk8Resources]::BeginUpdateResource($Executable, $false)
if ($handle -eq [IntPtr]::Zero) {
  throw [ComponentModel.Win32Exception]::new([Runtime.InteropServices.Marshal]::GetLastWin32Error(), "Could not open executable for icon update")
}

$iconType = [KeeSk8Resources]::ResourceId(3)
$groupType = [KeeSk8Resources]::ResourceId(14)
$language = [uint16]0x0409
$group = [byte[]]::new(6 + ($count * 14))
[Array]::Copy([BitConverter]::GetBytes([uint16]0), 0, $group, 0, 2)
[Array]::Copy([BitConverter]::GetBytes([uint16]1), 0, $group, 2, 2)
[Array]::Copy([BitConverter]::GetBytes($count), 0, $group, 4, 2)
$success = $false

try {
  for ($index = 0; $index -lt $count; $index++) {
    $entry = 6 + ($index * 16)
    $imageSize = [BitConverter]::ToUInt32($ico, $entry + 8)
    $imageOffset = [BitConverter]::ToUInt32($ico, $entry + 12)
    $image = [byte[]]::new($imageSize)
    [Array]::Copy($ico, $imageOffset, $image, 0, $imageSize)
    $resourceId = [uint16]($index + 1)
    if (-not [KeeSk8Resources]::UpdateResource($handle, $iconType, [KeeSk8Resources]::ResourceId($resourceId), $language, $image, [uint32]$image.Length)) {
      throw [ComponentModel.Win32Exception]::new([Runtime.InteropServices.Marshal]::GetLastWin32Error(), "Could not write icon image $resourceId")
    }

    $groupEntry = 6 + ($index * 14)
    [Array]::Copy($ico, $entry, $group, $groupEntry, 8)
    [Array]::Copy($ico, $entry + 8, $group, $groupEntry + 8, 4)
    [Array]::Copy([BitConverter]::GetBytes($resourceId), 0, $group, $groupEntry + 12, 2)
  }

  if (-not [KeeSk8Resources]::UpdateResource($handle, $groupType, [KeeSk8Resources]::ResourceId(1), $language, $group, [uint32]$group.Length)) {
    throw [ComponentModel.Win32Exception]::new([Runtime.InteropServices.Marshal]::GetLastWin32Error(), "Could not write icon group")
  }
  $success = $true
} finally {
  [KeeSk8Resources]::EndUpdateResource($handle, -not $success) | Out-Null
}
