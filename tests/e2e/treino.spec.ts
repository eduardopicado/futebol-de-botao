/* Treino: pull a button back, let go, and score in three touches. Real finger
   drags through the table's viewBox. */

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { expectTapTargets, noProblems, seed, watchPage } from './helpers';
import { PULL, VIEW, type Flick } from '../../src/content/botao';

async function start(page: Page): Promise<void> {
  await page.goto('/#/treino');
  await expect(page.locator('.bt-btn.us')).toHaveCount(3);
}

/** where a button is on the screen, from where it is on the table */
async function onScreen(page: Page, button: number): Promise<{ x: number; y: number; scale: number }> {
  const box = (await page.locator('.bt-table').boundingBox())!;
  const scale = box.width / VIEW.w;
  const b = page.locator(`.bt-btn.b${button}`);
  const x = Number(await b.getAttribute('data-x'));
  const y = Number(await b.getAttribute('data-y'));
  return { x: box.x + (x - VIEW.x) * scale, y: box.y + (y - VIEW.y) * scale, scale };
}

/** a finger on the button, pulled back the way that gives this flick, let go */
async function flick(page: Page, f: Flick): Promise<void> {
  const { x, y, scale } = await onScreen(page, f.button);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - (f.vx / PULL) * scale, y - (f.vy / PULL) * scale, { steps: 6 });
  await page.mouse.up();
}

const plan = async (page: Page): Promise<Flick[]> => JSON.parse((await page.locator('.game').getAttribute('data-plan'))!);

/** nothing guide-like on the table */
async function clearTable(page: Page): Promise<void> {
  await expect(page.locator('.bt-arrow')).toHaveAttribute('points', '');
  await expect(page.locator('.bt-path')).toHaveAttribute('points', '');
  await expect(page.locator('.bt-trail')).toHaveAttribute('points', '');
  await expect(page.locator('.bt-ghost')).toBeHidden();
}

