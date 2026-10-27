/* One player against the computer, and Treino's Goleiro: the computer takes
   its turns, calls "A gol!" for you to place your goleiro, places its own
   when you call, and shoots at your goal. */

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { noProblems, seed, watchPage } from './helpers';
import { KEEPER_Y, L, PULL, VIEW, W, oneTouch, type Point } from '../../src/content/botao';
import type { Match, Side } from '../../src/content/match';

async function screen(page: Page, p: Point): Promise<{ x: number; y: number; scale: number }> {
  const box = (await page.locator('.bt-table').boundingBox())!;
  const scale = box.width / VIEW.w;
  return { x: box.x + (p.x - VIEW.x) * scale, y: box.y + (p.y - VIEW.y) * scale, scale };
}

const parked = (side: Side): Point[] => [
  { x: 6, y: side === 'a' ? 92 : 6 }, { x: 58, y: side === 'a' ? 92 : 6 },
  { x: 6, y: side === 'a' ? 76 : 22 }, { x: 58, y: side === 'a' ? 76 : 22 }, { x: 58, y: side === 'a' ? 60 : 38 },
];
const turned = (p: Point): Point => ({ x: W - p.x, y: L - p.y });

/** `side` with the ball in front of the other goal, its button behind it */
const chance = (side: Side): Partial<Match> => {
  const put = side === 'a' ? (p: Point): Point => p : turned;
  const mine = [put({ x: 32, y: 42 }), ...parked(side).slice(1)];
  return {
    turn: side, phase: 'play', touches: 0, used: [], attack: true, penalty: false, out: [],
    ball: put({ x: 32, y: 30 }), a: side === 'a' ? mine : parked('a'), b: side === 'b' ? mine : parked('b'),
    keepers: { a: 32, b: 32 },
  };
};

const game = (page: Page) => page.locator('.game');

