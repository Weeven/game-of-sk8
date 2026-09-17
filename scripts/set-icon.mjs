import { rcedit } from 'rcedit';
import { resolve } from 'node:path';

const executable = resolve(process.argv[2] || 'dist/KeeSK8.exe');
await rcedit(executable, { icon: resolve('assets/keesk8.ico') });
console.log(`KeeSK8 executable icon applied: ${executable}`);
