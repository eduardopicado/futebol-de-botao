/* Partida: two players on one iPad. Real finger drags through the table's
   viewBox; a match set up on the device (match-setup) where a test needs the
   ball somewhere in particular. */

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { expectTapTargets, noProblems, seed, watchPage } from './helpers';
import { KEEPER_Y, PULL, VIEW, oneTouch, type Flick, type Point } from '../../src/content/botao';
import type { Match, Side } from '../../src/content/match';

const sel = (side: Side, i: number): string => (side === 'a' ? `.bt-btn.us.b${i}` : `.bt-btn.them.t${i}`);

/** where a table point is on the screen */
async function screen(page: Page, p: Point): Promise<{ x: number; y: number; scale: number }> {
  const box = (await page.locator('.bt-table').boundingBox())!;
  const scale = box.width / VIEW.w;
  return { x: box.x + (p.x - VIEW.x) * scale, y: box.y + (p.y - VIEW.y) * scale, scale };
}

async function where(page: Page, side: Side, i: number): Promise<Point> {
  const b = page.locator(sel(side, i));
  return { x: Number(await b.getAttribute('data-x')), y: Number(await b.getAttribute('data-y')) };
}

/** a finger on the button, pulled back the way that gives this flick (as on the screen), let go */
async function flick(page: Page, side: Side, i: number, vx: number, vy: number): Promise<void> {
  const { x, y, scale } = await screen(page, await where(page, side, i));
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - (vx / PULL) * scale, y - (vy / PULL) * scale, { steps: 6 });
  await page.mouse.up();
}

/** far out of the way, for buttons a test does not need */
const parked = (side: Side): Point[] => [
  { x: 6, y: side === 'a' ? 92 : 6 }, { x: 58, y: side === 'a' ? 92 : 6 },
  { x: 6, y: side === 'a' ? 76 : 22 }, { x: 58, y: side === 'a' ? 76 : 22 }, { x: 58, y: side === 'a' ? 60 : 38 },
];

/** side a with the ball in front of b's goal, its button behind it, in ordinary play */
const chance = (extra: Partial<Match> = {}): Partial<Match> => ({
  turn: 'a', phase: 'play', touches: 0, used: [], attack: true, penalty: false, out: [],
  ball: { x: 32, y: 30 }, a: [{ x: 32, y: 42 }, ...parked('a').slice(1)], b: parked('b'),
  keepers: { a: 32, b: 32 }, ...extra,
});

async function open(page: Page, setup?: Partial<Match>): Promise<void> {
  if (setup) await seed(page, { 'match-setup': setup });
  await page.goto('/#/partida');
  await expect(page.locator('.bt-btn.us')).toHaveCount(setup?.a?.length ?? 4);
}

const game = (page: Page) => page.locator('.game');

