/* The Copa: picking a team, the three rounds, a tie played against the
   computer and counted at full time, the trophy, and going out. A cup put on
   the device part-way through (cup), and a match set up on the table
   (match-setup), where a test needs one flick to decide a tie. */

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { noProblems, seed, watchPage } from './helpers';
import { PULL, VIEW, oneTouch, type Point } from '../../src/content/botao';
import type { Match, Side } from '../../src/content/match';

async function screen(page: Page, p: Point): Promise<{ x: number; y: number; scale: number }> {
  const box = (await page.locator('.bt-table').boundingBox())!;
  const scale = box.width / VIEW.w;
  return { x: box.x + (p.x - VIEW.x) * scale, y: box.y + (p.y - VIEW.y) * scale, scale };
}

/** a's first button, pulled back the way that gives this flick, let go */
async function flick(page: Page, vx: number, vy: number): Promise<void> {
  const b = page.locator('.bt-btn.us.b0');
  const { x, y, scale } = await screen(page, { x: Number(await b.getAttribute('data-x')), y: Number(await b.getAttribute('data-y')) });
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - (vx / PULL) * scale, y - (vy / PULL) * scale, { steps: 6 });
  await page.mouse.up();
}

const parked = (side: Side): Point[] => [
  { x: 6, y: side === 'a' ? 92 : 6 }, { x: 58, y: side === 'a' ? 92 : 6 },
  { x: 6, y: side === 'a' ? 76 : 22 }, { x: 58, y: side === 'a' ? 76 : 22 }, { x: 58, y: side === 'a' ? 60 : 38 },
];

/** your side with the ball in front of their goal, one goal from winning */
const winning = (): Partial<Match> => ({
  turn: 'a', phase: 'play', touches: 0, used: [], attack: true, penalty: false, out: [],
  ball: { x: 32, y: 30 }, a: [{ x: 32, y: 42 }, ...parked('a').slice(1)], b: parked('b'),
  keepers: { a: 32, b: 23 }, score: { a: 2, b: 0 },
});

/** your side one goal from losing, the ball by your own goal and your button above it */
const losing = (): Partial<Match> => ({
  turn: 'a', phase: 'play', touches: 0, used: [], attack: false, penalty: false, out: [],
  ball: { x: 32, y: 88 }, a: [{ x: 32, y: 76 }, ...parked('a').slice(1).map((p) => ({ x: p.x, y: p.y - 30 }))], b: parked('b'),
  keepers: { a: 50, b: 32 }, score: { a: 0, b: 2 },
});

const cup = (results: { us: number; them: number }[]) => ({ team: 'brazil', opponents: ['spain', 'italy', 'france'], results });

