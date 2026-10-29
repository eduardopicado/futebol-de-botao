/* The launch images (tools/launch.ts): every one linked from index.html is
 * there, at its device's exact size; and they still look like the start
 * screen, so a changed start screen fails here until they are made again
 * (npm run build && npm run make:launch). */

import { readFile } from 'node:fs/promises';
import { expect, test, type Browser } from '@playwright/test';
import { DEVICES, ORIENTATIONS, launchFile, launchStyle, mediaOf, screenOf, type Device, type Orientation } from '../../tools/launch.ts';

/** the start screen as a launch image, rendered now */
async function render(browser: Browser, d: Device, o: Orientation): Promise<Buffer> {
  const { width, height } = screenOf(d, o);
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: d.dpr, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('fdb:guide-seen', 'true'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.addStyleTag({ content: launchStyle(d, o) });
  await page.evaluate(() => document.fonts.ready);
  const shot = await page.screenshot({ type: 'png' });
  await context.close();
  return shot;
}

/** how much of one picture differs from another: the share of 8 × 8 pixel
    squares whose average colour is more than 32 levels apart. JPEG keeps
    each square's average, and a font's smoothing hardly moves it, so neither
    counts; a word changed or a picture moved does */
async function difference(browser: Browser, a: Buffer, aType: string, b: Buffer, bType: string): Promise<number> {
  const page = await browser.newPage();
  const share = await page.evaluate(async ([a, b]) => {
    const pixels = async (src: string): Promise<{ data: Uint8ClampedArray; w: number; h: number }> => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const [w, h] = [Math.floor(img.naturalWidth / 8), Math.floor(img.naturalHeight / 8)];
      const canvas = new OffscreenCanvas(w, h);
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
      return { data: ctx.getImageData(0, 0, w, h).data, w, h };
    };
    const [p, q] = [await pixels(a), await pixels(b)];
    if (p.w !== q.w || p.h !== q.h) return 1;
    let off = 0;
    for (let i = 0; i < p.data.length; i += 4) {
      const d = Math.max(Math.abs(p.data[i] - q.data[i]), Math.abs(p.data[i + 1] - q.data[i + 1]), Math.abs(p.data[i + 2] - q.data[i + 2]));
      if (d > 32) off += 1;
    }
    return off / (p.w * p.h);
  }, [`data:${aType};base64,${a.toString('base64')}`, `data:${bType};base64,${b.toString('base64')}`]);
  await page.close();
  return share;
}

test.describe('Launch images', () => {
  test('every one is linked, for its own screen held its own way, and is that screen\'s exact size', async ({ page }) => {
    await page.goto('/');
    const links = await page.locator('link[rel="apple-touch-startup-image"]').evaluateAll((ls) => ls.map((l) => ({ media: l.getAttribute('media'), href: (l as HTMLLinkElement).href })));
    const expected = DEVICES.flatMap((d) => ORIENTATIONS.map((o) => ({ d, o })));
    expect(links).toHaveLength(expected.length);
    for (const { d, o } of expected) {
      const link = links.find((l) => l.media === mediaOf(d, o));
      expect(link, `${d.is}, ${o}`).toBeDefined();
      expect(link!.href.endsWith(launchFile(d, o))).toBe(true);
      const size = await page.evaluate(async (src) => { const img = new Image(); img.src = src; await img.decode(); return [img.naturalWidth, img.naturalHeight]; }, link!.href);
      expect(size, `${launchFile(d, o)} (${d.is})`).toEqual(screenOf(d, o).pixels);
    }
  });

  test('they still look like the start screen', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'ipad-portrait', 'renders its own screens: once is enough');
    test.setTimeout(120_000);
    const ipad = DEVICES.find((d) => d.w === 820 && d.h === 1180)!;
    const iphone = DEVICES.find((d) => d.w === 393 && d.h === 852)!;
    for (const [d, o] of [[ipad, 'portrait'], [iphone, 'landscape']] as const) {
      const saved = await readFile(`public/${launchFile(d, o)}`);
      const share = await difference(browser, await render(browser, d, o), 'image/png', saved, 'image/jpeg');
      testInfo.annotations.push({ type: 'difference', description: `${launchFile(d, o)}: ${(share * 100).toFixed(3)}%` });
      console.log(launchFile(d, o), share);
      /* a reworded tagline is about 0.1% of the squares; the same screen, none */
      expect(share, `${launchFile(d, o)} no longer looks like the start screen: npm run build && npm run make:launch`).toBeLessThan(0.0005);
    }
  });
});
