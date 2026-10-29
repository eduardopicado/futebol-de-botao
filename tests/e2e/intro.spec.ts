/* The flick on the start screen as the app opens (src/game/intro.ts): your
 * button flicks the ball along the line under "Botão" to its end; nothing
 * waits for it; and only then: not on coming back to the start screen, not
 * when the app opened on another screen, not under Reduce Motion. */

import { expect, test, type Page } from '@playwright/test';
import { noProblems, watchPage } from './helpers';

const intro = (page: Page) => page.locator('.home h1 .swash .intro');

/** where the ball stopped, and where the line under the word ends */
const ends = (page: Page) => page.evaluate(() => {
  const swash = document.querySelector('.home h1 .swash')!.getBoundingClientRect();
  const ball = document.querySelector('.home h1 .swash .intro circle:last-child')!.getBoundingClientRect();
  return { ball: ball.right, line: swash.left + swash.width * 0.98 };
});

test.describe('The flick as the app opens', () => {
  test('your button flicks the ball along the line under Botão, and it stops at the end', async ({ page }) => {
    const watch = watchPage(page);
    await page.goto('/');
    await expect(intro(page)).toBeAttached();
    /* the button goes once the ball has stopped; the ball stays, a full stop */
    await expect(intro(page).locator('g')).toHaveCount(0, { timeout: 5000 });
    const { ball, line } = await ends(page);
    expect(Math.abs(ball - line)).toBeLessThan(2);
    noProblems(watch);
  });

  test('nothing waits for it: a way to play can be tapped while it plays', async ({ page }) => {
    const watch = watchPage(page);
    await page.goto('/');
    await expect(intro(page).locator('g')).toHaveCount(1);
    await page.getByRole('link', { name: '🤖 1 player' }).click();
    await expect(page.getByRole('heading', { name: '1 player' })).toBeVisible();
    noProblems(watch);
  });

  test('not again on coming back to the start screen', async ({ page }) => {
    const watch = watchPage(page);
    await page.goto('/');
    await expect(intro(page)).toBeAttached();
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Back to the start' }).click();
    await expect(page.getByRole('link', { name: '🤖 1 player' })).toBeVisible();
    await page.waitForTimeout(800);
    await expect(intro(page)).toHaveCount(0);
    noProblems(watch);
  });

  test('not when the app opened on another screen', async ({ page }) => {
    const watch = watchPage(page);
    await page.goto('/#/treino');
    await page.getByRole('button', { name: 'Back to the start' }).click();
    await expect(page.getByRole('link', { name: '🤖 1 player' })).toBeVisible();
    await page.waitForTimeout(800);
    await expect(intro(page)).toHaveCount(0);
    noProblems(watch);
  });

  test.describe('under Reduce Motion', () => {
    test.use({ reducedMotion: 'reduce' });
    test('not at all', async ({ page }) => {
      const watch = watchPage(page);
      await page.goto('/');
      await expect(page.getByRole('link', { name: '🤖 1 player' })).toBeVisible();
      await page.waitForTimeout(800);
      await expect(intro(page)).toHaveCount(0);
      noProblems(watch);
    });
  });
});
