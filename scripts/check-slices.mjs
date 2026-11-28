// Check before a release: index.html and the files in app/ must match.
// Run from the repository root: node scripts/check-slices.mjs
// It fails when index.html loads a file that does not exist, when a file in app/ is not loaded,
// when the files carry different ?v= values, or when a script has a syntax error.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const html = readFileSync('index.html', 'utf8');
const loaded = [...html.matchAll(/(?:src|href)="(app\/[^"?]+)\?v=([^"]+)"/g)].map(m => ({ file: m[1], v: m[2] }));
const errors = [];

const onDisk = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name).replace(/\\/g, '/');
    if (statSync(p).isDirectory()) walk(p); else onDisk.push(p);
  }
})('app');

for (const x of loaded) if (!existsSync(x.file)) errors.push('index.html loads a missing file: ' + x.file);
for (const f of onDisk) if (!loaded.some(x => x.file === f)) errors.push('not loaded by index.html: ' + f);
const versions = [...new Set(loaded.map(x => x.v))];
if (versions.length !== 1) errors.push('different ?v= values: ' + versions.join(', '));
for (const f of onDisk.filter(f => f.endsWith('.js'))) {
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (r.status !== 0) errors.push('syntax error in ' + f + '\n' + r.stderr);
}

if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(loaded.length + ' files, version ' + versions[0] + ', all loaded and valid.');
