/* How to play: offered the first time, stepped through with every demo
 * played to its end, at either rule; turned down for good; and a demo left in
 * the middle goes no further. */

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { noProblems, recordSpeech, said, seed, watchPage } from './helpers';

const step = (page: Page) => page.locator('.guide');
const now = (page: Page) => page.locator('.guide-now');

/** the step's demo, watched to its end */
async function watched(page: Page, title: string): Promise<void> {
  await expect(page.locator('.guide-title')).toHaveText(title);
  await expect(step(page)).toHaveAttribute('data-demo', 'done', { timeout: 20000 });
}

test.describe('How to play', () => {
  test('the first time, the start screen offers it; every step is shown, and Got it goes back to the start', async ({ page }) => {
    const watch = watchPage(page);
    await recordSpeech(page);
    await page.goto('/');
    const offer = page.getByRole('group', { name: 'New here?' });
    await expect(offer).toBeVisible();
    await offer.getByRole('link', { name: '📖 How to play' }).click();
    await expect(page.getByRole('heading', { name: 'How to play', level: 1 })).toBeVisible();
    await expect(page.locator('.guide-count')).toHaveText('1 of 6');
    await expect(page.getByRole('button', { name: '← Back' })).toBeDisabled();
    await watched(page, 'Flick');
    expect((await said(page)).some((w) => w.startsWith('Flick. Put a finger on one of your buttons'))).toBe(true);
    const shown: Record<string, string> = {
      'Three touches': 'No touches left: their turn now.',
      'A gol!': 'GOL!',
      'Your goleiro': 'Saved! Your turn now.',
      Fouls: 'Foul! A free kick to them.',
      'Kick-off': 'Out of the circle. Their turn now.',
    };
    for (const [title, end] of Object.entries(shown)) {
      await page.getByRole('button', { name: 'Next →' }).click();
      await watched(page, title);
      await expect(now(page)).toHaveText(end);
    }
    await expect(page.locator('.guide-count')).toHaveText('6 of 6');
    await page.getByRole('button', { name: '✓ Got it' }).click();
    /* seen: no more offer, and the guide is still there below the ways to play */
    await expect(page.getByRole('link', { name: '🤖 1 player' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'New here?' })).toHaveCount(0);
    await expect(page.locator('.home-how').getByRole('link', { name: '📖 How to play' })).toBeVisible();
    noProblems(watch);
  });

  test('Not now: the offer goes, for good, and the guide waits below the ways to play', async ({ page }) => {
    const watch = watchPage(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Not now' }).click();
    await expect(page.getByRole('group', { name: 'New here?' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: '📖 How to play' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('link', { name: '🤖 1 player' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'New here?' })).toHaveCount(0);
    await page.getByRole('link', { name: '📖 How to play' }).click();
    await expect(page.locator('.guide-title')).toHaveText('Flick');
    noProblems(watch);
  });

  test('at 1 Toque: one touch a turn, the goleiro off its line, and no parking the ball', async ({ page }) => {
    const watch = watchPage(page);
    await seed(page, { rule: '1', goals: 5 });
    await page.goto('/#/how-to-play');
    await expect(page.locator('.guide-count')).toHaveText('1 of 7');
    /* the arrow keys step through too */
    await page.keyboard.press('ArrowRight');
    await watched(page, 'One touch');
    await expect(now(page)).toHaveText('One flick: their turn now.');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.guide-words')).toContainText('anywhere in its small area');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await watched(page, 'No parking');
    await expect(now(page)).toHaveText('Parked! A free kick to them.');
    await page.getByRole('button', { name: 'Next →' }).click();
    await expect(page.locator('.guide-words')).toContainText('First to 5 goals wins!');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('.guide-title')).toHaveText('No parking');
    noProblems(watch);
  });

  test('moving on in the middle of a demo stops it: nothing of it reaches the next step', async ({ page }) => {
    const watch = watchPage(page);
    await page.goto('/#/how-to-play');
    for (let i = 0; i < 4; i += 1) await page.keyboard.press('ArrowRight');
    await expect(page.locator('.guide-title')).toHaveText('Fouls');
    /* the foul under way: its arrow shown, then the flick playing */
    await expect(page.locator('.bt-arrow')).not.toHaveAttribute('points', '', { timeout: 5000 });
    await page.waitForTimeout(1300);
    /* every line the note shows, and every state of the demo, from here on */
    await page.evaluate(() => {
      const seen: string[] = [];
      (window as unknown as { __seen: string[] }).__seen = seen;
      const note = document.querySelector('.guide-now')!;
      const game = document.querySelector('.guide')!;
      new MutationObserver(() => seen.push(note.textContent ?? '')).observe(note, { childList: true, characterData: true, subtree: true });
      new MutationObserver(() => seen.push(`demo: ${(game as HTMLElement).dataset.demo}`)).observe(game, { attributes: true, attributeFilter: ['data-demo'] });
    });
    await page.getByRole('button', { name: 'Next →' }).click();
    await watched(page, 'Kick-off');
    await expect(page.locator('.bt-table')).toHaveCount(1);
    const seen = await page.evaluate(() => (window as unknown as { __seen: string[] }).__seen.filter((t) => t !== ''));
    expect(seen).toEqual(['demo: playing', '1 touch left.', 'Out of the circle. Their turn now.', 'demo: done']);
    /* ↺ Again starts it over */
    await page.getByRole('button', { name: '↺ Again' }).click();
    await expect(now(page)).toHaveText('');
    await expect(step(page)).toHaveAttribute('data-demo', 'playing');
    await expect(page.locator('.bt-btn.us.b3')).toHaveAttribute('data-y', '56.500');
    /* and leaving in the middle of one is clean */
    await page.getByRole('button', { name: 'Back to the start' }).click();
    await expect(page.getByRole('link', { name: '🤖 1 player' })).toBeVisible();
    await page.waitForTimeout(3000);
    noProblems(watch);
  });

  test('has no accessibility violations, the guide nor the offer', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('group', { name: 'New here?' })).toBeVisible();
    const home = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(home.violations.map((v) => v.id)).toEqual([]);
    await page.goto('/#/how-to-play');
    await expect(page.locator('.guide-title')).toHaveText('Flick');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});
