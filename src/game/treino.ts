/* Treino — practice in front of goal: pull back a button, let go, and score
 * in three touches.
 *
 * Your three buttons are in your team's colours, with the flag on for a
 * country; the other side's three are in the opponent's, and their goleiro
 * is a block in front of the goal who gets in line with the ball after each
 * touch. While you aim, an arrow shows which way your button will go and how
 * hard, and a short dashed line the start of the ball's way. Nothing of it
 * stays on the table once you let go: what happened is said in words above
 * the table instead. Show me plays a way to score from the start, then
 * clears it again.
 *
 * The match's simple rule: three touches, with any of your buttons. Shooting
 * is free here, with no "A gol!" to call. A goal is shouted by the
 * commentator. The physics is in src/content/botao.ts, the set-ups in
 * src/content/treino.ts, the table on the screen in board.ts. */

import { el } from '../lib/dom';
import { lifetime } from '../lib/life';
import { go } from '../lib/router';
import { sfx } from '../lib/sfx';
import { keeperFor, simulate, type Flick, type Point, type Shot, type Table } from '../content/botao';
import { TOUCHES, type Scene } from '../content/match';
import { drill, type Drill } from '../content/treino';
import { type Keepers, makeBoard, SHAPE } from './board';
import { speak } from './choices';
import { narrate } from './narration';
import { PACE } from './pace';
import { label, ourTeam, rivalFor } from './teams';

/** how far along its way the ball is shown while you aim */
const GUIDE = 16;

const sceneOf = (t: Table): Scene => ({ ball: t.ball, a: t.us, b: t.them });
const framesOf = (t: Table, shot: Shot): Scene[] =>
  shot.frames.map((f) => ({ ball: f[0], a: f.slice(1, 1 + t.us.length), b: f.slice(1 + t.us.length) }));
const keepersOf = (t: Table): Keepers => ({ top: t.keeper, bottom: null });

/** the ball's way in a shot, all of it or only its start, and the flicked
    button's own way until it reaches the ball */
function wayOf(t: Table, f: Flick, all: boolean): { ball: Point[]; mine: Point[] } {
  const shot = simulate(t, f);
  const ball: Point[] = [];
  let gone = 0;
  for (const fr of shot.frames) {
    const last = ball.at(-1);
    if (last && last.x === fr[0].x && last.y === fr[0].y) continue;
    if (last) gone += Math.sqrt((fr[0].x - last.x) ** 2 + (fr[0].y - last.y) ** 2);
    if (!all && gone > GUIDE) break;
    ball.push(fr[0]);
  }
  const mine = shot.frames.map((fr) => fr[1 + f.button]);
  const hit = shot.bumps.find((b) => b.what === 'touch');
  return { ball, mine: mine.slice(0, hit ? hit.frame + 1 : mine.length) };
}

/** Treino's two drills, side by side at the top: attacking, and in goal */
export function modeSwitch(active: 'treino' | 'goleiro'): HTMLElement {
  const link = (path: 'treino' | 'goleiro', text: string): HTMLElement =>
    el('a', { class: 'kind-btn', href: `#/${path}`, text, ...(path === active ? { 'aria-current': 'page' } : {}) });
  return el('nav', { class: 'kind-switch', 'aria-label': 'Treino' },
    el('h1', { class: 'sr-only', text: active === 'treino' ? 'Treino: attack' : 'Treino: goleiro' }),
    link('treino', '⚽ Attack'), link('goleiro', '🧤 Goleiro'));
}

