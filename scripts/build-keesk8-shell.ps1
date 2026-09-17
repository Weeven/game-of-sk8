param(
  [Parameter(Mandatory = $true)][string]$CoreExecutable,
  [Parameter(Mandatory = $true)][string]$OutputExecutable,
  [Parameter(Mandatory = $true)][string]$Icon
)

$source = @"
using System;
using System.Diagnostics;
using System.IO;

public static class KeeSk8Shell
{
    public static void Main()
    {
        string appFolder = AppDomain.CurrentDomain.BaseDirectory;
        string core = Path.Combine(appFolder, "$([System.IO.Path]::GetFileName($CoreExecutable))");
        if (!File.Exists(core)) return;

        Process.Start(new ProcessStartInfo
        {
            FileName = core,
            WorkingDirectory = appFolder,
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden
        });
    }
}
"@

$provider = New-Object Microsoft.CSharp.CSharpCodeProvider
$parameters = New-Object System.CodeDom.Compiler.CompilerParameters
$parameters.GenerateExecutable = $true
$parameters.OutputAssembly = [System.IO.Path]::GetFullPath($OutputExecutable)
$parameters.CompilerOptions = "/target:winexe /optimize+ /win32icon:`"$((Resolve-Path $Icon).Path)`""
$parameters.ReferencedAssemblies.Add('System.dll') | Out-Null
$parameters.ReferencedAssemblies.Add('System.Core.dll') | Out-Null
$result = $provider.CompileAssemblyFromSource($parameters, $source)
if ($result.Errors.HasErrors) {
  $messages = $result.Errors | ForEach-Object { $_.ToString() }
  throw ($messages -join [Environment]::NewLine)
}
