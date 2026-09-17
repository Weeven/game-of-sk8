import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const executable = resolve(process.argv[2] || 'dist/KeeSK8.exe');
execFileSync('powershell.exe', [
  '-NoProfile',
  '-NonInteractive',
  '-ExecutionPolicy',
  'Bypass',
  '-File',
  resolve('scripts/set-icon.ps1'),
  '-Executable',
  executable,
  '-Icon',
  resolve('assets/keesk8.ico'),
], { stdio: 'inherit' });
console.log(`KeeSK8 executable icon applied: ${executable}`);
