// Uses the existing repository's esbuild toolchain; no client runtime dependency.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../new-year/package.json', import.meta.url));
const { build } = require(process.env.SB_ESBUILD || 'esbuild');
const root = fileURLToPath(new URL('../../', import.meta.url));
await build({ entryPoints: [root + '_features/weather/client.mjs'], outfile: root + 'assets/js/weather.js', bundle: true, external: ['/assets/js/weather-renderer.js'], format: 'iife', target: ['safari15.4', 'chrome100'], minify: true, legalComments: 'none' });
console.log('Built assets/js/weather.js');
await build({ entryPoints: [root + '_features/weather/renderer.mjs'], outfile: root + 'assets/js/weather-renderer.js', bundle: true, format: 'esm', target: ['safari15.4', 'chrome100'], minify: true, legalComments: 'none' });
console.log('Built assets/js/weather-renderer.js');
