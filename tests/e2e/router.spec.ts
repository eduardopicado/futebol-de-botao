/* The router when a screen goes wrong: its code cannot be fetched (an old
 * copy of the app, offline), it breaks as it opens, or it breaks as it is
 * left; a screen still loading when the player has gone somewhere else; and
 * an address the app does not know. A broken screen says Oops! with a way
 * back, never a blank page. */

import { expect, test, type Page } from '@playwright/test';
import { noProblems, watchPage } from './helpers';

/* the offline worker would answer the screens' code itself, out of the reach
   of page.route */
test.use({ serviceWorkers: 'block' });

const TREINO = '**/assets/treino-*.js';
const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

/** Treino's code, replaced by this */
async function treinoIs(page: Page, code: string): Promise<void> {
  await page.route(TREINO, (route) => route.fulfill({ contentType: 'text/javascript', body: code }));
}

test.describe('The router', () => {
  test('a screen whose code cannot be fetched says Oops!, says why in the console, and goes back to the start', async ({ page }) => {
    const watch = watchPage(page);
    await page.route(TREINO, (route) => route.abort());
    await page.goto('/');
    await page.getByRole('link', { name: '⚽ Treino' }).click();
    await expect(page.getByRole('heading', { name: 'Oops!' })).toBeVisible();
    await expect(page.locator('.route-error')).toContainText('That screen would not open.');
    expect(watch.errors.some((e) => e.startsWith('Could not open #/treino:'))).toBe(true);
    /* nothing went wrong but that */
    expect(watch.errors.filter((e) => !e.includes('treino'))).toEqual([]);
    await page.getByRole('button', { name: 'Back to the start' }).click();
    await expect(page.getByRole('link', { name: '🤖 1 player' })).toBeVisible();
    expect(watch.external).toEqual([]);
  });

  test('a screen that breaks as it opens says Oops! too', async ({ page }) => {
    const watch = watchPage(page);
    await treinoIs(page, 'export function mount() { throw new Error("broken on purpose"); }');
    await page.goto('/#/treino');
    await expect(page.getByRole('heading', { name: 'Oops!' })).toBeVisible();
    expect(watch.errors).toEqual([expect.stringMatching(/^Could not open #\/treino: .*broken on purpose/)]);
  });

  test('a screen that breaks as it is left does not stop the next one opening', async ({ page }) => {
    const watch = watchPage(page);
    await treinoIs(page, 'export function mount(root) { root.textContent = "a screen"; return () => { throw new Error("broken on the way out"); }; }');
    await page.goto('/#/treino');
    await expect(page.locator('main#app')).toHaveText('a screen');
    await page.evaluate(() => { location.hash = '#/settings'; });
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page.locator('main#app')).not.toContainText('a screen');
    noProblems(watch);
  });

  test('a screen still loading when the player has gone elsewhere is never put on the screen', async ({ page }) => {
    const watch = watchPage(page);
    let fetched = false;
    await page.route(TREINO, async (route) => { await sleep(1500); await route.continue(); fetched = true; });
    await page.goto('/');
    await page.getByRole('link', { name: '⚽ Treino' }).click();
    /* changed his mind while it loads */
    await page.evaluate(() => { location.hash = '#/settings'; });
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect.poll(() => fetched, { timeout: 5000 }).toBe(true);
    await page.waitForTimeout(500);
    await expect(page.locator('.bt-table')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    expect(await page.title()).toBe('Settings · Futebol de Botão');
    noProblems(watch);
  });

  test('an address the app does not know opens the start screen', async ({ page }) => {
    const watch = watchPage(page);
    await page.goto('/#/nowhere');
    await expect(page.getByRole('link', { name: '🤖 1 player' })).toBeVisible();
    expect(await page.title()).toBe('Futebol de Botão');
    noProblems(watch);
  });
});
