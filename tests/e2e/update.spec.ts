/* The "new version" button, with the real offline worker.
 *
 * The built app is served here from its own little server, as GitHub Pages
 * serves it, so a test can put the next version up the way a deploy does: a
 * sw.js a byte different. The app finds it when it comes back to the front,
 * says so, and keeps running the old one until the tap; the tap swaps the new
 * one in and reloads. (The browser fetches a worker's script itself, where
 * Playwright's routing cannot reach it, hence the server.) */

import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import { expect, test } from '@playwright/test';
import { noProblems, watchPage } from './helpers';

const DIST = fileURLToPath(new URL('../../dist', import.meta.url));
const TYPES: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg',
};

let server: Server;
let origin = '';
/** the next version has been put up */
let deployed = false;
/** when the browser last asked for sw.js */
let swAsked = 0;

const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

/** a couple of seconds after a page loads, the browser checks for a new
    worker by itself: wait for that check (up to ten seconds, in case this
    browser makes none) and for quiet after it, so that what finds the next
    version is the app's own check */
async function settled(since: number): Promise<void> {
  for (let i = 0; i < 40 && swAsked <= since; i += 1) await sleep(250);
  for (let i = 0; i < 40 && Date.now() - swAsked < 1500; i += 1) await sleep(250);
}

test.beforeAll(async () => {
  server = createServer((req, res) => {
    void (async () => {
      const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname));
      const file = join(DIST, path.endsWith('/') ? `${path}index.html` : path);
      if (!file.startsWith(DIST)) { res.writeHead(403).end(); return; }
      try {
        let body: Buffer | string = await readFile(file);
        if (path === '/sw.js') {
          swAsked = Date.now();
          if (deployed) body = `${body}\n// the next version\n`;
        }
        res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' }).end(body);
      } catch {
        res.writeHead(404).end();
      }
    })();
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  origin = `http://localhost:${(server.address() as AddressInfo).port}`;
});
test.afterAll(async () => { await new Promise((done) => server.close(done)); });
test.beforeEach(() => { deployed = false; swAsked = 0; });

test('a new version is found when the app comes back to the front, waits for a tap, and the tap swaps it in', async ({ page }) => {
  const watch = watchPage(page, origin);
  await page.goto(`${origin}/`);
  await expect(page.getByRole('link', { name: '🤖 1 player' })).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  /* opened again, as a player coming back does: now the worker runs the app */
  const reopened = Date.now();
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const button = page.getByRole('button', { name: '✨ New version! Tap to update' });
  await settled(reopened);
  /* nothing new yet: coming back to the front finds nothing */
  const asked = Date.now();
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await settled(asked);
  await expect(button).toHaveCount(0);

  deployed = true;
  /* the new version is up, but nothing has looked yet */
  await page.waitForTimeout(1500);
  await expect(button).toHaveCount(0);
  /* back to the front, as after the iPad has been asleep */
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(button).toBeVisible();
  /* waiting for the tap: the new worker waits, the old one still runs the app */
  expect(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())!.waiting)).toBe(true);
  await page.evaluate(() => { (window as unknown as { before: boolean }).before = true; });

  /* the tap reloads the page, into the new version */
  const reloaded = page.waitForEvent('load', { timeout: 10_000 });
  await button.click();
  await reloaded;
  expect(await page.evaluate(() => (window as unknown as { before?: boolean }).before ?? false)).toBe(false);
  await expect(page.getByRole('link', { name: '🤖 1 player' })).toBeVisible();
  await expect(button).toHaveCount(0);
  expect(await page.evaluate(async () => {
    const r = (await navigator.serviceWorker.getRegistration())!;
    return { waiting: !!r.waiting, controlled: !!navigator.serviceWorker.controller };
  })).toEqual({ waiting: false, controlled: true });
  noProblems(watch);
});