test.describe('Treino', () => {
  test('from the start screen onto the table: it all fits, with nothing to scroll, the words above the table', async ({ page }) => {
    const watch = watchPage(page);
    await page.goto('/');
    await page.getByRole('link', { name: '⚽ Treino' }).click();
    await expect(page.locator('.bt-btn.us')).toHaveCount(3);
    await expect(page.locator('.bt-btn.them')).toHaveCount(3);
    await expect(page.locator('.bt-keeper')).toBeVisible();
    await expectTapTargets(page, '.game button');
    const size = page.viewportSize()!;
    const table = (await page.locator('.bt-table').boundingBox())!;
    expect(table.y).toBeGreaterThanOrEqual(0);
    expect(table.y + table.height).toBeLessThanOrEqual(size.height);
    expect(table.x).toBeGreaterThanOrEqual(0);
    expect(table.x + table.width).toBeLessThanOrEqual(size.width);
    /* big enough to play on */
    expect(table.height).toBeGreaterThan(size.height * 0.5);
    const showMe = (await page.getByRole('button', { name: '👀 Show me' }).boundingBox())!;
    expect(showMe.y + showMe.height).toBeLessThanOrEqual(size.height);
    const words = (await page.locator('.bt-say').boundingBox())!;
    expect(words.y + words.height).toBeLessThanOrEqual(table.y);
    await expect(page.locator('.bt-say')).toContainText('Three touches to score!');
    expect(await page.evaluate(() => document.scrollingElement!.scrollHeight)).toBeLessThanOrEqual(size.height);
    noProblems(watch);
  });

  test('pull back, let go, and the ball goes in: GOL!', async ({ page }) => {
    const watch = watchPage(page);
    await start(page);
    const flicks = await plan(page);
    for (const [i, f] of flicks.entries()) {
      await flick(page, f);
      if (i < flicks.length - 1) await expect(page.locator('.bt-say')).toContainText('touches left', { timeout: 10000 });
    }
    await expect(page.locator('.game')).toHaveAttribute('data-goal', 'scored', { timeout: 10000 });
    await expect(page.locator('.bt-say')).toHaveText(flicks.length === 1 ? 'GOL! In one touch!' : `GOL! In ${flicks.length} touches.`);
    await expect(page.locator('.score')).toContainText('1');
    await clearTable(page);
    /* and a new one is set up */
    await expect(page.locator('.game')).not.toHaveAttribute('data-goal', /./, { timeout: 6000 });
    await expect(page.locator('.game')).toHaveAttribute('data-touches', '0');
    noProblems(watch);
  });

  /* the pull counts from where the finger came down: one resting on the
     edge of a button is no pull, and lifting it is no flick */
  test('a finger resting on a button, anywhere on it, sends nothing anywhere', async ({ page }) => {
    const watch = watchPage(page);
    await start(page);
    const { x, y, scale } = await onScreen(page, 1);
    const edge = y + 3.5 * scale;
    await page.mouse.move(x, edge);
    await page.mouse.down();
    await page.mouse.move(x + 0.5, edge + 0.5);
    await expect(page.locator('.bt-arrow')).toHaveAttribute('points', '');
    await page.mouse.up();
    await page.waitForTimeout(300);
    await expect(page.locator('.game')).toHaveAttribute('data-touches', '0');
    /* pulled back from there, the arrow and the start of the ball's way
       show; brought back and let go, still nothing, and nothing left drawn */
    await page.mouse.move(x, edge);
    await page.mouse.down();
    await page.mouse.move(x, edge + 8 * scale, { steps: 4 });
    await expect(page.locator('.bt-arrow')).not.toHaveAttribute('points', '');
    await page.mouse.move(x, edge, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    await expect(page.locator('.game')).toHaveAttribute('data-touches', '0');
    await clearTable(page);
    noProblems(watch);
  });

  test('a finger the system takes away (pointercancel) is no flick', async ({ page }) => {
    await start(page);
    const { x, y, scale } = await onScreen(page, 0);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 12 * scale, { steps: 4 });
    await expect(page.locator('.bt-arrow')).not.toHaveAttribute('points', '');
    await page.locator('.bt-table').dispatchEvent('pointercancel', { pointerId: 1, isPrimary: true, pointerType: 'mouse' });
    await clearTable(page);
    await page.mouse.up();
    await page.waitForTimeout(300);
    await expect(page.locator('.game')).toHaveAttribute('data-touches', '0');
  });

  test('three touches, the third by another button; then a new one is set up', async ({ page }) => {
    const watch = watchPage(page);
    await start(page);
    const game = page.locator('.game');
    /* his back button, nudged back towards his own end, away from the ball */
    for (const n of [1, 2]) {
      await flick(page, { button: 1, vx: 0, vy: 20 });
      await expect(game).toHaveAttribute('data-touches', String(n));
      await expect(page.locator('.bt-say')).toContainText(`${3 - n} touch`, { timeout: 8000 });
    }
    await expect(page.locator('.bt-say')).toContainText('You missed the ball.');
    await expect(page.locator('.bt-say')).toContainText('has to be another button');
    await expect(page.locator('.bt-btn.b1')).toHaveClass(/tired/);
    /* the same button a third time: not allowed */
    await flick(page, { button: 1, vx: 0, vy: 20 });
    await expect(page.locator('.bt-say')).toHaveText('That button has had two touches. Use another one!');
    await expect(game).toHaveAttribute('data-touches', '2');
    /* the other back one: that was the last touch */
    await flick(page, { button: 2, vx: 0, vy: 20 });
    await expect(page.locator('.bt-say')).toContainText('No touches left.', { timeout: 8000 });
    await expect(game).toHaveAttribute('data-touches', '0', { timeout: 6000 });
    await expect(page.locator('.bt-btn.tired')).toHaveCount(0);
    noProblems(watch);
  });

  test('Show me plays a way to score, then clears the table and sets up a new one', async ({ page }) => {
    const watch = watchPage(page);
    await start(page);
    await page.getByRole('button', { name: '👀 Show me' }).click();
    await expect(page.locator('.bt-say')).toHaveText('Watch: here is one way.');
    await expect(page.locator('.bt-ghost')).toBeVisible({ timeout: 4000 });
    await expect(page.locator('.bt-path')).not.toHaveAttribute('points', '');
    await expect(page.locator('.game')).toHaveAttribute('data-goal', 'shown', { timeout: 20000 });
    await clearTable(page);
    await expect(page.locator('.score')).toContainText('0');
    await expect(page.locator('.game')).not.toHaveAttribute('data-goal', /./, { timeout: 8000 });
    noProblems(watch);
  });

  test('has no accessibility violations', async ({ page }) => {
    await start(page);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});

test.describe('the start screen and the grown-ups', () => {
  test('a tap on Grown-ups does nothing; held for three seconds it opens, and his team sticks', async ({ page }) => {
    const watch = watchPage(page);
    await page.goto('/');
    const hold = page.getByRole('button', { name: /Grown-ups/ });
    await hold.click();
    await expect(page.locator('.home')).toBeVisible();
    await hold.hover();
    await page.mouse.down();
    await page.waitForTimeout(3300);
    await page.mouse.up();
    await expect(page.getByRole('heading', { name: 'Grown-ups' })).toBeVisible();
    await page.getByLabel('His team').selectOption('brazil');
    await page.getByLabel('Playing against').selectOption('argentina');
    await page.getByRole('button', { name: 'Back to the start' }).click();
    await expect(page.locator('.versus')).toContainText('Brazil');
    await expect(page.locator('.versus')).toContainText('Argentina');
    noProblems(watch);
  });

  test('his team plays in its colours on the table, and the rival in theirs', async ({ page }) => {
    await seed(page, { team: 'brazil', rival: 'argentina' });
    await start(page);
    await expect(page.locator('.bt-btn.us .bt-face').first()).toHaveAttribute('fill', '#FFD500');
    await expect(page.locator('.bt-btn.them .bt-face').first()).toHaveAttribute('fill', '#75AADB');
    await expect(page.locator('.bt-say')).toContainText('🇧🇷 Brazil against 🇦🇷 Argentina');
  });

  test('the built page refuses every other origin', async ({ page }) => {
    await page.goto('/');
    const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("connect-src 'self'");
  });
});
