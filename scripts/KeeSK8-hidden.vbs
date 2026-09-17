Set shell = CreateObject("WScript.Shell")
Set fileSystem = CreateObject("Scripting.FileSystemObject")
scriptFolder = fileSystem.GetParentFolderName(WScript.ScriptFullName)
appFolder = fileSystem.GetParentFolderName(scriptFolder)
shell.CurrentDirectory = appFolder
shell.Run Chr(34) & appFolder & "\KeeSK8.exe" & Chr(34), 0, False