test.describe('Against the computer', () => {
  test('from the start screen: 1 player, a toss, and the computer plays its own turns', async ({ page }) => {
    const watch = watchPage(page);
    await page.goto('/');
    await page.getByRole('link', { name: '🤖 1 player' }).click();
    await page.getByRole('button', { name: '▶ Kick off' }).click();
    await expect(game(page)).toHaveAttribute('data-phase', 'kickoff', { timeout: 6000 });
    if ((await game(page).getAttribute('data-turn')) === 'a') {
      /* your kick-off: the midfielder beside the ball sends it out of the circle, then a defender steps back */
      const pull = async (i: number, vx: number, vy: number): Promise<void> => {
        const b = page.locator(`.bt-btn.us.b${i}`);
        const at = await screen(page, { x: Number(await b.getAttribute('data-x')), y: Number(await b.getAttribute('data-y')) });
        await page.mouse.move(at.x, at.y);
        await page.mouse.down();
        await page.mouse.move(at.x - (vx / PULL) * at.scale, at.y - (vy / PULL) * at.scale, { steps: 6 });
        await page.mouse.up();
      };
      /* four a side: the midfielder is the third button */
      const kicker = page.locator('.bt-btn.us.b2');
      const [kx, ky] = [Number(await kicker.getAttribute('data-x')), Number(await kicker.getAttribute('data-y'))];
      expect(kx).toBe(43);
      const d = Math.sqrt((32 - kx) ** 2 + (L / 2 - ky) ** 2);
      await pull(2, (32 - kx) / d * 70, (L / 2 - ky) / d * 70);
      await expect(game(page)).toHaveAttribute('data-touches', '1', { timeout: 8000 });
      await pull(0, 0, 12);
    }
    /* then the computer has its turn, and takes it with no finger from anyone */
    await expect.poll(async () => page.locator('.bt-say').textContent(), { timeout: 20000 }).toContain('is thinking');
    /* the note always faces you, at the bottom */
    await expect(page.locator('.bt-say')).not.toHaveClass(/flip/);
    noProblems(watch);
  });

  test('it calls "A gol!": you slide your goleiro and tap Pronto, and it shoots', async ({ page }) => {
    const watch = watchPage(page);
    await seed(page, { 'match-setup': chance('b'), level: 'hard' });
    await page.goto('/#/computador');
    await expect(game(page)).toHaveAttribute('data-phase', 'placing', { timeout: 8000 });
    await expect(page.locator('.bt-say')).toContainText('slide your goleiro');
    await expect(page.locator('.bt-say')).not.toHaveClass(/flip/);
    await expect(page.locator('.bt-keeper.home')).toHaveClass(/placing/);
    /* your goleiro, at the bottom, slid a little to the left */
    const from = await screen(page, { x: 32, y: L - (KEEPER_Y[0] + KEEPER_Y[1]) / 2 });
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x - 4 * from.scale, from.y, { steps: 4 });
    await page.mouse.up();
    await page.getByRole('button', { name: '✋ Pronto' }).click();
    await expect(game(page)).toHaveAttribute('data-event', /.+/, { timeout: 15000 });
    noProblems(watch);
  });

  test('you call "A gol!": it places its own goleiro, and your shot past it counts', async ({ page }) => {
    const watch = watchPage(page);
    await seed(page, { 'match-setup': chance('a'), level: 'easy' });
    await page.goto('/#/computador');
    await page.getByRole('button', { name: '📣 A gol!' }).click();
    await expect(page.locator('.bt-say')).toContainText('places its goleiro');
    await expect(page.getByRole('button', { name: '✋ Pronto' })).toHaveCount(0);
    await expect(game(page)).toHaveAttribute('data-phase', 'shot', { timeout: 8000 });
    const keeper = Number(await page.locator('.bt-keeper.away').getAttribute('data-x'));
    const plan = oneTouch({ ball: { x: 32, y: 30 }, us: [{ x: 32, y: 42 }], them: parked('b'), keeper }, [0], true);
    test.skip(!plan, 'its goleiro left no way past it from here');
    const f = plan!.flicks[0];
    const at = await screen(page, { x: 32, y: 42 });
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.mouse.move(at.x - (f.vx / PULL) * at.scale, at.y - (f.vy / PULL) * at.scale, { steps: 6 });
    await page.mouse.up();
    await expect(game(page)).toHaveAttribute('data-event', 'goal', { timeout: 10000 });
    await expect(game(page)).toHaveAttribute('data-score', '1-0');
    noProblems(watch);
  });
});

test.describe('Treino: Goleiro', () => {
  test('ten shots at your goal: place your goleiro, Pronto, and each save or goal is counted, to the end', async ({ page }) => {
    test.setTimeout(150_000);
    const watch = watchPage(page);
    await seed(page, { level: 'easy' });
    await page.goto('/#/treino');
    await page.getByRole('link', { name: '🧤 Goleiro' }).click();
    await expect(game(page)).toHaveAttribute('data-phase', 'placing');
    await expect(game(page)).toHaveAttribute('data-shot', '1');
    for (let n = 1; n <= 10; n += 1) {
      await expect(game(page)).toHaveAttribute('data-shot', String(n), { timeout: 15000 });
      await expect(game(page)).toHaveAttribute('data-phase', 'placing', { timeout: 15000 });
      await page.getByRole('button', { name: '✋ Pronto' }).click();
      await expect(game(page)).toHaveAttribute('data-phase', /shot|done/);
    }
    await expect(game(page)).toHaveAttribute('data-phase', 'done', { timeout: 15000 });
    const saves = Number(await game(page).getAttribute('data-saves'));
    await expect(page.locator('.win')).toContainText(`${saves} of 10 saved`);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('fdb:goleiro-best') ?? '0'))).toBeGreaterThanOrEqual(saves);
    await page.getByRole('button', { name: '🔁 Again' }).click();
    await expect(game(page)).toHaveAttribute('data-shot', '1');
    noProblems(watch);
  });

  test('has no accessibility violations', async ({ page }) => {
    await page.goto('/#/goleiro');
    await expect(game(page)).toHaveAttribute('data-phase', 'placing');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});
