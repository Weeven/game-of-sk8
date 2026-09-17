const { execFile } = require('node:child_process');
const { existsSync, mkdirSync, readdirSync, writeFileSync } = require('node:fs');
const { dirname, join, resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const isPackaged = Boolean(process.pkg || process.versions?.sea);
  const candidateRoots = isPackaged
    ? [process.cwd(), dirname(process.execPath), dirname(process.argv[0] || '')].filter(Boolean)
    : [resolve(__dirname, '..')];

  function hasAppFiles(root) {
    return Boolean(root) && existsSync(join(root, 'public', 'sk8.html')) && existsSync(join(root, 'scripts', 'sk8-server.mjs'));
  }

  function findAppRoot() {
    for (const root of [...new Set(candidateRoots)]) {
      if (hasAppFiles(root)) return root;
      try {
        const child = readdirSync(root, { withFileTypes: true }).find(entry => entry.isDirectory() && hasAppFiles(join(root, entry.name)));
        if (child) return join(root, child.name);
      } catch {
        // Continue with the next candidate when a parent folder cannot be listed.
      }
    }
    return candidateRoots[0];
  }

  const appRoot = findAppRoot();
  process.env.SK8_PUBLIC_ROOT ||= join(appRoot, 'public');
  const dataRoot = isPackaged && process.env.APPDATA ? join(process.env.APPDATA, 'KeeSK8') : join(appRoot, '.data');
  process.env.SK8_DATA_FILE ||= join(dataRoot, 'sk8-sessions.json');

  const { startServer } = await import(pathToFileURL(join(appRoot, 'scripts', 'sk8-server.mjs')).href);
  const server = startServer();
  const controlUrl = 'http://127.0.0.1:420/sk8';

  function runPowerShell(script) {
    const encodedScript = Buffer.from(script, 'utf16le').toString('base64');
    return new Promise(resolve => {
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-EncodedCommand', encodedScript], { windowsHide: true }, (error, stdout) => {
        resolve({ error, output: String(stdout || '').trim() });
      });
    });
  }

  function powershellString(value) {
    return `'${String(value).replace(/'/g, "''")}'`;
  }

  async function offerDesktopShortcut() {
    if (!isPackaged || process.platform !== 'win32') return;

    const appDataRoot = process.env.APPDATA || join(appRoot, '.data');
    const settingsDir = join(appDataRoot, 'KeeSK8');
    const firstLaunchMarker = join(settingsDir, 'first-launch-complete');
    if (existsSync(firstLaunchMarker)) return;

    try {
      const prompt = await runPowerShell(`
        Add-Type -AssemblyName System.Windows.Forms
        $result = [System.Windows.Forms.MessageBox]::Show(
          'Would you like to add a KeeSK8 shortcut to your desktop? KeeSK8 must be running whenever OBS is using the overlay.',
          'KeeSK8',
          [System.Windows.Forms.MessageBoxButtons]::YesNo,
          [System.Windows.Forms.MessageBoxIcon]::Question
        )
        if ($result -eq [System.Windows.Forms.DialogResult]::Yes) { 'YES' } else { 'NO' }
      `);

      if (!prompt.error && prompt.output === 'YES') {
        const executable = process.execPath;
        const hiddenLauncher = join(appRoot, 'scripts', 'KeeSK8-hidden.vbs');
        const desktopResult = await runPowerShell('[Environment]::GetFolderPath(\'Desktop\')');
        if (!desktopResult.error && desktopResult.output) {
          const desktopShortcut = join(desktopResult.output, 'KeeSK8.lnk');
          const windowsScriptHost = join(process.env.WINDIR || 'C:\\Windows', 'System32', 'wscript.exe');
          await runPowerShell(`
            $shell = New-Object -ComObject WScript.Shell
            $shortcut = $shell.CreateShortcut(${powershellString(desktopShortcut)})
            $shortcut.TargetPath = ${powershellString(existsSync(hiddenLauncher) ? windowsScriptHost : executable)}
            $shortcut.Arguments = ${powershellString(existsSync(hiddenLauncher) ? `"${hiddenLauncher}"` : '')}
            $shortcut.WorkingDirectory = ${powershellString(appRoot)}
            $shortcut.IconLocation = ${powershellString(`${executable},0`) }
            $shortcut.Description = 'Start the KeeSK8 streamer game and local OBS overlay server'
            $shortcut.Save()
          `);
        }
      }
    } catch {
      // A shortcut is optional; never prevent KeeSK8 from opening if Windows declines it.
    }

    try {
      mkdirSync(settingsDir, { recursive: true });
      writeFileSync(firstLaunchMarker, new Date().toISOString(), 'utf8');
    } catch {
      // The app can continue even if Windows does not allow saving the first-launch preference.
    }
  }

  function openControlPage() {
    if (process.platform === 'win32') execFile('cmd.exe', ['/c', 'start', '', controlUrl], { windowsHide: true });
    else if (process.platform === 'darwin') execFile('open', [controlUrl]);
    else execFile('xdg-open', [controlUrl]);
  }

  server.once('listening', async () => {
    await offerDesktopShortcut();
    openControlPage();
  });

  function shutdown() {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000).unref();
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
})().catch(error => {
  console.error('KeeSK8 could not start:', error.message);
  process.exitCode = 1;
});