test.describe('Partida', () => {
  test('starts with a coin toss, then the kick-off: four a side, two goleiros, all of it on the screen', async ({ page }) => {
    const watch = watchPage(page);
    await page.goto('/');
    await page.getByRole('link', { name: '👥 2 players' }).click();
    await page.getByRole('button', { name: '▶ Kick off' }).click();
    await expect(game(page)).toHaveAttribute('data-phase', 'toss');
    await expect(page.locator('.toss')).toContainText('Kick-off:');
    await expect(game(page)).toHaveAttribute('data-phase', 'kickoff', { timeout: 6000 });
    await expect(page.locator('.bt-btn.us')).toHaveCount(4);
    await expect(page.locator('.bt-btn.them')).toHaveCount(4);
    await expect(page.locator('.bt-keeper.home')).toBeVisible();
    await expect(page.locator('.bt-keeper.away')).toBeVisible();
    await expect(page.locator('.bt-say')).toContainText('Kick-off:');
    await expect(game(page)).toHaveAttribute('data-score', '0-0');
    const size = page.viewportSize()!;
    const table = (await page.locator('.bt-table').boundingBox())!;
    expect(table.y).toBeGreaterThanOrEqual(0);
    expect(table.y + table.height).toBeLessThanOrEqual(size.height);
    expect(table.x + table.width).toBeLessThanOrEqual(size.width);
    expect(await page.evaluate(() => document.scrollingElement!.scrollHeight)).toBeLessThanOrEqual(size.height);
    /* the note faces whoever kicks off: turned round for the side at the top */
    const turn = (await game(page).getAttribute('data-turn')) as Side;
    await expect(page.locator('.bt-say')).toHaveClass(turn === 'b' ? /flip/ : /^(?!.*flip)/);
    await expectTapTargets(page, '.game button');
    noProblems(watch);
  });

  test('kick-off: the second flick is by another button, and a ball left in the circle is kicked off again', async ({ page }) => {
    const watch = watchPage(page);
    await open(page);
    await expect(game(page)).toHaveAttribute('data-phase', 'kickoff', { timeout: 6000 });
    const s = (await game(page).getAttribute('data-turn')) as Side;
    /* back towards its own goal: away from the ball */
    const back = s === 'a' ? 12 : -12;
    await flick(page, s, 0, 0, back);
    await expect(game(page)).toHaveAttribute('data-touches', '1', { timeout: 6000 });
    /* the same button again: not at a kick-off */
    await flick(page, s, 0, 0, back);
    await expect(page.locator('.bt-say')).toContainText('the second flick is by another button');
    await expect(game(page)).toHaveAttribute('data-touches', '1');
    await flick(page, s, 1, 0, back);
    await expect(game(page)).toHaveAttribute('data-event', 'retake', { timeout: 6000 });
    await expect(page.locator('.bt-say')).toContainText('kick off again');
    await expect(game(page)).toHaveAttribute('data-phase', 'kickoff');
    await expect(game(page)).toHaveAttribute('data-turn', s);
    await expect(game(page)).toHaveAttribute('data-touches', '0', { timeout: 6000 });
    noProblems(watch);
  });

  test('"A gol!": called, the goleiro slid along the line and Pronto, and the shot past him scores', async ({ page }) => {
    const watch = watchPage(page);
    await open(page, chance());
    await page.getByRole('button', { name: '📣 A gol!' }).click();
    await expect(game(page)).toHaveAttribute('data-phase', 'placing');
    /* the note turns to face the defender, at the top */
    await expect(page.locator('.bt-say')).toHaveClass(/flip/);
    await expect(page.locator('.bt-keeper.away')).toHaveClass(/placing/);
    /* their goleiro slid to its left post */
    const from = await screen(page, { x: 32, y: (KEEPER_Y[0] + KEEPER_Y[1]) / 2 });
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x - 10 * from.scale, from.y, { steps: 6 });
    await page.mouse.up();
    const keeper = Number(await page.locator('.bt-keeper.away').getAttribute('data-x'));
    expect(keeper).toBeLessThan(26);
    await page.getByRole('button', { name: '✋ Pronto' }).click();
    await expect(game(page)).toHaveAttribute('data-phase', 'shot');
    await expect(page.locator('.bt-say')).not.toHaveClass(/flip/);
    /* a's button, aimed past him */
    const plan = oneTouch({ ball: { x: 32, y: 30 }, us: [{ x: 32, y: 42 }], them: parked('b'), keeper }, [0], false)!;
    const f: Flick = plan.flicks[0];
    await flick(page, 'a', 0, f.vx, f.vy);
    await expect(game(page)).toHaveAttribute('data-event', 'goal', { timeout: 10000 });
    await expect(game(page)).toHaveAttribute('data-score', '1-0');
    await expect(page.locator('.bt-say')).toContainText('GOL!');
    /* and the side that conceded kicks off */
    await expect(game(page)).toHaveAttribute('data-phase', 'kickoff', { timeout: 6000 });
    await expect(game(page)).toHaveAttribute('data-turn', 'b');
    noProblems(watch);
  });

  test('a goal not called does not count: a goal kick to the other side', async ({ page }) => {
    const watch = watchPage(page);
    await open(page, chance({ keepers: { a: 32, b: 23 } }));
    await flick(page, 'a', 0, 0, -90);
    await expect(game(page)).toHaveAttribute('data-event', 'uncalled', { timeout: 10000 });
    await expect(page.locator('.bt-say')).toContainText('not called');
    await expect(game(page)).toHaveAttribute('data-score', '0-0');
    await expect(game(page)).toHaveAttribute('data-turn', 'b');
    noProblems(watch);
  });

  test('a foul: knocking one of theirs before the ball is a free kick to them', async ({ page }) => {
    const watch = watchPage(page);
    await open(page, chance({
      ball: { x: 32, y: 40 }, a: [{ x: 32, y: 66 }, ...parked('a').slice(1)], b: [{ x: 32, y: 54 }, ...parked('b').slice(1)], attack: false,
    }));
    await flick(page, 'a', 0, 0, -50);
    await expect(game(page)).toHaveAttribute('data-event', 'foul', { timeout: 10000 });
    await expect(page.locator('.bt-say')).toContainText('Foul! Free kick to');
    await expect(game(page)).toHaveAttribute('data-turn', 'b');
    noProblems(watch);
  });

  test('the turn passes when a flick misses the ball: the other side glows, and the note turns to face them', async ({ page }) => {
    const watch = watchPage(page);
    await open(page, chance());
    await expect(page.locator('.bt-table')).toHaveClass(/turn-a/);
    /* a's back button, nudged sideways, nowhere near the ball */
    await flick(page, 'a', 1, -15, 0);
    await expect(game(page)).toHaveAttribute('data-turn', 'b', { timeout: 8000 });
    await expect(page.locator('.bt-say')).toContainText('The ball did not move.');
    await expect(page.locator('.bt-say')).toHaveClass(/flip/);
    await expect(page.locator('.bt-table')).toHaveClass(/turn-b/, { timeout: 4000 });
    noProblems(watch);
  });

  test('full time: ↺ Replay the goal plays the winning goal again, the table uncovered while it plays', async ({ page }) => {
    const watch = watchPage(page);
    await open(page, chance({ score: { a: 2, b: 0 }, keepers: { a: 32, b: 23 } }));
    await page.getByRole('button', { name: '📣 A gol!' }).click();
    await page.getByRole('button', { name: '✋ Pronto' }).click();
    const keeper = Number(await page.locator('.bt-keeper.away').getAttribute('data-x'));
    const plan = oneTouch({ ball: { x: 32, y: 30 }, us: [{ x: 32, y: 42 }], them: parked('b'), keeper }, [0], false)!;
    await flick(page, 'a', 0, plan.flicks[0].vx, plan.flicks[0].vy);
    await expect(game(page)).toHaveAttribute('data-phase', 'over', { timeout: 10000 });
    await page.getByRole('button', { name: '↺ Replay the goal' }).click();
    await expect(game(page)).toHaveAttribute('data-replay', '');
    await expect(page.locator('.bt-overlay')).toBeHidden();
    await expect(game(page)).not.toHaveAttribute('data-replay', /.*/, { timeout: 10000 });
    await expect(page.locator('.win')).toBeVisible();
    noProblems(watch);
  });

  test('after a goal, ↺ Replay holds the kick-off until it has played', async ({ page }) => {
    const watch = watchPage(page);
    await open(page, chance({ keepers: { a: 32, b: 23 } }));
    await page.getByRole('button', { name: '📣 A gol!' }).click();
    await page.getByRole('button', { name: '✋ Pronto' }).click();
    const keeper = Number(await page.locator('.bt-keeper.away').getAttribute('data-x'));
    const plan = oneTouch({ ball: { x: 32, y: 30 }, us: [{ x: 32, y: 42 }], them: parked('b'), keeper }, [0], false)!;
    await flick(page, 'a', 0, plan.flicks[0].vx, plan.flicks[0].vy);
    await expect(game(page)).toHaveAttribute('data-event', 'goal', { timeout: 10000 });
    await page.getByRole('button', { name: '↺ Replay' }).click();
    await expect(page.locator('.say-words')).toContainText('↺ Replay. GOL!');
    await expect(game(page)).toHaveAttribute('data-phase', 'kickoff');
    await expect(game(page)).not.toHaveAttribute('data-replay', /.*/, { timeout: 10000 });
    /* and then the side that conceded kicks off */
    await expect(page.locator('.say-words')).toContainText('Kick-off:', { timeout: 6000 });
    await expect(page.getByRole('button', { name: '↺ Replay' })).toHaveCount(0);
    noProblems(watch);
  });

  test('the last goal wins: É campeão!, and Play again starts a new match', async ({ page }) => {
    const watch = watchPage(page);
    await open(page, chance({ score: { a: 2, b: 0 }, keepers: { a: 32, b: 23 } }));
    await page.getByRole('button', { name: '📣 A gol!' }).click();
    await page.getByRole('button', { name: '✋ Pronto' }).click();
    const keeper = Number(await page.locator('.bt-keeper.away').getAttribute('data-x'));
    const plan = oneTouch({ ball: { x: 32, y: 30 }, us: [{ x: 32, y: 42 }], them: parked('b'), keeper }, [0], false)!;
    await flick(page, 'a', 0, plan.flicks[0].vx, plan.flicks[0].vy);
    await expect(game(page)).toHaveAttribute('data-phase', 'over', { timeout: 10000 });
    await expect(page.locator('.win')).toContainText('É campeão!');
    await expect(page.locator('.win')).toContainText('3 – 0');
    await expect(game(page)).toHaveAttribute('data-winner', 'a');
    await page.getByRole('button', { name: '🔁 Play again' }).click();
    await expect(game(page)).toHaveAttribute('data-phase', 'kickoff', { timeout: 6000 });
    await expect(game(page)).toHaveAttribute('data-score', '0-0');
    noProblems(watch);
  });

  test('1 toque: one flick a turn, and a ball left parked between your own buttons is a free kick to them', async ({ page }) => {
    const watch = watchPage(page);
    /* the ball in the gap between two of a's buttons, the note says so */
    await open(page, chance({
      rule: '1', attack: false, ball: { x: 33, y: 60 },
      a: [{ x: 26, y: 60 }, { x: 40, y: 60 }, { x: 33, y: 76 }, ...parked('a').slice(3)],
    }));
    await expect(page.locator('.bt-say')).toContainText('one flick');
    await expect(page.locator('.bt-say')).toContainText('The ball is parked between two of your buttons');
    await expect(page.locator('.bt-pip')).toHaveCount(1);
    /* a's far button, nudged: the ball is still parked */
    await flick(page, 'a', 4, 0, 15);
    await expect(game(page)).toHaveAttribute('data-event', 'parked', { timeout: 8000 });
    await expect(page.locator('.bt-say')).toContainText('Parked ball! Free kick to');
    await expect(game(page)).toHaveAttribute('data-turn', 'b');
    noProblems(watch);
  });

  test('1 toque: after a flick that moves the ball, it is the other side\'s turn', async ({ page }) => {
    const watch = watchPage(page);
    await open(page, chance({ rule: '1', attack: false, ball: { x: 32, y: 60 }, a: [{ x: 32, y: 72 }, ...parked('a').slice(1)] }));
    await flick(page, 'a', 0, 0, -40);
    await expect(game(page)).toHaveAttribute('data-turn', 'b', { timeout: 8000 });
    await expect(game(page)).toHaveAttribute('data-touches', '0');
    noProblems(watch);
  });

  test('the players: a number on each rim, the name while a button is held, and the scorer in the goal', async ({ page }) => {
    const watch = watchPage(page);
    await seed(page, { 'team-a': 'brazil', 'team-b': 'argentina', 'match-setup': chance({ keepers: { a: 32, b: 23 } }) });
    await page.goto('/#/partida');
    await expect(page.locator('.bt-btn.us')).toHaveCount(5);
    /* Brazil's first button, at the back on the left: Marquinhos, 4; Argentina's forward: Messi, 10 */
    await expect(page.locator('.bt-btn.us.b0 .bt-number')).toHaveText('4');
    await expect(page.locator('.bt-btn.them.t4 .bt-number')).toHaveText('10');
    /* held, its number and name above it; let go without a pull, gone */
    const at = await screen(page, await where(page, 'a', 0));
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await expect(page.locator('.bt-tag')).toBeVisible();
    await expect(page.locator('.bt-tag-text')).toHaveText('4 · Marquinhos');
    await page.mouse.up();
    await expect(page.locator('.bt-tag')).toBeHidden();
    /* and when he scores, the note says so */
    await page.getByRole('button', { name: '📣 A gol!' }).click();
    await page.getByRole('button', { name: '✋ Pronto' }).click();
    const keeper = Number(await page.locator('.bt-keeper.away').getAttribute('data-x'));
    const plan = oneTouch({ ball: { x: 32, y: 30 }, us: [{ x: 32, y: 42 }], them: parked('b'), keeper }, [0], false)!;
    await flick(page, 'a', 0, plan.flicks[0].vx, plan.flicks[0].vy);
    await expect(game(page)).toHaveAttribute('data-event', 'goal', { timeout: 10000 });
    await expect(page.locator('.say-words')).toContainText('GOL! Marquinhos (4),');
    noProblems(watch);
  });

  test('has no accessibility violations', async ({ page }) => {
    await open(page, chance());
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});
