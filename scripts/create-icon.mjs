import { execFileSync } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import pngToIco from 'png-to-ico';

const source = resolve('assets/keesk8.png');
const target = resolve('assets/keesk8.ico');
const sizes = [16, 24, 32, 48, 64, 128, 256];
await mkdir(dirname(target), { recursive: true });
try {
  const [sourceInfo, targetInfo] = await Promise.all([stat(source), stat(target)]);
  if (!process.argv.includes('--force') && targetInfo.mtimeMs >= sourceInfo.mtimeMs) {
    console.log(`KeeSK8 icon already current: ${target}`);
    process.exit(0);
  }
} catch {
  // Generate the icon when it does not exist yet.
}
const sizeDir = resolve('assets/.icon-sizes');
execFileSync('powershell.exe', [
  '-NoProfile',
  '-NonInteractive',
  '-ExecutionPolicy',
  'Bypass',
  '-File',
  resolve('scripts/create-icon-sizes.ps1'),
  '-Source',
  source,
  '-OutputDir',
  sizeDir,
], { stdio: 'inherit' });
const pngs = await Promise.all(sizes.map(size => readFile(join(sizeDir, `${size}.png`))));
await writeFile(target, await pngToIco(pngs));
console.log(`KeeSK8 icon created: ${target}`);
