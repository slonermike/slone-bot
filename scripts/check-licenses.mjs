#!/usr/bin/env node
// Audit production dependency licenses: fail on copyleft or non-commercial terms. Prints a compact table with --list.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OK = /^(MIT|ISC|BSD-2-Clause|BSD-3-Clause|Apache-2\.0|0BSD|CC0-1\.0|Unlicense|OFL-1\.1|BlueOak-1\.0\.0|Python-2\.0)$/;
const BAD = /(GPL|AGPL|LGPL|SSPL|NC|BUSL|Commons-Clause)/i;

function readPkg(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')); } catch { return null; }
}
function licenseOf(p) {
  const l = p.license ?? (Array.isArray(p.licenses) ? p.licenses.map((x) => x.type).join(' OR ') : '');
  return typeof l === 'object' ? l.type : String(l || 'UNKNOWN');
}
/** SPDX expression is fine if any OR-branch is acceptable. */
function acceptable(expr) {
  return expr.replace(/[()]/g, '').split(/\s+OR\s+/i).some((alt) => alt.split(/\s+AND\s+/i).every((a) => OK.test(a.trim())));
}

const root = readPkg(ROOT);
const seen = new Map();
function visit(name, from) {
  let dir = from;
  let pkgDir = null;
  while (dir.startsWith(ROOT)) {
    const cand = path.join(dir, 'node_modules', name);
    if (fs.existsSync(path.join(cand, 'package.json'))) { pkgDir = cand; break; }
    dir = path.dirname(dir);
  }
  if (!pkgDir) return; // optional peer, not installed
  const pkg = readPkg(pkgDir);
  const key = `${pkg.name}@${pkg.version}`;
  if (seen.has(key)) return;
  seen.set(key, licenseOf(pkg));
  for (const dep of Object.keys({ ...pkg.dependencies })) visit(dep, pkgDir);
}
for (const dep of Object.keys(root.dependencies ?? {})) visit(dep, ROOT);

const problems = [];
for (const [pkg, lic] of seen) if (BAD.test(lic) || !acceptable(lic)) problems.push(`${pkg}: ${lic}`);
if (process.argv.includes('--list')) for (const [pkg, lic] of [...seen].sort()) console.log(`${pkg.padEnd(40)} ${lic}`);
if (problems.length) {
  console.error(`license audit FAILED:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`license audit ok: ${seen.size} production packages, all MIT-compatible and commercially reusable`);