export function mount(root: HTMLElement): () => void {
  const life = lifetime();
  const wait = (ms: number): Promise<void> => new Promise((done) => { life.later(done, ms); });
  const us = ourTeam();
  let rival = rivalFor(us);

  const goalsEl = el('span', { text: '0' });
  const score = el('p', { class: 'score', 'aria-live': 'polite' }, el('span', { class: 'lbl', text: 'Goals' }), goalsEl);
  const back = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Back to the start', text: '←' });
  back.addEventListener('click', () => go('home'));

  const sayWords = el('span', { class: 'say-words' });
  const pips = el('span', { class: 'bt-pips', role: 'img' });
  const touchesEl = el('p', { class: 'bt-touches' }, el('span', { text: 'Touches' }), pips);
  const showMe = el('button', { class: 'btn on-paper ghost small', type: 'button', text: '👀 Show me' }) as HTMLButtonElement;
  const board = makeBoard(life, 'The table: your buttons, the ball, and the goal at the top');
  const stage = el('div', { class: 'bt-stage' }, board.node);
  const node = el('div', { class: 'game', vars: SHAPE },
    el('header', { class: 'topbar' }, back, el('div', { class: 'titles' }, modeSwitch('treino'), touchesEl), score),
    el('div', { class: 'bt-say', 'aria-live': 'polite' }, sayWords, el('span', { class: 'say-actions' }, showMe)), stage);
  root.append(node);

  const draw = (t: Table): void => board.draw(sceneOf(t), keepersOf(t));
  const setPips = (used: number): void => {
    pips.replaceChildren(...Array.from({ length: TOUCHES }, (_, i) => el('span', { class: `bt-pip${i < used ? ' used' : ''}` })));
    pips.setAttribute('aria-label', `${used} of ${TOUCHES} touches used`);
    node.dataset.touches = String(used);
  };
  const tell = (words: string, aloud = true): void => {
    sayWords.textContent = words;
    if (aloud) speak(words);
  };

  let goals = 0;
  let d: Drill = drill();
  let table: Table = d.table;
  let touches = 0;
  /* a shot or Show me is playing: no finger does anything until it is over */
  let busy = false;
  let first = true;

  function next(): void {
    d = drill();
    table = { ...d.table, us: [...d.table.us], them: [...d.table.them] };
    touches = 0;
    busy = false;
    board.setUp(us, rival, { a: table.us.length, b: table.them.length });
    draw(table);
    board.clearAim();
    board.glow('a');
    setPips(0);
    node.dataset.plan = JSON.stringify(d.plan.flicks);
    delete node.dataset.goal;
    showMe.disabled = false;
    tell(first ? `${label(us)} against ${label(rival, true)}. Pull back a button and let go. Three touches to score!` : 'Three touches to score!', first);
    first = false;
  }

  /** the way to score, played from the start, and cleared again */
  async function demo(): Promise<void> {
    busy = true;
    board.drop();
    showMe.disabled = true;
    tell('Watch: here is one way.');
    let t: Table = d.table;
    draw(t);
    setPips(0);
    await wait(PACE.showStart);
    for (const f of d.plan.flicks) {
      /* the spot the button meets the ball */
      const shot = simulate(t, f);
      const meet = shot.bumps.find((b) => b.what === 'touch' && b.who === f.button);
      board.ghost(meet ? shot.frames[meet.frame][1 + f.button] : t.us[f.button]);
      board.arrow(t.us[f.button], f);
      const way = wayOf(t, f, true);
      board.way(way.ball, way.mine);
      await wait(PACE.showAim);
      board.clearAim();
      await board.play(framesOf(t, shot), shot.bumps, keepersOf(t));
      t = { ...shot.end, keeper: keeperFor('middle', shot.end.ball) };
      draw(t);
      if (shot.goal) node.dataset.goal = 'shown';
      await wait(PACE.showNext);
    }
    tell('Your turn! Here is a new one.');
    await wait(PACE.newSetUp);
    next();
  }
  showMe.addEventListener('click', () => { if (!busy) void demo(); });

  async function flick(f: Flick): Promise<void> {
    busy = true;
    board.drop();
    showMe.disabled = true;
    const shot = simulate(table, f);
    touches += 1;
    setPips(touches);
    await board.play(framesOf(table, shot), shot.bumps, keepersOf(table));
    table = { ...shot.end, keeper: keeperFor('middle', shot.end.ball) };
    if (shot.own) {
      tell('Own goal! That one went into your own net.');
      await wait(PACE.newSetUp);
      next();
      return;
    }
    if (shot.goal) {
      goals += 1;
      goalsEl.textContent = String(goals);
      node.dataset.goal = 'scored';
      sfx.cheer();
      tell(`GOL! ${touches === 1 ? 'In one touch!' : `In ${touches} touches.`}`, false);
      narrate('goal', us, () => undefined, life.later);
      await wait(PACE.goal);
      rival = rivalFor(us, rival);
      next();
      return;
    }
    const bumped = shot.bumps.map((b) => b.what);
    const what = !shot.touched ? 'You missed the ball.'
      : bumped.includes('keeper') ? 'The goleiro saved it!'
        : bumped.includes('post') ? 'Off the post!'
          : bumped.includes('block') ? 'A defender blocked it.' : 'Good touch.';
    if (bumped.includes('keeper')) narrate('save', rival, () => undefined, life.later);
    if (touches >= TOUCHES) {
      tell(`${what} No touches left. Here is a new one.`, !bumped.includes('keeper'));
      await wait(PACE.newSetUp);
      next();
      return;
    }
    /* the goleiro gets ready for where the ball is now */
    board.svg.classList.add('keeper-moving');
    draw(table);
    life.later(() => board.svg.classList.remove('keeper-moving'), 400);
    const left = TOUCHES - touches;
    tell(`${what} ${left} ${left === 1 ? 'touch' : 'touches'} left.`, false);
    busy = false;
    showMe.disabled = false;
  }

  board.listen({
    side: () => (busy ? null : 'a'),
    guide: (_side, _index, f) => wayOf(table, f, false),
    flick: (_side, _index, f) => { if (!busy) void flick(f); },
  });

  next();
  return () => life.end();
}
