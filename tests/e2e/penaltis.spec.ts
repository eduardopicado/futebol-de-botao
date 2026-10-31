/* Pênaltis: a penalty shootout, two players on one iPad or one against the
   computer. Real finger drags through the table's viewBox; a shootout put on
   the device part-way through (shootout-setup) where a test needs one kick
   to decide it. */

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { expectTapTargets, heard, noProblems, plays, recordPlays, recordSpeech, said, seed, watchPage } from './helpers';
import { KEEPER_Y, L, MARKS, PULL, VIEW, W, oneTouch, type Point } from '../../src/content/botao';
import type { Shootout, Side } from '../../src/content/match';
import { enGoal, ptGoals } from '../../src/content/commentary';
import { clipId } from '../../src/lib/clip-id';
import { SQUADS } from '../../src/game/squads';

async function screen(page: Page, p: Point): Promise<{ x: number; y: number; scale: number }> {
  const box = (await page.locator('.bt-table').boundingBox())!;
  const scale = box.width / VIEW.w;
  return { x: box.x + (p.x - VIEW.x) * scale, y: box.y + (p.y - VIEW.y) * scale, scale };
}

const game = (page: Page) => page.locator('.game');
const turned = (p: Point): Point => ({ x: W - p.x, y: L - p.y });
/** the taker's button on the screen */
const taker = (side: Side): string => (side === 'a' ? '.bt-btn.us.b0' : '.bt-btn.them.t0');

/** a finger on the taker, pulled back the way that gives this flick (as on the screen), let go */
async function kick(page: Page, side: Side, vx: number, vy: number): Promise<void> {
  const b = page.locator(taker(side));
  const { x, y, scale } = await screen(page, { x: Number(await b.getAttribute('data-x')), y: Number(await b.getAttribute('data-y')) });
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - (vx / PULL) * scale, y - (vy / PULL) * scale, { steps: 6 });
  await page.mouse.up();
}

/** the flick that scores past the goleiro where it stands, as on the screen */
async function aimed(page: Page, side: Side): Promise<{ vx: number; vy: number }> {
  const at = async (sel: string): Promise<Point> => {
    const l = page.locator(sel);
    return { x: Number(await l.getAttribute('data-x')), y: Number(await l.getAttribute('data-y')) };
  };
  /* the spot in front of the goal it kicks at */
  const ball = { x: W / 2, y: side === 'a' ? MARKS.spot : L - MARKS.spot };
  const me = await at(taker(side));
  const keeper = Number(await page.locator(side === 'a' ? '.bt-keeper.away' : '.bt-keeper.home').getAttribute('data-x'));
  const put = side === 'a' ? (p: Point): Point => p : turned;
  const plan = oneTouch({ ball: put(ball), us: [put(me)], them: [], keeper: side === 'a' ? keeper : W - keeper }, [0], false)!;
  const f = plan.flicks[0];
  return side === 'a' ? { vx: f.vx, vy: f.vy } : { vx: -f.vx, vy: -f.vy };
}

/** `first` kicked first, and so far these kicks, in turn */
const partWay = (first: Side, scored: boolean[]): Partial<Shootout> => ({
  first, turn: scored.length % 2 === 0 ? first : first === 'a' ? 'b' : 'a',
  kicks: scored.map((k, i) => ({ side: i % 2 === 0 ? first : first === 'a' ? 'b' : 'a', scored: k })), winner: null,
});

