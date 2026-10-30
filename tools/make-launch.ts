/* Renders the launch images (tools/launch.ts) from the built app into
 * public/launch/: the start screen at each iPad's and iPhone's exact size,
 * held each way, with nothing to tap on it.
 *
 *   npm run build && npm run make:launch
 *
 * Run it again whenever the start screen changes; the launch test
 * (tests/e2e/launch.spec.ts) fails until it is: it compares what the screen
 * draws, and where, with tools/launch-drawn.json, which it writes. JPEG, at a quality where
 * the board's chalk and the desk's grain still look like themselves: a
 * fraction of a PNG's size. */

import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { preview } from 'vite';
import { DEVICES, DRAWN, ORIENTATIONS, drawn, launchFile, launchStyle, screenOf } from './launch.ts';

const QUALITY = 70;

const server = await preview({ preview: { port: 0, strictPort: false }, logLevel: 'warn' });
const origin = server.resolvedUrls?.local[0] ?? 'http://localhost:4173/';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM && existsSync(process.env.PLAYWRIGHT_CHROMIUM) ? process.env.PLAYWRIGHT_CHROMIUM : undefined;
const browser = await chromium.launch({ executablePath });
await mkdir('public/launch', { recursive: true });
/** what each image shows, by its name */
const shown: Record<string, string[]> = {};

try {
  for (const d of DEVICES) {
    for (const o of ORIENTATIONS) {
      const { width, height } = screenOf(d, o);
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: d.dpr, reducedMotion: 'reduce', serviceWorkers: 'block' });
      await page.goto(origin);
      await page.evaluate(() => localStorage.setItem('fdb:guide-seen', 'true'));
      await page.reload({ waitUntil: 'networkidle' });
      await page.addStyleTag({ content: launchStyle(d, o) });
      await page.evaluate(() => document.fonts.ready);
      const file = `public/${launchFile(d, o)}`;
      await page.screenshot({ path: file, type: 'jpeg', quality: QUALITY });
      shown[launchFile(d, o)] = await page.evaluate(drawn);
      await page.close();
      console.log(file, `(${d.is})`);
    }
  }
  await writeFile(DRAWN, `${JSON.stringify(shown, null, 1)}\n`);
} finally {
  await browser.close();
  await server.close();
}
