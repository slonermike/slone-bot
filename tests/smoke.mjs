// `npm run smoke` : headless end-to-end check of the built site (run `build-site` first; npm does).
// Gates every merge to main and every publish. Exit code 1 on any failure.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSuite } from '../src/bots/suite.ts';
import { validateTelemetry } from '../src/bots/telemetry.ts';
import { validateManifest } from '../src/core/manifest.ts';
import * as demo from '../src/protos/_demo/index.ts';
import { BTN, launchBrowser, newPage, pngIsNonBlank, tap } from './lib/browser.mjs';
import { serveDir } from './lib/server.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'dist-site');
const OUT = path.join(ROOT, 'runs/_smoke');
const STRICT_FPS = process.env.SMOKE_STRICT_FPS === '1';
const SLUG = '_demo';
fs.mkdirSync(path.join(OUT, 'screens'), { recursive: true });

const results = [];
const warn = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
};

if (!fs.existsSync(path.join(SITE, 'index.json'))) {
  console.error('dist-site/ missing. Run: node scripts/build-site.mjs');
  process.exit(1);
}

const srv = await serveDir(SITE);
const browser = await launchBrowser();
try {
  // 7. manifest valid + rebuild is stable
  const index = JSON.parse(fs.readFileSync(path.join(SITE, 'index.json'), 'utf8'));
  const manifestErrs = index.prototypes.flatMap((m) => validateManifest(m).map((e) => `${m.slug}: ${e}`));
  const before = fs.readFileSync(path.join(SITE, 'index.json'), 'utf8');
  execFileSync('node', ['scripts/build-site.mjs', '--out', 'dist-site', '--no-launcher', '--protos', 'none'], { cwd: ROOT, stdio: 'pipe' });
  const after = fs.readFileSync(path.join(SITE, 'index.json'), 'utf8');
  check('manifests validate', manifestErrs.length === 0 && index.prototypes.some((m) => m.slug === SLUG), manifestErrs.join('; '));
  check('index.json rebuilds identically', before === after);

  // launcher: card present
  const L = await newPage(browser);
  await L.page.goto(srv.url + '/');
  await L.page.waitForSelector('.card', { timeout: 10000 });
  const cardText = await L.page.textContent('.card');
  check('launcher shows the demo card', /Demo Ball/.test(cardText ?? ''));
  await L.page.screenshot({ path: path.join(OUT, 'screens/launcher.png') });

  // launch with the gamepad (A)
  await tap(L.page, [BTN.a], 300);
  await L.page.waitForURL(/\/p\/_demo\/$/, { timeout: 8000 });
  check('press A launches the card', true);

  // 1. headless boot, no console errors
  await L.page.waitForFunction(() => window.__scaffold, null, { timeout: 15000 });
  check('prototype boots with no console errors', L.errors.length === 0, L.errors.slice(0, 2).join(' | '));
  const P = L.page;

  check('title screen waits for A', (await P.evaluate(() => window.__scaffold.state())) === 'title');
  await tap(P, [BTN.a], 300);
  check('A starts the game', (await P.evaluate(() => window.__scaffold.state())) === 'playing');

  // 2. synthetic gamepad moves something
  const x0 = await P.evaluate(() => window.__scaffold.proto.getState().x);
  await tap(P, [], 700, [1, 0, 0, 0]);
  const x1 = await P.evaluate(() => window.__scaffold.proto.getState().x);
  check('stick input moves the ball', x1 - x0 > 40, `x ${x0.toFixed(0)} -> ${x1.toFixed(0)}`);

  // 4. audio event fires (spy on play log)
  await tap(P, [BTN.a], 300, [1, 0, 0, 0]);
  const played = await P.evaluate(() => window.__scaffold.audioLog.map((e) => e.name));
  check('audio event fired (dash)', played.includes('dash'), `log: ${[...new Set(played)].join(',')}`);

  // 3. frame rate over 5 s real time
  const f0 = await P.evaluate(() => window.__scaffold.stats().frames);
  await P.waitForTimeout(5000);
  const f1 = await P.evaluate(() => window.__scaffold.stats().frames);
  const fps = (f1 - f0) / 5;
  const msg = `${fps.toFixed(1)} fps over 5s`;
  if (fps >= 55) check('frame rate >= 55', true, msg);
  else if (STRICT_FPS) check('frame rate >= 55', false, msg);
  else { warn.push(`frame rate ${msg} below 55 (headless software GL; set SMOKE_STRICT_FPS=1 on real hardware)`); console.log(`WARN  frame rate ${msg}`); }

  // 5. telemetry written and valid
  const snap = await P.evaluate(() => window.__scaffold.snapshot('smoke'));
  const terrs = validateTelemetry(snap);
  fs.writeFileSync(path.join(OUT, 'telemetry-realtime.json'), JSON.stringify(snap, null, 2));
  check('realtime telemetry validates and is written', terrs.length === 0 && fs.existsSync(path.join(OUT, 'telemetry-realtime.json')), terrs.join('; '));

  // sim-only bots: reproducible, no crashes
  const suite = runSuite(demo.createPrototype, demo.bots ?? [], { maxSimSeconds: 60, seeds: [1, 2] });
  fs.mkdirSync(path.join(OUT, 'bots'), { recursive: true });
  let botErrs = [];
  for (const r of suite.runs) {
    botErrs.push(...validateTelemetry(r.telemetry));
    fs.writeFileSync(path.join(OUT, 'bots', `${r.telemetry.bot}-seed${r.telemetry.seed}.json`), JSON.stringify(r.telemetry, null, 2));
  }
  check('sim-only bot telemetry validates', botErrs.length === 0, botErrs.slice(0, 2).join('; '));
  check('bot suite has no flags', suite.flags.length === 0, suite.flags.join(' | '));

  // 6. screenshot non-blank
  const shot = await P.screenshot({ path: path.join(OUT, 'screens/play.png') });
  const colors = await pngIsNonBlank(browser, shot);
  check('screenshot is non-blank', colors > 8, `${colors} distinct colors`);

  // pause toggles (gamepad Start)
  await tap(P, [BTN.start], 300);
  const paused = await P.waitForFunction(() => window.__scaffold.state() === 'paused', null, { timeout: 4000 }).then(() => 'paused', () => 'not paused');
  await tap(P, [BTN.start], 300);
  const resumed = await P.waitForFunction(() => window.__scaffold.state() === 'playing', null, { timeout: 4000 }).then(() => 'playing', () => 'not playing');
  check('Start pauses and resumes', paused === 'paused' && resumed === 'playing', `${paused} -> ${resumed}`);

  // keyboard: labels switch device, Escape pauses and acts as Back inside menus.
  // Software-GL frames are slow here, so wait on conditions instead of fixed delays.
  const until = (fn, arg) => P.waitForFunction(fn, arg, { timeout: 4000 }).then(() => true, () => false);
  const state = () => P.evaluate(() => window.__scaffold.state());
  const title = () => P.evaluate(() => document.querySelector('.mgb-menu h2')?.textContent ?? '');
  const focusItem = async (label) => {
    for (let i = 0; i < 8; i++) {
      const cur = await P.evaluate(() => document.querySelector('.mgb-menu .mgb-item.on')?.textContent ?? '');
      if (cur.startsWith(label)) return true;
      await P.keyboard.press('ArrowDown');
      await P.waitForTimeout(400);
    }
    return false;
  };
  await P.keyboard.press('Space');
  await P.keyboard.press('Escape');
  const escPaused = await until(() => window.__scaffold.state() === 'paused');
  const hintKb = await P.textContent('.mgb-menu .mgb-hint').catch(() => '');
  await focusItem('Juice dial');
  await P.keyboard.press('Space'); // Juice dial
  const inJuice = await until(() => document.querySelector('.mgb-menu h2')?.textContent === 'Juice dial');
  await P.keyboard.press('Escape'); // back to the main menu
  const backToMain = await until(() => document.querySelector('.mgb-menu h2')?.textContent === 'Paused' && window.__scaffold.state() === 'paused');
  await P.keyboard.press('Escape'); // resume
  const resumedKb = await until(() => window.__scaffold.state() === 'playing');
  check('Escape pauses, goes Back inside menus, then resumes', escPaused && inJuice && backToMain && resumedKb, `${escPaused} ${inJuice} ${backToMain} ${resumedKb}`);
  check('keyboard use switches hints to key names', /Space|Esc/.test(hintKb ?? '') && !/ A /.test(hintKb ?? ''), hintKb ?? '');

  // small screens: the pause menu must fit the viewport
  for (const vp of [{ width: 1366, height: 768 }, { width: 1024, height: 600 }]) {
    await P.setViewportSize(vp);
    await P.keyboard.press('Escape');
    await until(() => window.__scaffold.state() === 'paused');
    await focusItem('Juice dial');
    await P.keyboard.press('Space');
    await until(() => document.querySelector('.mgb-menu h2')?.textContent === 'Juice dial');
    const box = await P.evaluate(() => { const r = document.querySelector('.mgb-panel').getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), right: Math.round(r.right), h: innerHeight, w: innerWidth }; });
    await P.screenshot({ path: path.join(OUT, `screens/menu-${vp.width}x${vp.height}.png`) });
    check(`juice menu fits ${vp.width}x${vp.height}`, box.bottom > 0 && box.top >= -1 && box.bottom <= box.h + 1 && box.right <= box.w + 1, JSON.stringify(box));
    await P.keyboard.press('Escape');
    await until(() => document.querySelector('.mgb-menu h2')?.textContent === 'Paused');
    await P.keyboard.press('Escape');
    await until(() => window.__scaffold.state() === 'playing');
  }
  await P.setViewportSize({ width: 1280, height: 800 });

  // 8. return-to-launcher combo (hold Select+Start 0.5 s)
  await P.evaluate((b) => window.__setPad([0, 0, 0, 0], b), [BTN.select, BTN.start]);
  await P.waitForURL((u) => new URL(u).pathname === '/', { timeout: 4000 }).catch(() => {});
  await P.evaluate(() => window.__setPad([0, 0, 0, 0], [])).catch(() => {});
  check('Select+Start combo returns to the launcher', new URL(P.url()).pathname === '/', P.url());

  check('no console errors during whole run', L.errors.length === 0, L.errors.slice(0, 3).join(' | '));
} catch (e) {
  check('smoke test ran to completion', false, e instanceof Error ? e.message : String(e));
} finally {
  await browser.close();
  await srv.close();
}

const failed = results.filter((r) => !r.ok);
fs.writeFileSync(path.join(OUT, 'smoke-report.json'), JSON.stringify({ results, warnings: warn }, null, 2));
console.log(`\nsmoke: ${results.length - failed.length}/${results.length} passed${warn.length ? `, ${warn.length} warning(s)` : ''}`);
process.exit(failed.length ? 1 : 0);
