/* The settings behind the ⚙, and picking teams before a match. */

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { noProblems, recordSpeech, said, seed, watchPage } from './helpers';

test.describe('Settings', () => {
  test('the ⚙ opens them; goals to win and the computer level stick, and a match is played to them', async ({ page }) => {
    const watch = watchPage(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await page.getByRole('button', { name: '5 goals' }).click();
    await page.getByRole('button', { name: 'Hard' }).click();
    await expect(page.getByRole('button', { name: '5 goals' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: '3 goals' })).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('button', { name: 'Back to the start' }).click();
    expect(await page.evaluate(() => [localStorage.getItem('fdb:goals'), localStorage.getItem('fdb:level')])).toEqual(['5', '"hard"']);
    /* and they are there the next time */
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('button', { name: '5 goals' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Hard' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Back to the start' }).click();
    await page.getByRole('link', { name: '👥 2 players' }).click();
    await page.getByRole('button', { name: '▶ Kick off' }).click();
    await expect(page.locator('.toss')).toContainText('First to 5 goals');
    noProblems(watch);
  });

  test('buttons a side: four unless five is picked, and a match is played with them', async ({ page }) => {
    const watch = watchPage(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('button', { name: '4 and a goleiro' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: '5 and a goleiro' }).click();
    expect(await page.evaluate(() => localStorage.getItem('fdb:buttons'))).toBe('5');
    await page.getByRole('button', { name: 'Back to the start' }).click();
    await page.getByRole('link', { name: '👥 2 players' }).click();
    await page.getByRole('button', { name: '▶ Kick off' }).click();
    await expect(page.locator('.game')).toHaveAttribute('data-phase', 'kickoff', { timeout: 6000 });
    await expect(page.locator('.bt-btn.us')).toHaveCount(5);
    await expect(page.locator('.bt-btn.them')).toHaveCount(5);
    noProblems(watch);
  });

  test('the words are read aloud, unless that is turned off', async ({ page }) => {
    await recordSpeech(page);
    await page.goto('/#/treino');
    await expect(page.locator('.bt-say')).toContainText('Pull back a button');
    await expect.poll(async () => (await said(page)).join(' ')).toContain('Pull back a button');
  });

  test('turned off, the words are not read aloud', async ({ page }) => {
    await recordSpeech(page);
    await seed(page, { 'read-aloud': false, 'football-narration': 'off' });
    await page.goto('/#/treino');
    await expect(page.locator('.bt-say')).toContainText('Pull back a button');
    await page.waitForTimeout(500);
    expect(await said(page)).toEqual([]);
  });

  test('has no accessibility violations', async ({ page }) => {
    await page.goto('/#/settings');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});

test.describe('Picking teams', () => {
  test('1 player: your team and the computer\'s, kept for next time, and the match plays in their colours', async ({ page }) => {
    const watch = watchPage(page);
    await page.goto('/');
    await page.getByRole('link', { name: '🤖 1 player' }).click();
    const yours = page.getByRole('group', { name: 'Your team' });
    const theirs = page.getByRole('group', { name: 'The computer plays' });
    await yours.getByRole('button', { name: 'Brazil' }).click();
    await expect(yours.getByRole('button', { name: 'Brazil' })).toHaveAttribute('aria-pressed', 'true');
    /* the computer cannot play as Brazil too */
    await expect(theirs.getByRole('button', { name: 'Brazil' })).toBeDisabled();
    await theirs.getByRole('button', { name: 'Argentina' }).click();
    await page.getByRole('button', { name: '▶ Kick off' }).click();
    await expect(page).toHaveURL(/#\/computador$/);
    await expect(page.locator('.match-score')).toContainText('🇧🇷');
    await expect(page.locator('.match-score')).toContainText('🇦🇷');
    await expect(page.locator('.bt-btn.us .bt-face').first()).toHaveAttribute('fill', '#FFD500');
    await expect(page.locator('.bt-btn.them .bt-face').first()).toHaveAttribute('fill', '#75AADB');
    /* kept: the same picks next time */
    await page.goto('/#/teams-1');
    await expect(yours.getByRole('button', { name: 'Brazil' })).toHaveAttribute('aria-pressed', 'true');
    await expect(theirs.getByRole('button', { name: 'Argentina' })).toHaveAttribute('aria-pressed', 'true');
    noProblems(watch);
  });

  test('says so when the two picked look alike on the table', async ({ page }) => {
    await page.goto('/#/teams-2');
    await page.getByRole('group', { name: 'Player at the bottom' }).getByRole('button', { name: 'Liverpool' }).click();
    await page.getByRole('group', { name: 'Player at the top' }).getByRole('button', { name: 'Manchester United' }).click();
    await expect(page.locator('.pick-warn')).toContainText('look alike');
  });

  test('"Change teams" at full time goes back to picking them', async ({ page }) => {
    /* side a one goal from winning, the ball in front of b's goal and b's goleiro aside */
    const parked = (side: 'a' | 'b'): { x: number; y: number }[] => [
      { x: 6, y: side === 'a' ? 92 : 6 }, { x: 58, y: side === 'a' ? 92 : 6 },
      { x: 6, y: side === 'a' ? 76 : 22 }, { x: 58, y: side === 'a' ? 76 : 22 }, { x: 58, y: side === 'a' ? 60 : 38 },
    ];
    await seed(page, { 'match-setup': {
      turn: 'a', phase: 'play', touches: 0, used: [], attack: true, penalty: false, out: [], score: { a: 2, b: 0 },
      ball: { x: 32, y: 30 }, a: [{ x: 32, y: 42 }, ...parked('a').slice(1)], b: parked('b'), keepers: { a: 32, b: 23 },
    } });
    await page.goto('/#/partida');
    await page.getByRole('button', { name: '📣 A gol!' }).click();
    await page.getByRole('button', { name: '✋ Pronto' }).click();
    /* straight up the middle, past the goleiro standing at the post */
    const box = (await page.locator('.bt-table').boundingBox())!;
    const { VIEW, PULL } = await import('../../src/content/botao');
    const scale = box.width / VIEW.w;
    const [x, y] = [box.x + (32 - VIEW.x) * scale, box.y + (42 - VIEW.y) * scale];
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + (90 / PULL) * scale, { steps: 6 });
    await page.mouse.up();
    await expect(page.locator('.win')).toContainText('É campeão!', { timeout: 10000 });
    await page.getByRole('button', { name: 'Change teams' }).click();
    await expect(page).toHaveURL(/#\/teams-2$/);
    await expect(page.getByRole('button', { name: '▶ Kick off' })).toBeVisible();
  });

  test('has no accessibility violations', async ({ page }) => {
    await page.goto('/#/teams-1');
    await expect(page.getByRole('button', { name: '▶ Kick off' })).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});
