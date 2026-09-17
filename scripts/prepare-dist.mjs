import { cp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const dist = resolve('dist');
await mkdir(dist, { recursive: true });
await cp(resolve('public'), resolve(dist, 'public'), { recursive: true, force: true });
await mkdir(resolve(dist, 'scripts'), { recursive: true });
await cp(resolve('scripts', 'sk8-server.mjs'), resolve(dist, 'scripts', 'sk8-server.mjs'));
await cp(resolve('scripts', 'KeeSK8-hidden.vbs'), resolve(dist, 'scripts', 'KeeSK8-hidden.vbs'));
console.log(`KeeSK8 web files copied to ${resolve(dist, 'public')}`);
