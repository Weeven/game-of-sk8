import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import pngToIco from 'png-to-ico';

const source = resolve('assets/keesk8.png');
const target = resolve('assets/keesk8.ico');
await mkdir(dirname(target), { recursive: true });
try {
  const [sourceInfo, targetInfo] = await Promise.all([stat(source), stat(target)]);
  if (targetInfo.mtimeMs >= sourceInfo.mtimeMs) {
    console.log(`KeeSK8 icon already current: ${target}`);
    process.exit(0);
  }
} catch {
  // Generate the icon when it does not exist yet.
}
await writeFile(target, await pngToIco([await readFile(source)]));
console.log(`KeeSK8 icon created: ${target}`);
