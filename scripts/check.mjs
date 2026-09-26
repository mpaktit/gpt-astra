// Static checks with zero dependencies: syntax, import resolution, SW cache coverage, banned patterns.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(join(root, 'src')).filter((f) => f.endsWith('.js'));
let errors = 0;
const err = (m) => { console.error('✗ ' + m); errors++; };

for (const f of [...files, join(root, 'sw.js')]) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (e) { err(`syntax: ${relative(root, f)}\n${e.stderr}`); }
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/from\s+'(\.[^']+)'/g)) {
    const target = resolve(dirname(f), m[1]);
    if (!existsSync(target)) err(`${relative(root, f)} imports missing ${m[1]}`);
  }
  if (/\beval\(|new Function\(/.test(src)) err(`${relative(root, f)} uses eval/new Function`);
  if (/Math\.random\(/.test(src) && /src\/(core|meta)\//.test(f)) err(`${relative(root, f)}: Math.random in deterministic code`);
  if (/—|–/.test(src)) err(`${relative(root, f)}: em/en dash in source copy`);
}
const sw = readFileSync(join(root, 'sw.js'), 'utf8');
const cached = new Set([...sw.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter(Boolean));
for (const f of files) { const rel = relative(root, f).replaceAll('\\', '/'); if (!cached.has(rel)) err(`sw.js does not precache ${rel}`); }
for (const c of cached) if (c && !existsSync(join(root, c))) err(`sw.js precaches missing file ${c}`);
if (errors) { console.error(`\n${errors} problem(s).`); process.exit(1); }
console.log(`✓ ${files.length} modules clean, service worker covers all of them.`);