test.describe('Pênaltis', () => {
  test('from the start screen: two players, a toss, the goleiro placed and Pronto, and a goal counted', async ({ page }) => {
    const watch = watchPage(page);
    await page.goto('/');
    await page.getByRole('link', { name: '🥅 Pênaltis' }).click();
    await expect(page.getByRole('heading', { name: 'Pênaltis' })).toBeVisible();
    await page.getByRole('link', { name: '👥 2 players' }).click();
    await page.getByRole('button', { name: '▶ Start' }).click();
    await expect(page.locator('.toss')).toContainText('First kick:');
    await expect(game(page)).toHaveAttribute('data-phase', 'placing', { timeout: 6000 });
    await expect(page.locator('.pen-mark')).toHaveCount(10);
    await expectTapTargets(page, '.game button');
    const side = (await game(page).getAttribute('data-turn')) as Side;
    /* the defender, the other side: slides their goleiro, the note facing them */
    await expect(page.locator('.bt-say')).toHaveClass(side === 'a' ? /flip/ : /^(?!.*flip)/);
    const line = side === 'a' ? (KEEPER_Y[0] + KEEPER_Y[1]) / 2 : L - (KEEPER_Y[0] + KEEPER_Y[1]) / 2;
    const from = await screen(page, { x: 32, y: line });
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x - 8 * from.scale, from.y, { steps: 6 });
    await page.mouse.up();
    await page.getByRole('button', { name: '✋ Pronto' }).click();
    await expect(game(page)).toHaveAttribute('data-phase', 'penalty');
    const f = await aimed(page, side);
    await kick(page, side, f.vx, f.vy);
    await expect(game(page)).toHaveAttribute('data-kick', 'goal', { timeout: 10000 });
    await expect(game(page)).toHaveAttribute('data-score', side === 'a' ? '1-0' : '0-1');
    await expect(page.locator('.pen-mark.goal')).toHaveCount(1);
    /* and then the other side's kick */
    await expect(game(page)).toHaveAttribute('data-turn', side === 'a' ? 'b' : 'a', { timeout: 6000 });
    noProblems(watch);
  });

  test('a miss is marked, and the turn passes', async ({ page }) => {
    const watch = watchPage(page);
    await seed(page, { 'shootout-setup': partWay('a', []) });
    await page.goto('/#/penaltis-2');
    await page.getByRole('button', { name: '✋ Pronto' }).click();
    /* straight back towards its own end */
    await kick(page, 'a', 0, 30);
    await expect(game(page)).toHaveAttribute('data-kick', 'missed', { timeout: 10000 });
    await expect(page.locator('.pen-mark.miss')).toHaveCount(1);
    await expect(game(page)).toHaveAttribute('data-score', '0-0');
    await expect(game(page)).toHaveAttribute('data-turn', 'b', { timeout: 6000 });
    noProblems(watch);
  });

  test('against the computer: it places its goleiro, and the kick that cannot be caught wins', async ({ page }) => {
    const watch = watchPage(page);
    /* four kicks each, you 3 – 1: scoring your fifth puts it out of reach. Its
       guess the same every time: near its left post */
    await page.addInitScript(() => { Math.random = () => 0.1; });
    await seed(page, { 'shootout-setup': partWay('a', [true, false, true, true, false, false, true, false]) });
    await page.goto('/#/penaltis-1');
    await expect(game(page)).toHaveAttribute('data-score', '3-1');
    await expect(page.locator('.say-words')).toContainText('places its goleiro');
    await expect(game(page)).toHaveAttribute('data-phase', 'penalty', { timeout: 8000 });
    const f = await aimed(page, 'a');
    await kick(page, 'a', f.vx, f.vy);
    await expect(game(page)).toHaveAttribute('data-phase', 'over', { timeout: 10000 });
    await expect(game(page)).toHaveAttribute('data-winner', 'a');
    await expect(page.locator('.win')).toContainText('É campeão!');
    await expect(page.locator('.win')).toContainText('4 – 1');
    /* and Play again starts a new one */
    await page.getByRole('button', { name: '🔁 Play again' }).click();
    await expect(game(page)).toHaveAttribute('data-score', '0-0', { timeout: 6000 });
    noProblems(watch);
  });

  test('against the computer: it takes its own kick', async ({ page }) => {
    const watch = watchPage(page);
    await seed(page, { 'shootout-setup': partWay('a', [true]) });
    await page.goto('/#/penaltis-1');
    await expect(game(page)).toHaveAttribute('data-turn', 'b');
    await page.getByRole('button', { name: '✋ Pronto' }).click();
    await expect(page.locator('.say-words')).toContainText('steps up');
    await expect(game(page)).toHaveAttribute('data-kick', /goal|saved|missed/, { timeout: 10000 });
    await expect(game(page)).toHaveAttribute('data-turn', 'a', { timeout: 6000 });
    noProblems(watch);
  });

  test('has no accessibility violations', async ({ page }) => {
    await seed(page, { 'shootout-setup': partWay('a', [true, false]) });
    await page.goto('/#/penaltis-2');
    await expect(game(page)).toHaveAttribute('data-phase', 'placing');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });

  test.describe('the commentator', () => {
    /** Brazil's first kick, against Argentina, scored; with these settings too */
    async function brazilScores(page: Page, settings: Record<string, unknown> = {}): Promise<void> {
      await seed(page, { 'team-a': 'brazil', 'team-b': 'argentina', 'shootout-setup': partWay('a', []), ...settings });
      await page.goto('/#/penaltis-2');
      /* Argentina's goleiro off to one side, to leave room for a shot */
      const from = await screen(page, { x: 32, y: (KEEPER_Y[0] + KEEPER_Y[1]) / 2 });
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(from.x - 8 * from.scale, from.y, { steps: 6 });
      await page.mouse.up();
      await page.getByRole('button', { name: '✋ Pronto' }).click();
      const f = await aimed(page, 'a');
      await kick(page, 'a', f.vx, f.vy);
      await expect(game(page)).toHaveAttribute('data-kick', 'goal', { timeout: 10000 });
    }
    /** the recordings played of these lines (the silent one iOS needs first is none of them) */
    const played = async (page: Page, lines: string[]): Promise<string[]> =>
      (await plays(page)).filter((src) => lines.some((line) => src.endsWith(`/audio/${clipId(line)}.mp3`)));
    /** the scorer's name, as it was said */
    const name = async (page: Page): Promise<{ text: string; lang: string } | undefined> =>
      (await heard(page)).find((s) => SQUADS.brazil.some((p) => s.text === `${p.name}!`));

    test('shouts the goal in his own recorded voice, then the scorer\'s name in Portuguese', async ({ page }) => {
      const watch = watchPage(page);
      const asked: string[] = [];
      page.on('request', (r) => asked.push(new URL(r.url()).pathname));
      await recordSpeech(page, ['pt-BR']);
      await recordPlays(page);
      await brazilScores(page);
      await expect.poll(() => played(page, ptGoals('do Brasil'))).toHaveLength(1);
      await expect.poll(() => name(page)).toEqual({ text: expect.any(String), lang: 'pt-BR' });
      /* the call is the recording, never the device voice as well */
      expect((await said(page)).filter((t) => ptGoals('do Brasil').includes(t))).toEqual([]);
      /* and the words are read aloud once he has finished, not over him */
      const { text } = (await name(page))!;
      await expect.poll(async () => (await said(page)).slice(-2)).toEqual([text, `GOL! ${text.slice(0, -1)} scores for 🇧🇷 Brazil.`]);
      /* and the whistle and the cheer are the recorded ones */
      expect(asked).toEqual(expect.arrayContaining(['/audio/sfx/sfx.json', '/audio/sfx/whistle.mp3', '/audio/sfx/cheer.mp3']));
      noProblems(watch);
    });

    test('with no Portuguese voice on the device: still the recording, then the name in the voice it has', async ({ page }) => {
      const watch = watchPage(page);
      await recordSpeech(page);
      await recordPlays(page);
      await brazilScores(page);
      await expect.poll(() => played(page, ptGoals('do Brasil'))).toHaveLength(1);
      await expect.poll(() => name(page)).toEqual({ text: expect.any(String), lang: 'en-AU' });
      noProblems(watch);
    });

    test('in English: "Goooal for Brazil!" recorded, then the name', async ({ page }) => {
      const watch = watchPage(page);
      await recordSpeech(page, ['pt-BR']);
      await recordPlays(page);
      await brazilScores(page, { 'football-narration': 'en' });
      await expect.poll(() => played(page, [enGoal('Brazil')])).toHaveLength(1);
      await expect.poll(() => name(page)).toEqual({ text: expect.any(String), lang: 'en-AU' });
      noProblems(watch);
    });

    test('on the deciding kick: his goal, the name, and then "É campeão!", none cut short', async ({ page }) => {
      const watch = watchPage(page);
      await recordSpeech(page, ['pt-BR']);
      await recordPlays(page);
      /* as above: 3 – 1 after four each, the computer's goleiro by its left post */
      await page.addInitScript(() => { Math.random = () => 0.1; });
      await seed(page, { 'team-a': 'brazil', 'team-b': 'argentina', 'shootout-setup': partWay('a', [true, false, true, true, false, false, true, false]) });
      await page.goto('/#/penaltis-1');
      await expect(game(page)).toHaveAttribute('data-phase', 'penalty', { timeout: 8000 });
      const f = await aimed(page, 'a');
      await kick(page, 'a', f.vx, f.vy);
      await expect(game(page)).toHaveAttribute('data-winner', 'a', { timeout: 10000 });
      await expect.poll(() => played(page, ptGoals('do Brasil'))).toHaveLength(1);
      const { text } = (await name(page))!;
      await expect.poll(async () => (await said(page)).slice(-2)).toEqual([text, 'É campeão!']);
      noProblems(watch);
    });
  });
});
