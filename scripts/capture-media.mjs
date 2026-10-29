#!/usr/bin/env node
// Capture launcher media for a prototype: a short GIF of it being played, and the thumbnail from the same footage.
//   npm run media -- <slug> [--seconds 4] [--fps 20] [--search 45] [--width 420] [--no-thumb]
// Plays the prototype's greedy bot through the shell's capture mode, which moves time one exact frame at a time
// (see stepFrames in src/core/shell.ts), so the footage is a smooth, fixed frame rate no matter how slow the
// browser's renderer is. Pass 1 plays without drawing to find the busiest window (most sim events); pass 2 replays
// to that window and screenshots every captured frame. Writes src/protos/<slug>/preview.gif and thumb.png. Needs ffmpeg.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const slug = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && !['--no-thumb'].includes(args[i - 1])));
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : def;
};
if (!slug) { console.error('usage: npm run media -- <slug> [--seconds 4] [--fps 20] [--search 45] [--width 420] [--no-thumb]'); process.exit(1); }
const WINDOW = opt('seconds', 4);
const SEARCH = opt('search', 45);
const WIDTH = opt('width', 420);
const FPS = Math.max(5, Math.min(30, opt('fps', 20)));
const SUB = Math.round(60 / FPS); // 60 Hz sim frames per captured frame
const W = Math.round(WINDOW * FPS);

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

/** A fresh page in capture mode with the bot reset; `tick()` plays one captured frame and returns the events seen so far. */
async function session() {
  const { page } = await newPage(browser);
  await page.goto(`${srv.url}/p/${slug}/?seed=1`);
  await page.waitForFunction(() => window.__scaffold, null, { timeout: 15000 });
  await page.evaluate(() => { window.__scaffold.start(); window.__scaffold.captureMode(true); });
  bot.reset(1);
  let n = 0;
  return {
    page,
    /** Play one captured frame; `draw` false skips rendering (fast-forward). Rendering only the frames that are screenshotted keeps the GPU queue empty so screenshots never stall behind a backlog. */
    async tick(draw = false) {
      const { obs, events } = await page.evaluate(() => {
        const s = window.__scaffold;
        const fired = s.snapshot().feel?.eventsFired ?? {};
        return { obs: s.proto.getState?.() ?? s.proto.telemetry(), events: Object.values(fired).reduce((a, b) => a + b, 0) };
      });
      const b = bot.act(obs, n++);
      await page.evaluate(([inp, sub, draw]) => { window.__scaffold.input.inject({ left: inp.left, right: inp.right, hold: inp.hold }); window.__scaffold.stepFrames(sub, draw ? 'last' : 'none'); }, [b, SUB, draw]);
      return events;
    },
  };
}

try {
  // pass 1: play without screenshots, noting how many sim events have happened at each captured frame
  const a = await session();
  const events = [];
  for (let i = 0; i < SEARCH * FPS; i++) events.push(await a.tick());
  await a.page.close();
  if (events.length < W + 3 * FPS) throw new Error('search window too short for the requested clip');

  // busiest window, ignoring the first 3 s
  let best = { score: -1, start: 3 * FPS };
  for (let i = 3 * FPS; i + W < events.length; i++) {
    const score = events[i + W] - events[i];
    if (score > best.score) best = { score, start: i };
  }
  console.log(`window ${(best.start / FPS).toFixed(1)}s to ${((best.start + W) / FPS).toFixed(1)}s, ${W} frames at ${FPS} fps, ${best.score} events`);

  // pass 2: replay to the window and screenshot every captured frame
  const b = await session();
  for (let i = 0; i < best.start; i++) await b.tick();
  const files = [];
  for (let k = 0; k < W; k++) {
    await b.tick(true);
    const file = path.join(tmp, `f${String(k).padStart(4, '0')}.jpg`);
    // a software-GL browser can be slow to hand back a frame; give it time, and one retry, before giving up
    try { await b.page.screenshot({ path: file, type: 'jpeg', quality: 90, timeout: 90000 }); }
    catch { await b.page.screenshot({ path: file, type: 'jpeg', quality: 90, timeout: 90000 }); }
    files.push(file);
  }

  const outDir = path.join(ROOT, 'src/protos', slug);
  const gif = path.join(outDir, 'preview.gif');
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(FPS), '-i', path.join(tmp, 'f%04d.jpg'),
    '-vf', `scale=${WIDTH}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`,
    '-loop', '0', gif]);
  console.log(`preview.gif: ${(fs.statSync(gif).size / 1024).toFixed(0)} KB, ${W} frames at ${FPS} fps`);

  if (!args.includes('--no-thumb')) {
    // the frame with the biggest event jump inside the window makes the thumbnail
    let pick = Math.floor(W / 2);
    let jump = -1;
    for (let k = 1; k < W; k++) {
      const d = events[best.start + k + 1] - events[best.start + k];
      if (d > jump) { jump = d; pick = k; }
    }
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', files[pick], path.join(outDir, 'thumb.png')]);
    console.log('thumb.png written');
  }
} finally {
  await browser.close();
  await srv.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
