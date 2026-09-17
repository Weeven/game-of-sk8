#define MyAppName "KeeSK8"
#define MyAppVersion "0.1.0"
#define MyAppPublisher "KeeSK8"
#define MyAppExeName "KeeSK8.exe"

[Setup]
AppId={{E6C1F8D7-8C7B-4B7D-9B8D-5EE58A001001}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\KeeSK8
DefaultGroupName=KeeSK8
DisableProgramGroupPage=yes
OutputDir=..\dist
OutputBaseFilename=KeeSK8-Setup
SetupIconFile=..\assets\keesk8.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=lowest

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: unchecked

[Files]
Source: "..\dist\release\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\KeeSK8"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\KeeSK8"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Launch KeeSK8"; Flags: nowait postinstall skipifsilent
