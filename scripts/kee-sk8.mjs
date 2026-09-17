import { execFile } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = process.pkg ? dirname(process.execPath) : resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.env.SK8_PUBLIC_ROOT ??= join(appRoot, 'public');
process.env.SK8_DATA_FILE ??= join(appRoot, '.data', 'sk8-sessions.json');

const { startServer } = await import('./sk8-server.mjs');
const server = startServer();
const controlUrl = 'http://127.0.0.1:420/sk8';

server.once('listening', () => {
  if (process.platform === 'win32') execFile('cmd.exe', ['/c', 'start', '', controlUrl], { windowsHide: true });
  else if (process.platform === 'darwin') execFile('open', [controlUrl]);
  else execFile('xdg-open', [controlUrl]);
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
