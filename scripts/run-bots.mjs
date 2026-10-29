#!/usr/bin/env node
// Run the bot suite for one prototype and write full logs to runs/<slug>/. Prints a few summary lines.
//   npm run bots -- <slug> [--seconds 120] [--seeds 1,2,3] [--shots] [--thumb]
// Sim-only bots need no browser. --shots builds the site, plays the prototype in real time with the
// greedy bot (and idle) in headless Chromium and saves 1280x800 screenshots + realtime telemetry.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSuite } from '../src/bots/suite.ts';
import { validateTelemetry } from '../src/bots/telemetry.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith('--'));
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
if (!slug) { console.error('usage: npm run bots -- <slug> [--seconds 120] [--seeds 1,2,3] [--shots] [--thumb]'); process.exit(1); }

const mod = await import(path.join(ROOT, 'src/protos', slug, 'index.ts'));
const seeds = opt('seeds', '1,2,3').split(',').map(Number);
const outDir = path.join(ROOT, 'runs', slug, 'telemetry');
fs.mkdirSync(outDir, { recursive: true });

const suite = runSuite(mod.createPrototype, mod.bots ?? [], { seeds, maxSimSeconds: Number(opt('seconds', '120')), night: slug });
let bad = 0;
for (const r of suite.runs) {
  const errs = validateTelemetry(r.telemetry);
  if (errs.length) { bad++; console.error(`telemetry invalid (${r.telemetry.bot}): ${errs[0]}`); }
  const base = `${r.telemetry.bot}-seed${r.telemetry.seed}`;
  fs.writeFileSync(path.join(outDir, `${base}.json`), JSON.stringify(r.telemetry, null, 2));
  fs.writeFileSync(path.join(outDir, `${base}.inputs.json`), JSON.stringify({ seed: r.telemetry.seed, bot: r.telemetry.bot, inputLog: r.inputLog }));
}
console.log(suite.summary.join('\n'));
console.log(suite.flags.length ? 'FLAGS:\n  ' + suite.flags.join('\n  ') : 'flags: none');
console.log(`logs: runs/${slug}/telemetry/ (${suite.runs.length} runs)`);

if (args.includes('--shots') || args.includes('--thumb')) {
  const { execFileSync } = await import('node:child_process');
  execFileSync('node', ['scripts/build-site.mjs', '--out', 'dist-site', '--protos', slug], { cwd: ROOT, stdio: 'pipe' });
  const { launchBrowser, newPage } = await import('../tests/lib/browser.mjs');
  const { serveDir } = await import('../tests/lib/server.mjs');
  const srv = await serveDir(path.join(ROOT, 'dist-site'));
  const browser = await launchBrowser();
  const shotDir = path.join(ROOT, 'runs', slug, 'screens');
  fs.mkdirSync(shotDir, { recursive: true });
  try {
    const { page, errors } = await newPage(browser);
    await page.goto(`${srv.url}/p/${slug}/?seed=1`);
    await page.waitForFunction(() => window.__scaffold, null, { timeout: 15000 });
    await page.screenshot({ path: path.join(shotDir, '1-start.png') });
    await page.evaluate(() => { window.__scaffold.start(); });
    const greedy = (mod.bots ?? []).find((b) => b.name === 'greedy');
    if (greedy) await page.evaluate(() => 0);
    // Bots run inside Node; drive the page by feeding act() output as injected input each 100 ms.
    if (greedy) {
      greedy.reset(1);
      const t0 = Date.now();
      let tick = 0;
      while (Date.now() - t0 < 12000) {
        const obs = await page.evaluate(() => window.__scaffold.proto.getState?.() ?? window.__scaffold.proto.telemetry());
        const bi = greedy.act(obs, tick++);
        await page.evaluate((b) => window.__scaffold.input.inject({ left: b.left, right: b.right, hold: b.hold }), bi);
        await page.waitForTimeout(50);
        if (Date.now() - t0 > 6000 && !fs.existsSync(path.join(shotDir, '2-mid.png'))) await page.screenshot({ path: path.join(shotDir, '2-mid.png') });
      }
    } else await page.waitForTimeout(6000);
    await page.screenshot({ path: path.join(shotDir, '3-late.png') });
    await page.evaluate(() => window.__scaffold.input.inject(null));
    await page.waitForTimeout(15000); // idle: let pressure build
    await page.screenshot({ path: path.join(shotDir, '4-pressure.png') });
    const snap = await page.evaluate(() => window.__scaffold.snapshot('realtime-greedy'));
    fs.writeFileSync(path.join(outDir, 'realtime.json'), JSON.stringify(snap, null, 2));
    console.log(`realtime: ${snap.perf.fps} fps (avg frame ${snap.perf.avgFrameMs}ms), console errors: ${errors.length}`);
    if (args.includes('--thumb')) {
      fs.copyFileSync(path.join(shotDir, '2-mid.png'), path.join(ROOT, 'src/protos', slug, 'thumb.png'));
      console.log('thumbnail written to src/protos/' + slug + '/thumb.png');
    }
    console.log(`screenshots: runs/${slug}/screens/`);
  } finally {
    await browser.close();
    await srv.close();
  }
}
process.exit(bad ? 1 : 0);
