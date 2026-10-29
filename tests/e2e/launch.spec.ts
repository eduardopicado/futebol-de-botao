/* The launch images (tools/launch.ts): every one linked from index.html is
 * there, at its device's exact size; and they still show the start screen as
 * it is: what it draws, and where, is what make:launch saw when it made them
 * (tools/launch-drawn.json), so a changed start screen fails here until they
 * are made again (npm run build && npm run make:launch). Compared that way,
 * not by the pixels, which differ a little from one build of Chromium to the
 * next. */

import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { DEVICES, DRAWN, ORIENTATIONS, drawn, launchFile, launchStyle, mediaOf, screenOf } from '../../tools/launch.ts';

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

  test('they still show the start screen as it is', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'ipad-portrait', 'renders its own screens: once is enough');
    test.setTimeout(120_000);
    const saved = JSON.parse(await readFile(DRAWN, 'utf8')) as Record<string, string[]>;
    expect(Object.keys(saved).sort()).toEqual(DEVICES.flatMap((d) => ORIENTATIONS.map((o) => launchFile(d, o))).sort());
    /* an iPad and an iPhone, each way up: the start screen's four layouts */
    const ipad = DEVICES.find((d) => d.w === 820 && d.h === 1180)!;
    const iphone = DEVICES.find((d) => d.w === 393 && d.h === 852)!;
    for (const d of [ipad, iphone]) {
      for (const o of ORIENTATIONS) {
        const { width, height } = screenOf(d, o);
        const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: d.dpr, reducedMotion: 'reduce', serviceWorkers: 'block' });
        const page = await context.newPage();
        await page.goto('/');
        await page.evaluate(() => localStorage.setItem('fdb:guide-seen', 'true'));
        await page.reload({ waitUntil: 'networkidle' });
        await page.addStyleTag({ content: launchStyle(d, o) });
        await page.evaluate(() => document.fonts.ready);
        const now = await page.evaluate(drawn);
        await context.close();
        expect(now, `${launchFile(d, o)} no longer shows the start screen as it is: npm run build && npm run make:launch`).toEqual(saved[launchFile(d, o)]);
      }
    }
  });
});