test.describe('Copa', () => {
  test('from the start screen: pick a team, the three rounds are drawn, and the quarter-final is played against the first', async ({ page }) => {
    const watch = watchPage(page);
    await page.goto('/');
    await page.getByRole('link', { name: '🏆 Copa' }).click();
    await expect(page.locator('.copa-intro')).toContainText('Three matches against the computer');
    await page.getByRole('link', { name: '▶ Pick your team' }).click();
    await expect(page.getByRole('heading', { name: '🏆 Copa' })).toBeVisible();
    /* only your own team: the cup draws the rest */
    await expect(page.getByRole('group')).toHaveCount(1);
    await page.getByRole('group', { name: 'Your team' }).getByRole('button', { name: 'Brazil' }).click();
    await page.getByRole('button', { name: '▶ Start the Copa' }).click();
    await expect(page.locator('.copa-round')).toHaveCount(3);
    await expect(page.locator('.copa-round').first()).toHaveClass(/next/);
    await expect(page.locator('.copa-round').first()).toContainText('Quarter-final');
    await expect(page.locator('.copa-round').first()).toContainText('Easy');
    await expect(page.locator('.copa-round').last()).toContainText('Hard');
    const first = await page.evaluate(() => JSON.parse(localStorage.getItem('fdb:cup')!).opponents[0] as string);
    await page.getByRole('link', { name: '▶ Play the quarter-final' }).click();
    await expect(page.getByRole('heading', { name: 'Quarter-final' })).toBeVisible();
    await expect(page.locator('.bt-table')).toHaveAttribute('aria-label', /, the computer,/);
    /* leaving before full time does not count: the quarter-final is still to play */
    await page.getByRole('button', { name: 'Back to the Copa' }).click();
    await expect(page.locator('.copa-round').first()).toHaveClass(/next/);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('fdb:cup')!).opponents[0])).toBe(first);
    noProblems(watch);
  });

  test('the final won: the trophy, and one more cup won', async ({ page }) => {
    const watch = watchPage(page);
    await seed(page, { cup: cup([{ us: 3, them: 1 }, { us: 3, them: 2 }]), goals: 3, 'match-setup': winning() });
    await page.goto('/#/copa-jogo');
    await expect(page.getByRole('heading', { name: 'Final' })).toBeVisible();
    await page.getByRole('button', { name: '📣 A gol!' }).click();
    await expect(page.locator('.game')).toHaveAttribute('data-phase', 'placing');
    await expect(page.locator('.game')).toHaveAttribute('data-phase', 'shot', { timeout: 8000 });
    const keeper = Number(await page.locator('.bt-keeper.away').getAttribute('data-x'));
    const plan = oneTouch({ ball: { x: 32, y: 30 }, us: [{ x: 32, y: 42 }], them: parked('b'), keeper }, [0], false)!;
    await flick(page, plan.flicks[0].vx, plan.flicks[0].vy);
    await expect(page.locator('.game')).toHaveAttribute('data-phase', 'over', { timeout: 10000 });
    await expect(page.locator('.win')).toContainText('É campeão!');
    await page.getByRole('button', { name: '🏆 Back to the Copa' }).click();
    await expect(page.locator('.copa')).toHaveAttribute('data-stage', 'won');
    await expect(page.locator('.copa-trophy')).toContainText('won the Copa');
    await expect(page.locator('.copa-round.won')).toHaveCount(3);
    await expect(page.locator('.copa-tally')).toHaveText('Cups won on this iPad: 1');
    noProblems(watch);
  });

  test('a tie won takes you through to the next round', async ({ page }) => {
    const watch = watchPage(page);
    await seed(page, { cup: cup([]), goals: 3, 'match-setup': winning() });
    await page.goto('/#/copa-jogo');
    await page.getByRole('button', { name: '📣 A gol!' }).click();
    await expect(page.locator('.game')).toHaveAttribute('data-phase', 'shot', { timeout: 8000 });
    const keeper = Number(await page.locator('.bt-keeper.away').getAttribute('data-x'));
    const plan = oneTouch({ ball: { x: 32, y: 30 }, us: [{ x: 32, y: 42 }], them: parked('b'), keeper }, [0], false)!;
    await flick(page, plan.flicks[0].vx, plan.flicks[0].vy);
    await expect(page.locator('.win')).toContainText('Through to the semi-final!', { timeout: 10000 });
    await page.getByRole('button', { name: '🏆 Back to the Copa' }).click();
    await expect(page.locator('.copa-round').first()).toHaveClass(/won/);
    await expect(page.locator('.copa-round').first()).toContainText('Won 3 – 0');
    await expect(page.locator('.copa-round').nth(1)).toHaveClass(/next/);
    await expect(page.getByRole('link', { name: '▶ Play the semi-final' })).toBeVisible();
    noProblems(watch);
  });

  test('a tie lost puts you out, and a new cup can be started', async ({ page }) => {
    const watch = watchPage(page);
    await seed(page, { cup: cup([]), goals: 3, 'match-setup': losing() });
    await page.goto('/#/copa-jogo');
    /* your button, straight down into your own net */
    await flick(page, 0, 90);
    await expect(page.locator('.win')).toContainText('Out of the Copa', { timeout: 10000 });
    await page.getByRole('button', { name: '🏆 Back to the Copa' }).click();
    await expect(page.locator('.copa')).toHaveAttribute('data-stage', 'out');
    await expect(page.locator('.copa-out')).toContainText('Out in the quarter-final.');
    await expect(page.locator('.copa-round').first()).toContainText('Lost 0 – 3');
    await page.getByRole('link', { name: '▶ Start a new cup' }).click();
    await expect(page.getByRole('button', { name: '▶ Start the Copa' })).toBeVisible();
    noProblems(watch);
  });

  test('with no tie to play, the match screen sends you to the Copa instead', async ({ page }) => {
    const watch = watchPage(page);
    await seed(page, { cup: cup([{ us: 3, them: 1 }, { us: 0, them: 3 }]) });
    await page.goto('/#/copa-jogo');
    await expect(page.locator('.copa')).toHaveAttribute('data-stage', 'out');
    await expect(page.locator('.bt-table')).toHaveCount(0);
    noProblems(watch);
  });

  test('has no accessibility violations', async ({ page }) => {
    await seed(page, { cup: cup([{ us: 3, them: 1 }]) });
    await page.goto('/#/copa');
    await expect(page.locator('.copa-round')).toHaveCount(3);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});
