/* Partida: two players on one iPad. Real finger drags through the table's
   viewBox; a match set up on the device (match-setup) where a test needs the
   ball somewhere in particular. */

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { expectTapTargets, noProblems, plays, recordPlays, recordSpeech, said, seed, watchPage } from './helpers';
import { BALL, GOLEIROS, L, LINE, MARKS, MOUTH, NET, PULL, R, VIEW, W, oneTouch, simulate, type Flick, type Point } from '../../src/content/botao';
import { onTheLine, type Match, type Side } from '../../src/content/match';
import { PT_CALL, PT_POSTS } from '../../src/content/commentary';
import { clipId } from '../../src/lib/clip-id';

const [G3, G1] = [GOLEIROS['3'], GOLEIROS['1']];

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

async function open(page: Page, setup?: Partial<Match>, settings: Record<string, unknown> = {}): Promise<void> {
  if (setup) await seed(page, { 'match-setup': setup, ...settings });
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

  test('kick-off: the second flick is by another button, and a ball that did not go forward is kicked off again', async ({ page }) => {
    const watch = watchPage(page);
    await open(page);
    await expect(game(page)).toHaveAttribute('data-phase', 'kickoff', { timeout: 6000 });
    const s = (await game(page).getAttribute('data-turn')) as Side;
    /* back towards its own goal: away from the ball */
    const back = s === 'a' ? 12 : -12;
    await flick(page, s, 0, 0, back);
    await expect(game(page)).toHaveAttribute('data-touches', '1', { timeout: 6000 });
    /* the button that made the first flick no longer glows; the others do */
    await expect(page.locator(sel(s, 0))).toHaveClass(/spent/);
    await expect(page.locator(sel(s, 1))).not.toHaveClass(/spent/);
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
    /* kicked off again: every button may make the first flick */
    await expect(page.locator('.bt-btn.spent')).toHaveCount(0);
    noProblems(watch);
  });

  test('"Pro gol!": called, the goleiro slid along the line and Pronto, and the shot past him scores', async ({ page }) => {
    const watch = watchPage(page);
    await open(page, chance());
    await page.getByRole('button', { name: '📣 Pro gol!' }).click();
    await expect(game(page)).toHaveAttribute('data-phase', 'placing');
    /* the note turns to face the defender, at the top */
    await expect(page.locator('.bt-say')).toHaveClass(/flip/);
    await expect(page.locator('.bt-keeper.away')).toHaveClass(/placing/);
    /* their goleiro slid to its left post */
    const from = await screen(page, { x: 32, y: (G3.y[0] + G3.y[1]) / 2 });
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

  for (const reduced of [false, true]) {
    test(`a goal: slowed right down as it goes in, then GOOOL! in the scorer's colours${reduced ? ' (Reduce Motion: no flash, no shake)' : ' over a flash and a shaking table'}, all gone again`, async ({ page }) => {
      const watch = watchPage(page);
      if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
      await open(page, chance());
      await page.getByRole('button', { name: '📣 Pro gol!' }).click();
      /* their goleiro slid to its left post, and a's shot past him */
      const from = await screen(page, { x: 32, y: (G3.y[0] + G3.y[1]) / 2 });
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(from.x - 10 * from.scale, from.y, { steps: 6 });
      await page.mouse.up();
      const keeper = Number(await page.locator('.bt-keeper.away').getAttribute('data-x'));
      await page.getByRole('button', { name: '✋ Pronto' }).click();
      const plan = oneTouch({ ball: { x: 32, y: 30 }, us: [{ x: 32, y: 42 }], them: parked('b'), keeper }, [0], false)!;
      await flick(page, 'a', 0, plan.flicks[0].vx, plan.flicks[0].vy);
      await expect(page.locator('.bt-table')).toHaveAttribute('data-slow', '');
      const banner = page.locator('.bt-gooool');
      await expect(banner).toHaveText('GOOOL!');
      const look = await banner.evaluate((b) => {
        const span = b.querySelector('span')!;
        const probe = document.createElement('i');
        probe.style.color = getComputedStyle(b).getPropertyValue('--fill');
        document.body.append(probe);
        const want = getComputedStyle(probe).color;
        probe.remove();
        return {
          colour: getComputedStyle(span).color, want,
          shaking: getComputedStyle(document.querySelector('.bt-wrap')!).animationName,
          flash: document.querySelector('.bt-flash') ? getComputedStyle(document.querySelector('.bt-flash')!).display : 'gone',
        };
      });
      expect(look.colour).toBe(look.want);
      if (reduced) {
        expect(look.shaking).toBe('none');
        expect(look.flash).not.toBe('block');
      } else {
        expect(look.shaking).toBe('bt-shake');
      }
      await expect(game(page)).toHaveAttribute('data-event', 'goal');
      /* and nothing left on the table */
      await expect(banner).toHaveCount(0, { timeout: 4000 });
      await expect(page.locator('.bt-flash')).toHaveCount(0);
      await expect(page.locator('.bt-stage')).not.toHaveClass(/shake/);
      await expect(page.locator('.bt-table')).not.toHaveAttribute('data-slow');
      noProblems(watch);
    });
  }

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
    await page.getByRole('button', { name: '📣 Pro gol!' }).click();
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
    await page.getByRole('button', { name: '📣 Pro gol!' }).click();
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
    await page.getByRole('button', { name: '📣 Pro gol!' }).click();
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
    await page.getByRole('button', { name: '📣 Pro gol!' }).click();
    await page.getByRole('button', { name: '✋ Pronto' }).click();
    const keeper = Number(await page.locator('.bt-keeper.away').getAttribute('data-x'));
    const plan = oneTouch({ ball: { x: 32, y: 30 }, us: [{ x: 32, y: 42 }], them: parked('b'), keeper }, [0], false)!;
    await flick(page, 'a', 0, plan.flicks[0].vx, plan.flicks[0].vy);
    await expect(game(page)).toHaveAttribute('data-event', 'goal', { timeout: 10000 });
    await expect(page.locator('.say-words')).toContainText('GOL! Marquinhos (4),');
    noProblems(watch);
  });

  test('1 toque: when a shot is called, the goleiro may come off its line, anywhere in its small area', async ({ page }) => {
    const watch = watchPage(page);
    await open(page, chance({ rule: '1' }));
    await page.getByRole('button', { name: '📣 Pro gol!' }).click();
    await expect(page.locator('.bt-say')).toContainText('move your goleiro anywhere in the small area');
    /* b's goleiro, at the top, dragged out towards the ball and across */
    const from = await screen(page, { x: 32, y: (G1.y[0] + G1.y[1]) / 2 });
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x - 4 * from.scale, from.y + 3 * from.scale, { steps: 6 });
    await page.mouse.up();
    const keeper = page.locator('.bt-keeper.away');
    expect(Number(await keeper.getAttribute('data-out'))).toBeGreaterThan(2);
    expect(Number(await keeper.getAttribute('data-x'))).toBeLessThan(30);
    await page.getByRole('button', { name: '✋ Pronto' }).click();
    await expect(game(page)).toHaveAttribute('data-phase', 'shot');
    expect(Number(await keeper.getAttribute('data-out'))).toBeGreaterThan(2);
    noProblems(watch);
  });

  test('1 toque: for a called shot the goleiro may go back into the goal, no further than its front on the line, and is out again after it', async ({ page }) => {
    const watch = watchPage(page);
    await open(page, chance({ rule: '1' }));
    await page.getByRole('button', { name: '📣 Pro gol!' }).click();
    /* b's goleiro, at the top, dragged back into its goal, further than it may go */
    const from = await screen(page, { x: 32, y: (G1.y[0] + G1.y[1]) / 2 });
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x, from.y - 8 * from.scale, { steps: 8 });
    await page.mouse.up();
    const keeper = page.locator('.bt-keeper.away');
    /* its front face on the goal line, the rest of it in the goal */
    expect(Number(await keeper.getAttribute('data-out'))).toBeCloseTo(-G1.y[1], 1);
    await page.getByRole('button', { name: '✋ Pronto' }).click();
    await expect(game(page)).toHaveAttribute('data-phase', 'shot');
    /* the shot: the button straight back down the table, nowhere near anything */
    await flick(page, 'a', 0, 0, 20);
    await expect(game(page)).toHaveAttribute('data-turn', 'b', { timeout: 10000 });
    await expect(keeper).toHaveAttribute('data-out', '0.00');
    noProblems(watch);
  });

  test('the goals are as deep as the nets the physics has, a whole button deep, and all of them on the screen', async ({ page }) => {
    await open(page, chance());
    const nets = await page.evaluate(() => {
      const board = document.querySelector<SVGSVGElement>('.bt-table')!;
      const view = board.viewBox.baseVal;
      return [...board.querySelectorAll<SVGGraphicsElement>('.bt-net-floor')].map((n) => {
        /* in the table's units, whichever end it is drawn at */
        const r = n.getBoundingClientRect();
        const b = board.getBoundingClientRect();
        const k = view.height / b.height;
        return { top: view.y + (r.top - b.top) * k, bottom: view.y + (r.bottom - b.top) * k, viewTop: view.y, viewBottom: view.y + view.height };
      });
    });
    expect(nets).toHaveLength(2);
    for (const n of nets) {
      expect(n.bottom - n.top).toBeCloseTo(NET, 1);
      expect(NET).toBeGreaterThan(2 * R);
      expect(n.top).toBeGreaterThanOrEqual(n.viewTop);
      expect(n.bottom).toBeLessThanOrEqual(n.viewBottom);
    }
    const [top, bottom] = [...nets].sort((p, q) => p.top - q.top);
    expect(top.bottom).toBeCloseTo(0, 1);
    expect(bottom.top).toBeCloseTo(L, 1);
  });

  for (const rule of ['3', '1'] as const) {
    test(`the goleiros drawn are the ones the physics has, for the rule played (${rule} Toque${rule === '1' ? '' : 's'})`, async ({ page }) => {
      await open(page, chance({ rule }));
      const blocks = await page.evaluate(() => {
        const board = document.querySelector<SVGSVGElement>('.bt-table')!;
        const view = board.viewBox.baseVal;
        const b = board.getBoundingClientRect();
        const k = view.height / b.height;
        return [...board.querySelectorAll<SVGGraphicsElement>('.bt-keeper-block')].map((n) => {
          const r = n.getBoundingClientRect();
          return { w: r.width * k, top: view.y + (r.top - b.top) * k, bottom: view.y + (r.bottom - b.top) * k };
        });
      });
      const g = GOLEIROS[rule];
      expect(blocks).toHaveLength(2);
      const [top, bottom] = [...blocks].sort((p, q) => p.top - q.top);
      for (const block of blocks) expect(block.w).toBeCloseTo(g.w, 1);
      expect(top.top).toBeCloseTo(g.y[0], 1);
      expect(top.bottom).toBeCloseTo(g.y[1], 1);
      expect(bottom.top).toBeCloseTo(L - g.y[1], 1);
      expect(bottom.bottom).toBeCloseTo(L - g.y[0], 1);
    });
  }

  test('1 toque: on your turn you may move your own goleiro before your flick', async ({ page }) => {
    const watch = watchPage(page);
    await open(page, chance({ rule: '1', attack: false, ball: { x: 32, y: 60 }, a: [{ x: 32, y: 72 }, ...parked('a').slice(1)] }));
    await expect(page.locator('.bt-say')).toContainText('you may move your goleiro first');
    const line = L - (G1.y[0] + G1.y[1]) / 2;
    const from = await screen(page, { x: 32, y: line });
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 5 * from.scale, from.y - 3 * from.scale, { steps: 6 });
    await page.mouse.up();
    const keeper = page.locator('.bt-keeper.home');
    expect(Number(await keeper.getAttribute('data-x'))).toBeGreaterThan(34);
    expect(Number(await keeper.getAttribute('data-out'))).toBeGreaterThan(2);
    /* it is still your turn, and your flick still plays */
    await expect(game(page)).toHaveAttribute('data-turn', 'a');
    await flick(page, 'a', 0, 0, -40);
    await expect(game(page)).toHaveAttribute('data-turn', 'b', { timeout: 8000 });
    noProblems(watch);
  });

  test('3 toques: your own goleiro stays put on your turn', async ({ page }) => {
    await open(page, chance({ attack: false, ball: { x: 32, y: 60 }, a: [{ x: 32, y: 72 }, ...parked('a').slice(1)] }));
    const from = await screen(page, { x: 32, y: L - (G3.y[0] + G3.y[1]) / 2 });
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 5 * from.scale, from.y - 3 * from.scale, { steps: 6 });
    await page.mouse.up();
    await expect(page.locator('.bt-keeper.home')).toHaveAttribute('data-x', '32.00');
    await expect(page.locator('.bt-keeper.home')).toHaveAttribute('data-out', '0.00');
  });

  for (const narration of ['pt', 'en', 'off'] as const) {
    test(`"Pro gol!" is shouted as it is called, in Portuguese whichever commentator speaks, and not with none (${narration})`, async ({ page }) => {
      await recordSpeech(page, ['pt-BR']);
      await recordPlays(page);
      await open(page, chance(), { 'football-narration': narration });
      const call = page.getByRole('button', { name: '📣 Pro gol!' });
      /* red, and beating (still under Reduce Motion) */
      expect(await call.evaluate((b) => getComputedStyle(b).backgroundColor)).toBe('rgb(199, 54, 26)');
      await call.click();
      await expect(game(page)).toHaveAttribute('data-phase', 'placing');
      /* the recording where it was made, the device's Portuguese voice where not */
      const shouted = async (): Promise<boolean> => (await said(page)).includes(PT_CALL)
        || (await plays(page)).some((src) => src.endsWith(`/audio/${clipId(PT_CALL)}.mp3`));
      if (narration === 'off') {
        await page.waitForTimeout(500);
        expect(await shouted()).toBe(false);
      } else {
        await expect.poll(shouted).toBe(true);
      }
    });
  }

  test('the commentator: a called shot off the post that stays out is "Na trave!"', async ({ page }) => {
    const watch = watchPage(page);
    await recordSpeech(page, ['pt-BR']);
    await recordPlays(page);
    /* the ball at the edge of the area, the button lined up behind it at the near post, the goleiro by the far one */
    const ball = { x: 32, y: 26 };
    const at = { x: MOUTH[0] - 1, y: 0 };
    const d = Math.sqrt((at.x - ball.x) ** 2 + (at.y - ball.y) ** 2);
    const dir = { x: (at.x - ball.x) / d, y: (at.y - ball.y) / d };
    const me = { x: ball.x - dir.x * (R + BALL + 4), y: ball.y - dir.y * (R + BALL + 4) };
    const keeper = MOUTH[1] - G3.w / 2;
    const f = { vx: dir.x * 80, vy: dir.y * 80 };
    /* off the post and out, and still so a degree either way and 5% harder or
       softer: a finger's drag comes out a little differently in each browser */
    for (const a of [-0.02, 0, 0.02]) for (const k of [0.95, 1, 1.05]) {
      const vx = (f.vx * Math.cos(a) - f.vy * Math.sin(a)) * k;
      const vy = (f.vx * Math.sin(a) + f.vy * Math.cos(a)) * k;
      const shot = simulate({ ball, us: [me], them: parked('b'), keeper }, { button: 0, vx, vy });
      expect(shot.goal).toBe(false);
      expect(shot.bumps.map((b) => b.what)).toContain('post');
    }
    await open(page, chance({ ball, a: [me, ...parked('a').slice(1)], keepers: { a: 32, b: keeper } }));
    await page.getByRole('button', { name: '📣 Pro gol!' }).click();
    await page.getByRole('button', { name: '✋ Pronto' }).click();
    await flick(page, 'a', 0, f.vx, f.vy);
    /* played out: whether the turn passes depends on where the ball ends up, not on the post */
    await expect(game(page)).toHaveAttribute('data-event', /./, { timeout: 10000 });
    /* his recording where one was made, and the device's Portuguese voice where not */
    const called = async (): Promise<boolean> => (await said(page)).some((t) => PT_POSTS.includes(t))
      || (await plays(page)).some((src) => PT_POSTS.some((line) => src.endsWith(`/audio/${clipId(line)}.mp3`)));
    await expect.poll(called).toBe(true);
    noProblems(watch);
  });

  test('a slow shot that stops across the line: no goal, the ball touches the line drawn, and the note says it is on the line', async ({ page }) => {
    const watch = watchPage(page);
    /* straight at the middle of the goal, just hard enough to stop across
       the line, and still so a degree either way and 5% harder or softer */
    const ball = { x: 32, y: 14 };
    const me = { x: 32, y: 14 + R + BALL + 3 };
    const keeper = MOUTH[0] + G3.w / 2;
    for (const a of [-0.02, 0, 0.02]) for (const k of [0.95, 1, 1.05]) {
      const shot = simulate({ ball, us: [me], them: parked('b'), keeper }, { button: 0, vx: 29 * Math.sin(a) * k, vy: -29 * Math.cos(a) * k });
      expect(shot.goal).toBe(false);
      expect(onTheLine(shot.end.ball)).toBe(true);
    }
    await open(page, chance({ ball, a: [me, ...parked('a').slice(1)], keepers: { a: 32, b: keeper } }));
    await flick(page, 'a', 0, 0, -29);
    await expect(page.locator('.say-words')).toContainText('On the line! The whole ball has to cross it.', { timeout: 10000 });
    await expect(game(page)).toHaveAttribute('data-score', '0-0');
    /* what is seen is what counts: the ball's edge is still on the goal line drawn */
    const { ballEdge, lineOuter, lineInner } = await page.evaluate(() => {
      const border = [...document.querySelectorAll<SVGRectElement>('.bt-table rect.bt-line')].find((r) => Number(r.getAttribute('height')) > 50)!;
      const half = parseFloat(getComputedStyle(border).strokeWidth) / 2;
      const top = Number(border.getAttribute('y'));
      const b = document.querySelector('.bt-ball-face')!.getBoundingClientRect();
      const t = document.querySelector('.bt-table')!.getBoundingClientRect();
      const view = (document.querySelector('.bt-table') as SVGSVGElement).viewBox.baseVal;
      /* the ball's bottom edge, the one nearest the pitch, in table units */
      return { ballEdge: view.y + ((b.bottom - t.top) / t.height) * view.height, lineOuter: top - half, lineInner: top + half };
    });
    expect(lineOuter).toBeCloseTo(0, 3);
    expect(ballEdge).toBeGreaterThan(lineOuter + 0.05);
    /* at the line, not out on the pitch */
    expect(ballEdge).toBeLessThan(lineInner + 2 * BALL);
    noProblems(watch);
  });

  test('the lines drawn are where the rules have them: goal lines, areas, spots, as wide as the rules count them', async ({ page }) => {
    await open(page, chance());
    const drawn = await page.evaluate(() => {
      const rects = [...document.querySelectorAll<SVGRectElement>('.bt-table rect.bt-line')].map((r) => {
        const half = parseFloat(getComputedStyle(r).strokeWidth) / 2;
        const [x, y, w, h] = ['x', 'y', 'width', 'height'].map((a) => Number(r.getAttribute(a)));
        /* the outer edges of the paint: left, top, right, bottom */
        return { width: 2 * half, edges: [x - half, y - half, x + w + half, y + h + half] };
      });
      const spots = [...document.querySelectorAll<SVGCircleElement>('.bt-table circle.bt-spot')].map((c) => Number(c.getAttribute('cy')));
      return { rects, spots };
    });
    const close = (a: number[], b: number[]): boolean => a.every((n, i) => Math.abs(n - b[i]) < 0.001);
    expect(drawn.rects.every((r) => Math.abs(r.width - LINE) < 0.001)).toBe(true);
    const [penW, penD] = MARKS.penalty;
    const [boxW, boxD] = MARKS.box;
    const want = [
      /* the goal lines' outer edges on the line the posts stand on */
      ['the goal lines', (e: number[]) => Math.abs(e[1]) < 0.001 && Math.abs(e[3] - L) < 0.001],
      /* each area's outer edges where the rules end it (a foul in the area; the goleiro's small area) */
      ['the top penalty area', (e: number[]) => close(e, [(W - penW) / 2, 0, (W + penW) / 2, penD])],
      ['the bottom penalty area', (e: number[]) => close(e, [(W - penW) / 2, L - penD, (W + penW) / 2, L])],
      ['the top small area', (e: number[]) => close(e, [(W - boxW) / 2, 0, (W + boxW) / 2, boxD])],
      ['the bottom small area', (e: number[]) => close(e, [(W - boxW) / 2, L - boxD, (W + boxW) / 2, L])],
    ] as const;
    for (const [what, fits] of want) expect(drawn.rects.some((r) => fits(r.edges)), what).toBe(true);
    /* the spots where the ball is put for a penalty, and the middle */
    expect(drawn.spots.sort((a, b) => a - b)).toEqual([MARKS.spot, L / 2, L - MARKS.spot]);
  });

  test('has no accessibility violations', async ({ page }) => {
    await open(page, chance());
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});
