// Shared Playwright helpers: launch, fake gamepad, screenshots, non-blank check.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

export const FAKE_PAD_SCRIPT = `
  (() => {
    const pad = { axes: [0, 0, 0, 0], down: new Set() };
    window.__pad = pad;
    window.__setPad = (axes, down) => { pad.axes = axes || [0,0,0,0]; pad.down = new Set(down || []); };
    navigator.getGamepads = () => [{
      id: 'Fake Standard Pad', index: 0, connected: true, mapping: 'standard', timestamp: performance.now(),
      axes: pad.axes,
      buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pad.down.has(i), touched: pad.down.has(i), value: pad.down.has(i) ? 1 : 0 })),
    }];
  })();
`;

export const BTN = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, select: 8, start: 9 };

/** Find a usable Chromium binary when Playwright's own pinned download is absent (common in sandboxes). */
export function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  for (const base of [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers'].filter(Boolean)) {
    if (!fs.existsSync(base)) continue;
    for (const d of fs.readdirSync(base).filter((n) => /^chromium-\d+$/.test(n)).sort().reverse()) {
      for (const sub of ['chrome-linux64/chrome', 'chrome-linux/chrome']) {
        const f = path.join(base, d, sub);
        if (fs.existsSync(f)) return f;
      }
    }
  }
  return null;
}

export async function launchBrowser() {
  const args = ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  try {
    return await chromium.launch({ args });
  } catch (e) {
    const exe = findChromium();
    if (!exe) throw e;
    return chromium.launch({ args, executablePath: exe });
  }
}

export async function newPage(browser, { pad = true, viewport = { width: 1280, height: 800 } } = {}) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  if (pad) await page.addInitScript(FAKE_PAD_SCRIPT);
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()}`));
  return { page, errors, ctx };
}

/** Hold buttons (indices) for ms (must span at least one frame; software GL frames can take 100+ ms), optionally with stick axes, then release. */
export async function tap(page, buttons, ms = 300, axes = [0, 0, 0, 0]) {
  await page.evaluate(([b, a]) => window.__setPad(a, b), [buttons, axes]);
  await page.waitForTimeout(ms);
  await page.evaluate(() => window.__setPad([0, 0, 0, 0], []));
  // let the page poll the release before the next press, or two quick taps merge into one
  await page.waitForTimeout(450);
}

/** True when a PNG buffer has real content (several distinct colors), checked in a throwaway page. */
export async function pngIsNonBlank(browser, buf) {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  const result = await p.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = 160; c.height = 100;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, 160, 100);
    const d = g.getImageData(0, 0, 160, 100).data;
    const colors = new Set();
    for (let i = 0; i < d.length; i += 4) colors.add((d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | (d[i + 2] >> 4));
    return colors.size;
  }, buf.toString('base64'));
  await ctx.close();
  return result;
}
