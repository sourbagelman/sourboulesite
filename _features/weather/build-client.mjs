// Uses the existing repository's esbuild toolchain; no client runtime dependency.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../new-year/package.json', import.meta.url));
const { build } = require(process.env.SB_ESBUILD || 'esbuild');
const root = fileURLToPath(new URL('../../', import.meta.url));
const legacy = new Map();
for (const name of ['weather.js', 'weather-renderer.js']) legacy.set(name, createHash('sha256').update(await readFile(root + 'assets/js/' + name)).digest('hex'));
await build({ entryPoints: [root + '_features/weather/client.mjs'], outfile: root + 'assets/js/weather-v2.js', bundle: true, external: ['/assets/js/weather-renderer-v2.js'], format: 'iife', target: ['safari15.4', 'chrome100'], minify: true, legalComments: 'none' });
console.log('Built assets/js/weather-v2.js');
await build({ entryPoints: [root + '_features/weather/renderer.mjs'], outfile: root + 'assets/js/weather-renderer-v2.js', bundle: true, format: 'esm', target: ['safari15.4', 'chrome100'], minify: true, legalComments: 'none' });
console.log('Built assets/js/weather-renderer-v2.js');

for (const [name, expected] of legacy) {
  const current = createHash('sha256').update(await readFile(root + 'assets/js/' + name)).digest('hex');
  if (current !== expected) throw Error('Legacy asset changed: ' + name);
}
