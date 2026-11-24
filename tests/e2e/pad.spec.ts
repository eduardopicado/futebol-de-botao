/* A game controller: a pretend one, standing in for navigator.getGamepads,
   pressed and pushed as a DualSense or an 8BitDo would be (the standard
   mapping), read every 16 ms as the app reads it. */

import { expect, test, type Page } from '@playwright/test';
import { noProblems, seed, watchPage } from './helpers';
import { MAX_SPEED, oneTouch, type Flick, type Point } from '../../src/content/botao';
import type { Match, Side } from '../../src/content/match';
import { BUTTONS, DEAD, type PadButton } from '../../src/lib/pad';

/** a controller paired, nothing pressed */
async function plugIn(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __pad: { axes: number[]; buttons: boolean[] }; __reads: number };
    w.__pad = { axes: [0, 0, 0, 0], buttons: new Array(17).fill(false) };
    /* how many times the app has read it: a press is held until it has been seen */
    w.__reads = 0;
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => (w.__reads++, [{
        id: 'Test controller', index: 0, connected: true, mapping: 'standard', timestamp: performance.now(),
        axes: w.__pad.axes.slice(), buttons: w.__pad.buttons.map((p) => ({ pressed: p, touched: p, value: p ? 1 : 0 })),
      }]),
    });
  });
}

/** wait until the app has read the controller this many more times (however busy the device) */
const reads = (page: Page, n: number): Promise<void> => page.evaluate(async (k) => {
  const w = window as unknown as { __reads: number };
  const until = w.__reads + k;
  while (w.__reads < until) await new Promise((r) => setTimeout(r, 4));
}, n);

async function press(page: Page, b: PadButton): Promise<void> {
  const i = BUTTONS[b];
  await page.evaluate((n) => { (window as unknown as { __pad: { buttons: boolean[] } }).__pad.buttons[n] = true; }, i);
  await reads(page, 3);
  await page.evaluate((n) => { (window as unknown as { __pad: { buttons: boolean[] } }).__pad.buttons[n] = false; }, i);
  await reads(page, 2);
}

/** the left stick (or the right) where it reads this, after the dead zone: 0 to 1 each way */
async function push(page: Page, x: number, y: number, right = false): Promise<void> {
  const m = Math.sqrt(x * x + y * y);
  const raw = m === 0 ? 0 : (DEAD + m * (1 - DEAD)) / m;
  await page.evaluate(([ax, ay, off]) => {
    const pad = (window as unknown as { __pad: { axes: number[] } }).__pad;
    pad.axes[off] = ax!; pad.axes[off + 1] = ay!;
  }, [x * raw, y * raw, right ? 2 : 0]);
  await page.waitForTimeout(120);
  await reads(page, 3);
}

/** the stick let go: it springs home in three frames */
async function letGo(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const w = window as unknown as { __pad: { axes: number[] }; __reads: number };
    const pad = w.__pad;
    const [x, y] = [pad.axes[0]!, pad.axes[1]!];
    /* each step read once by the app, as a real stick's spring is */
    for (const k of [0.6, 0.25, 0]) {
      pad.axes[0] = x * k; pad.axes[1] = y * k;
      const until = w.__reads + 1;
      while (w.__reads < until) await new Promise((r) => setTimeout(r, 2));
    }
  });
  await reads(page, 3);
}

/** this flick, aimed with the stick (where it goes, how hard) and south
    pressed while it is held there (let go first, the aim kept is the one
    before it sprang back: src/lib/pad.ts latch, and its unit tests) */
async function flickWith(page: Page, f: Flick): Promise<void> {
  await push(page, f.vx / MAX_SPEED, f.vy / MAX_SPEED);
  await press(page, 'south');
  await push(page, 0, 0);
}

const table = (page: Page) => page.locator('.bt-table');
const ring = (page: Page) => page.locator('.bt-pad-pick');

/** where a side's button is on the table */
async function where(page: Page, side: Side, i: number): Promise<Point> {
  const b = page.locator(side === 'a' ? `.bt-btn.us.b${i}` : `.bt-btn.them.t${i}`);
  return { x: Number(await b.getAttribute('data-x')), y: Number(await b.getAttribute('data-y')) };
}

