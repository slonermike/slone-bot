#!/usr/bin/env node
// Capture launcher media for a prototype: a short GIF of it being played, and the thumbnail from the same footage.
//   npm run media -- <slug> [--seconds 4] [--search 45] [--width 420] [--no-thumb]
// Drives the prototype's greedy bot in real time, records frames, picks the busiest window (most sim events),
// then writes src/protos/<slug>/preview.gif and thumb.png. Needs ffmpeg on PATH.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith('--'));
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : def;
};
if (!slug) { console.error('usage: npm run media -- <slug> [--seconds 4] [--search 45] [--width 420] [--no-thumb]'); process.exit(1); }
const WINDOW = opt('seconds', 4);
const SEARCH = opt('search', 45);
const WIDTH = opt('width', 420);

try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); } catch { console.error('ffmpeg not found; skipping media capture'); process.exit(2); }

const mod = await import(pathToFileURL(path.join(ROOT, 'src/protos', slug, 'index.ts')).href);
const bot = (mod.bots ?? []).find((b) => b.name === 'greedy');
if (!bot) { console.error(`src/protos/${slug}/index.ts exports no "greedy" bot`); process.exit(1); }

execFileSync('node', ['scripts/build-site.mjs', '--out', 'dist-site', '--protos', slug], { cwd: ROOT, stdio: 'pipe' });
const { launchBrowser, newPage } = await import('../tests/lib/browser.mjs');
const { serveDir } = await import('../tests/lib/server.mjs');
const srv = await serveDir(path.join(ROOT, 'dist-site'));
const browser = await launchBrowser();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mgb-media-'));

try {
  const { page } = await newPage(browser);
  await page.goto(`${srv.url}/p/${slug}/?seed=1`);
  await page.waitForFunction(() => window.__scaffold, null, { timeout: 15000 });
  await page.evaluate(() => window.__scaffold.start());
  bot.reset(1);

  // Frames come from the browser's screencast (cheap, timestamped), not per-frame screenshots, which
  // are far too slow under software rendering. Event counts are sampled alongside by the bot loop.
  const cdp = await page.context().newCDPSession(page);
  const frames = []; // { t ms, file }
  const samples = []; // { t ms, events }
  let base = null;
  cdp.on('Page.screencastFrame', async (f) => {
    const ts = f.metadata.timestamp * 1000; // epoch ms, same clock as Date.now()
    base ??= ts;
    const file = path.join(tmp, `f${String(frames.length).padStart(5, '0')}.jpg`);
    fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
    frames.push({ t: ts - base, wall: ts, file });
    await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 85, maxWidth: 640, maxHeight: 400, everyNthFrame: 1 });
  const t0 = Date.now();
  let tick = 0;
  while (Date.now() - t0 < SEARCH * 1000) {
    const { obs, events } = await page.evaluate(() => {
      const s = window.__scaffold;
      const fired = s.snapshot().feel?.eventsFired ?? {};
      return { obs: s.proto.getState?.() ?? s.proto.telemetry(), events: Object.values(fired).reduce((a, b) => a + b, 0) };
    });
    const bi = bot.act(obs, tick++);
    await page.evaluate((b) => window.__scaffold.input.inject({ left: b.left, right: b.right, hold: b.hold }), bi);
    if (base !== null) samples.push({ wall: Date.now(), events });
    await page.waitForTimeout(40);
  }
  await cdp.send('Page.stopScreencast').catch(() => {});
  await page.evaluate(() => window.__scaffold.input.inject(null));
  if (frames.length < 8) throw new Error('too few frames captured');
  // total sim events seen by the time each frame was shown
  for (const f of frames) f.events = samples.findLast((x) => x.wall <= f.wall)?.events ?? 0;
  console.log(`${frames.length} frames over ${(frames.at(-1).t / 1000).toFixed(1)}s, ${frames.at(-1).events} events`);

  // busiest window: most sim events inside it, ignoring the first 3 s (boot) unless the run is short
  const from = frames.findIndex((f) => f.t >= 3000);
  let best = { score: -1, a: Math.max(0, from), b: Math.max(0, from) };
  for (let a = Math.max(0, from); a < frames.length; a++) {
    let b = a;
    while (b + 1 < frames.length && frames[b + 1].t - frames[a].t <= WINDOW * 1000) b++;
    if (frames[b].t - frames[a].t < WINDOW * 1000 * 0.9) break;
    const score = frames[b].events - frames[a].events;
    if (score > best.score) best = { score, a, b };
  }
  const clip = frames.slice(best.a, best.b + 1);
  console.log(`window ${(clip[0].t / 1000).toFixed(1)}s to ${(clip.at(-1).t / 1000).toFixed(1)}s, ${clip.length} frames, ${best.score} events`);

  // real timing: each frame lasts until the next one
  const list = clip.map((f, i) => `file '${f.file}'\nduration ${(((clip[i + 1]?.t ?? f.t + 100) - f.t) / 1000).toFixed(3)}`).join('\n');
  fs.writeFileSync(path.join(tmp, 'list.txt'), list + `\nfile '${clip.at(-1).file}'\n`);
  const outDir = path.join(ROOT, 'src/protos', slug);
  const gif = path.join(outDir, 'preview.gif');
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'),
    '-vf', `fps=12,scale=${WIDTH}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`,
    '-loop', '0', gif]);
  console.log(`preview.gif: ${(fs.statSync(gif).size / 1024).toFixed(0)} KB`);

  if (!args.includes('--no-thumb')) {
    // the frame with the biggest event jump inside the window makes the thumbnail
    let pick = clip[Math.floor(clip.length / 2)];
    let jump = -1;
    for (let i = 1; i < clip.length; i++) if (clip[i].events - clip[i - 1].events > jump) { jump = clip[i].events - clip[i - 1].events; pick = clip[i]; }
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', pick.file, path.join(outDir, 'thumb.png')]);
    console.log('thumb.png written');
  }
} finally {
  await browser.close();
  await srv.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
