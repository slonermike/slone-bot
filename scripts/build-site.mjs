// Assemble the static site: launcher at the root, each prototype frozen under p/<slug>/,
// and a regenerated index.json.  Usage:
//   node scripts/build-site.mjs                      # launcher + every prototype in src/protos -> dist-site/
//   node scripts/build-site.mjs --out site-out --protos 2026-10-30-name --no-launcher
//   node scripts/build-site.mjs --out site-out --broken 2026-10-30-name   # record a broken card, no build
// Existing p/<other> folders in --out are never touched: published prototypes stay frozen.
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'vite';
import { validateManifest } from '../src/core/manifest.ts';
import { launcherConfig, protoConfig, ROOT } from './vite-configs.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);

const out = path.resolve(ROOT, opt('out', 'dist-site'));
const protosDir = path.join(ROOT, 'src/protos');
const allSlugs = () =>
  fs.existsSync(protosDir)
    ? fs.readdirSync(protosDir, { withFileTypes: true }).filter((d) => d.isDirectory() && fs.existsSync(path.join(protosDir, d.name, 'prototype.json'))).map((d) => d.name)
    : [];
const protosArg = opt('protos', 'all');
const slugs = protosArg === 'all' ? allSlugs() : protosArg === 'none' ? [] : protosArg.split(',').filter(Boolean);
const brokenSlug = opt('broken', null);

fs.mkdirSync(path.join(out, 'p'), { recursive: true });

function dirSizeKB(dir) {
  let total = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    total += e.isDirectory() ? dirSizeKB(p) * 1024 : fs.statSync(p).size;
  }
  return Math.round(total / 1024);
}

function readManifest(slug) {
  const file = path.join(protosDir, slug, 'prototype.json');
  const m = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (m.slug !== slug) throw new Error(`prototype.json slug "${m.slug}" does not match folder "${slug}"`);
  return m;
}

function copyIfExists(from, to) {
  if (fs.existsSync(from)) {
    fs.copyFileSync(from, to);
    return true;
  }
  return false;
}

async function buildLauncher() {
  fs.rmSync(path.join(out, 'assets'), { recursive: true, force: true });
  fs.rmSync(path.join(out, 'index.html'), { force: true });
  await build(launcherConfig(out));
  fs.writeFileSync(path.join(out, '.nojekyll'), '');
  const attribution = fs.existsSync(path.join(ROOT, 'ATTRIBUTION.md')) ? fs.readFileSync(path.join(ROOT, 'ATTRIBUTION.md'), 'utf8') : '';
  const license = fs.existsSync(path.join(ROOT, 'LICENSE')) ? fs.readFileSync(path.join(ROOT, 'LICENSE'), 'utf8') : '';
  fs.writeFileSync(path.join(out, 'credits.json'), JSON.stringify({ attribution, license }));
  console.log(`launcher built -> ${path.relative(ROOT, out)}/`);
}

async function buildProto(slug) {
  const manifest = readManifest(slug);
  const errs = validateManifest(manifest);
  if (errs.length) throw new Error(`prototype.json invalid for ${slug}:\n  - ${errs.join('\n  - ')}`);
  const dest = path.join(out, 'p', slug);
  await build(protoConfig(slug, dest));
  const thumbSources = [path.join(protosDir, slug, 'thumb.png'), path.join(ROOT, 'runs', slug, 'thumb.png')];
  const hasThumb = thumbSources.some((s) => copyIfExists(s, path.join(dest, 'thumb.png')));
  const hasPreview = copyIfExists(path.join(protosDir, slug, 'preview.gif'), path.join(dest, 'preview.gif'));
  copyIfExists(path.join(ROOT, 'runs', slug, 'postmortem.md'), path.join(dest, 'postmortem.md'));
  copyIfExists(path.join(ROOT, 'runs', slug, 'feedback-sheet.md'), path.join(dest, 'feedback-sheet.md'));
  const final = { ...manifest, buildStatus: 'ok', thumbnail: hasThumb ? 'thumb.png' : '', preview: hasPreview ? 'preview.gif' : '' };
  fs.writeFileSync(path.join(dest, 'prototype.json'), JSON.stringify(final, null, 2));
  final.sizeKB = dirSizeKB(dest);
  fs.writeFileSync(path.join(dest, 'prototype.json'), JSON.stringify(final, null, 2));
  console.log(`built ${slug}: ${final.sizeKB} KB`);
}

function writeBroken(slug) {
  const dest = path.join(out, 'p', slug);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  let m;
  try { m = readManifest(slug); } catch { m = { slug, title: slug, date: slug.slice(0, 10), question: '', targetFeeling: '', mode: 'systemic', tags: [], theme: '', wildcard: null, juiceLayers: [], metrics: [], assets: [], feedbackStatus: 'needs-feedback', sizeKB: 0, thumbnail: '' }; }
  fs.writeFileSync(path.join(dest, 'prototype.json'), JSON.stringify({ ...m, buildStatus: 'broken', thumbnail: '', sizeKB: 0 }, null, 2));
  console.log(`recorded broken card for ${slug}`);
}

/** Regenerate index.json from every p/<slug>/prototype.json present in the site folder. */
export function writeIndex() {
  const pdir = path.join(out, 'p');
  const list = [];
  for (const d of fs.readdirSync(pdir, { withFileTypes: true })) {
    const f = path.join(pdir, d.name, 'prototype.json');
    if (d.isDirectory() && fs.existsSync(f)) {
      try { list.push(JSON.parse(fs.readFileSync(f, 'utf8'))); } catch { console.warn(`skipping unreadable manifest: ${f}`); }
    }
  }
  list.sort((a, b) => (b.date + b.slug).localeCompare(a.date + a.slug));
  // schemaVersion is the launcher contract: new fields may be added, existing ones keep their meaning.
  fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify({ schemaVersion: 1, prototypes: list }, null, 2));
  console.log(`index.json: ${list.length} prototype(s)`);
  return list;
}

if (!flag('no-launcher')) await buildLauncher();
if (brokenSlug) writeBroken(brokenSlug);
else for (const s of slugs) await buildProto(s);
writeIndex();