/** the d-pad pressed towards this button until it is the one picked */
async function pickWith(page: Page, side: Side, i: number): Promise<void> {
  for (let n = 0; n < 8; n++) {
    const now = await table(page).getAttribute('data-pick');
    if (now === `${side}${i}`) return;
    const [from, to] = [await where(page, side, Number(now!.slice(1))), await where(page, side, i)];
    const [dx, dy] = [to.x - from.x, to.y - from.y];
    await press(page, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  }
  await expect(table(page)).toHaveAttribute('data-pick', `${side}${i}`);
}

test.describe('A game controller', () => {
  test('the start screen: the d-pad moves through its buttons, south opens one, Start comes back', async ({ page }) => {
    const watch = watchPage(page);
    await plugIn(page);
    await page.goto('/');
    await expect(page.getByRole('link', { name: '⚽ Treino' })).toBeVisible();
    await press(page, 'down');
    await expect(page.locator('body')).toHaveClass(/pad-on/);
    const first = await page.evaluate(() => document.activeElement?.textContent ?? '');
    expect(first).not.toBe('');
    await press(page, 'down');
    const second = await page.evaluate(() => document.activeElement?.textContent ?? '');
    expect(second).not.toBe(first);
    /* and the focus shows */
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
    expect(outline).toBe('solid');
    await press(page, 'south');
    await expect(page).not.toHaveURL(/#\/home$|\/$/);
    /* the screen opened, its ← there to go back with */
    await expect(page.locator('button.icon-btn', { hasText: '←' })).toBeVisible();
    await press(page, 'start');
    await expect(page.getByRole('link', { name: '⚽ Treino' })).toBeVisible();
    /* a touch takes over: no focus ring */
    await page.mouse.click(2, 2);
    await expect(page.locator('body')).not.toHaveClass(/pad-on/);
    noProblems(watch);
  });

  test('Treino: a button picked, aimed with the stick, the aim kept when it is let go, east drops it, and three touches score', async ({ page }) => {
    const watch = watchPage(page);
    await plugIn(page);
    await page.goto('/#/treino');
    await expect(page.locator('.bt-btn.us')).toHaveCount(3);
    /* nothing picked until the controller is used */
    await page.waitForTimeout(200);
    await expect(ring(page)).toBeHidden();
    await push(page, 0, -0.5);
    await expect(ring(page)).toBeVisible();
    await expect(page.locator('.bt-arrow')).not.toHaveAttribute('points', '');
    await letGo(page);
    /* let go: the aim is kept, not dropped as the stick springs back */
    await expect(page.locator('.bt-arrow')).not.toHaveAttribute('points', '');
    await press(page, 'east');
    await expect(page.locator('.bt-arrow')).toHaveAttribute('points', '');
    await expect(ring(page)).toBeVisible();
    await expect(page.locator('.game')).toHaveAttribute('data-touches', '0');
    /* the planned way to score, flick by flick, each button picked with the d-pad */
    const flicks: Flick[] = JSON.parse((await page.locator('.game').getAttribute('data-plan'))!);
    for (const [i, f] of flicks.entries()) {
      await pickWith(page, 'a', f.button);
      await flickWith(page, f);
      /* while it plays, nothing picked */
      await expect(ring(page)).toBeHidden();
      if (i < flicks.length - 1) await expect(page.locator('.bt-say')).toContainText('touches left', { timeout: 10000 });
    }
    await expect(page.locator('.game')).toHaveAttribute('data-goal', 'scored', { timeout: 10000 });
    noProblems(watch);
  });

  test('Treino: R1 arms Cobertura, and the aim held still lifts the chip as the ring fills; the right stick makes it harder and starts the lift again', async ({ page }) => {
    const watch = watchPage(page);
    await plugIn(page);
    await page.goto('/#/treino');
    await expect(page.locator('.bt-btn.us')).toHaveCount(3);
    await press(page, 'r1');
    await expect(page.locator('button.chip')).toHaveAttribute('aria-pressed', 'true');
    /* aimed from the button picked straight at the ball */
    await push(page, 0, -0.1);
    const picked = Number((await table(page).getAttribute('data-pick'))!.slice(1));
    const from = await where(page, 'a', picked);
    const ball = (await page.locator('.bt-ball').getAttribute('transform'))!.match(/translate\(([-\d.]+) ([-\d.]+)\)/)!.slice(1).map(Number);
    const [dx, dy] = [ball[0]! - from.x, ball[1]! - from.y];
    const d = Math.sqrt(dx * dx + dy * dy);
    await push(page, (dx / d) * 0.7, (dy / d) * 0.7);
    /* let go: the aim kept, still at the ball, held still while the ring fills */
    await letGo(page);
    await page.waitForTimeout(700);
    const lift = Number(await page.locator('.bt-lift').getAttribute('data-lift'));
    expect(lift).toBeGreaterThan(0.1);
    /* the right stick, up, makes it harder: the arrow longer, and the lift starts again */
    const before = await page.locator('.bt-arrow').getAttribute('points');
    const lowest = await page.evaluate(async () => {
      const pad = (window as unknown as { __pad: { axes: number[] } }).__pad;
      let low = 1;
      pad.axes[3] = -1;
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 20));
        low = Math.min(low, Number(document.querySelector('.bt-lift')!.getAttribute('data-lift')));
      }
      pad.axes[3] = 0;
      return low;
    });
    expect(lowest).toBe(0);
    expect(await page.locator('.bt-arrow').getAttribute('points')).not.toBe(before);
    /* held still again: full */
    await expect.poll(async () => Number(await page.locator('.bt-lift').getAttribute('data-lift')), { timeout: 3000 }).toBe(1);
    /* the ball seen in the air, however briefly */
    await page.evaluate(() => {
      const w = window as unknown as { __up: boolean };
      w.__up = false;
      const ball = document.querySelector('.bt-ball')!;
      new MutationObserver(() => { if (ball.hasAttribute('data-up')) w.__up = true; }).observe(ball, { attributes: true });
    });
    await press(page, 'south');
    await expect.poll(() => page.evaluate(() => (window as unknown as { __up: boolean }).__up), { timeout: 4000 }).toBe(true);
    noProblems(watch);
  });

  test('a touch takes over from the controller: nothing stays picked on the table', async ({ page }) => {
    const watch = watchPage(page);
    await plugIn(page);
    await page.goto('/#/treino');
    await expect(page.locator('.bt-btn.us')).toHaveCount(3);
    await press(page, 'right');
    await expect(ring(page)).toBeVisible();
    await page.mouse.click(4, 4);
    await expect(ring(page)).toBeHidden();
    await expect(page.locator('.bt-tag')).toBeHidden();
    noProblems(watch);
  });

  test('a match: north calls Pro gol!, the stick slides the goleiro, west says Pronto, and the stick\'s shot goes in', async ({ page }) => {
    const watch = watchPage(page);
    const parked = (side: Side): Point[] => [
      { x: 6, y: side === 'a' ? 92 : 6 }, { x: 58, y: side === 'a' ? 92 : 6 },
      { x: 6, y: side === 'a' ? 76 : 22 }, { x: 58, y: side === 'a' ? 76 : 22 },
    ];
    const setup: Partial<Match> = {
      turn: 'a', phase: 'play', touches: 0, used: [], attack: true, penalty: false, out: [],
      ball: { x: 32, y: 30 }, a: [{ x: 32, y: 42 }, ...parked('a').slice(1)], b: parked('b'), keepers: { a: 32, b: 32 },
    };
    await seed(page, { 'match-setup': setup });
    await plugIn(page);
    await page.goto('/#/partida');
    await expect(page.locator('.bt-btn.us')).toHaveCount(4);
    await press(page, 'north');
    await expect(page.locator('.game')).toHaveAttribute('data-phase', 'placing');
    /* the goleiro at the top, slid to its left post with the stick */
    const keeper = page.locator('.bt-keeper.away');
    const start = Number(await keeper.getAttribute('data-x'));
    await push(page, -1, 0);
    await page.waitForTimeout(150);
    await push(page, 0, 0);
    /* still, for a few frames: where he stands now is where he stays */
    await page.waitForTimeout(250);
    const slid = Number(await keeper.getAttribute('data-x'));
    expect(slid).toBeLessThan(start - 2);
    await press(page, 'west');
    await expect(page.locator('.game')).toHaveAttribute('data-phase', 'shot');
    const plan = oneTouch({ ball: { x: 32, y: 30 }, us: [{ x: 32, y: 42 }], them: parked('b'), keeper: slid }, [0], false)!;
    await expect(table(page)).toHaveAttribute('data-pick', 'a0');
    await flickWith(page, plan.flicks[0]!);
    await expect(page.locator('.game')).toHaveAttribute('data-score', '1-0', { timeout: 15000 });
    noProblems(watch);
  });

  test('arcade Pênaltis: west says Pronto, the stick takes the kick, and as the ball comes the stick drags the goleiro', async ({ page }) => {
    const watch = watchPage(page);
    await seed(page, { 'pen-arcade': true, 'shootout-setup': { first: 'a', turn: 'a', kicks: [], winner: null } });
    await plugIn(page);
    await page.goto('/#/penaltis-2');
    await expect(page.getByRole('button', { name: '✋ Pronto' })).toBeVisible();
    await press(page, 'west');
    await expect(page.locator('.game')).toHaveAttribute('data-phase', 'penalty');
    const keeper = page.locator('.bt-keeper.away');
    const from = Number(await keeper.getAttribute('data-x'));
    await expect(table(page)).toHaveAttribute('data-pick', /^a/);
    await flickWith(page, { button: 0, vx: 8, vy: -70 });
    /* the ball coming: the stick held right, and he goes with it, no further than a dive */
    await expect(page.locator('.game')).toHaveAttribute('data-dive', '', { timeout: 3000 });
    await push(page, 1, 0);
    await expect(page.locator('.game')).toHaveAttribute('data-kick', /goal|saved|missed/, { timeout: 10000 });
    await push(page, 0, 0);
    const to = Number(await keeper.getAttribute('data-x'));
    expect(to).toBeGreaterThan(from + 2);
    expect(to).toBeLessThanOrEqual(from + 8 + 0.01);
    noProblems(watch);
  });

  test('arcade Pênaltis: the kicker\'s stick, still held as the ball comes, does not move the goleiro until it is let go', async ({ page }) => {
    const watch = watchPage(page);
    await seed(page, { 'pen-arcade': true, 'shootout-setup': { first: 'a', turn: 'a', kicks: [], winner: null } });
    await plugIn(page);
    await page.goto('/#/penaltis-2');
    await expect(page.getByRole('button', { name: '✋ Pronto' })).toBeVisible();
    await press(page, 'west');
    await expect(page.locator('.game')).toHaveAttribute('data-phase', 'penalty');
    const keeper = page.locator('.bt-keeper.away');
    const from = Number(await keeper.getAttribute('data-x'));
    /* aimed and flicked, then the stick swung hard left and never let go */
    await push(page, 8 / MAX_SPEED, -70 / MAX_SPEED);
    await press(page, 'south');
    await push(page, -1, -0.05);
    await expect(page.locator('.game')).toHaveAttribute('data-dive', '', { timeout: 3000 });
    await page.waitForTimeout(60);
    expect(Number(await keeper.getAttribute('data-x'))).toBe(from);
    /* let go, then pushed, a frame later: now it is the goleiro's */
    await page.evaluate(async () => {
      const pad = (window as unknown as { __pad: { axes: number[] } }).__pad;
      pad.axes[0] = 0; pad.axes[1] = 0;
      for (let i = 0; i < 2; i++) await new Promise((r) => setTimeout(r, 20));
      pad.axes[0] = 1;
    });
    await expect(page.locator('.game')).toHaveAttribute('data-kick', /goal|saved|missed/, { timeout: 10000 });
    await push(page, 0, 0);
    expect(Number(await keeper.getAttribute('data-x'))).toBeGreaterThan(from);
    noProblems(watch);
  });
});
