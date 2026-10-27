/* How to play: a few steps to tap through, each a few words above the table
 * and a little match played on it to show them.
 *
 * The steps and their demos are src/content/guide.ts, played through the
 * match's own rules, for the rule chosen in the settings. Each demo shows the
 * arrow of a flick for a moment, as the computer does, then plays it out,
 * and says in the note what it led to; nothing of it stays on the table but
 * where the buttons ended up. Each step's demo has its own lifetime and its
 * own table, so moving on in the middle of one stops it dead. Opening the
 * guide marks it as seen, and the start screen stops offering it. */

import { el } from '../lib/dom';
import { lifetime, type Life } from '../lib/life';
import { go } from '../lib/router';
import { sfx } from '../lib/sfx';
import { write } from '../lib/storage';
import { guideSteps, played, told, type Step } from '../content/guide';
import type { Match, Scene } from '../content/match';
import { type Board, type Keepers, makeBoard, SHAPE } from './board';
import { goalsToWin, matchRule, speak } from './choices';
import { GUIDE_SEEN } from './home';
import { ourTeam, rivalFor } from './teams';

/** how long a demo waits: before it starts, with a flick's arrow shown,
    while a goleiro slides across, and after each thing it shows */
const PAUSE = { start: 900, aim: 1200, slide: 600, after: 900 } as const;

const sceneOf = (m: Match): Scene => ({ ball: m.ball, a: m.a, b: m.b });
const keepersOf = (m: Match): Keepers => ({ top: m.keepers.b, bottom: m.keepers.a, topOut: m.keepersOut.b, bottomOut: m.keepersOut.a });

export function mount(root: HTMLElement): () => void {
  const life = lifetime();
  write(GUIDE_SEEN, true);
  const rule = matchRule();
  const steps = guideSteps(rule, goalsToWin());
  const us = ourTeam();
  const them = rivalFor(us);
  let at = 0;
  let demoLife: Life | null = null;

  const back = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Back to the start', text: '←' });
  back.addEventListener('click', () => go('home'));
  const count = el('p', { class: 'guide-count' });
  const title = el('h2', { class: 'guide-title' });
  const words = el('p', { class: 'guide-words' });
  const now = el('p', { class: 'guide-now', 'aria-live': 'polite' });
  const prev = el('button', { class: 'btn on-paper ghost small', type: 'button', text: '← Back' }) as HTMLButtonElement;
  const again = el('button', { class: 'btn on-paper ghost small', type: 'button', text: '↺ Again' });
  const next = el('button', { class: 'btn small', type: 'button' });
  const stage = el('div', { class: 'bt-stage' });
  const node = el('div', { class: 'game guide', vars: SHAPE },
    el('header', { class: 'topbar' }, back, el('div', { class: 'titles' }, el('h1', {}, 'How to play'), count)),
    el('section', { class: 'bt-say guide-note', 'aria-label': 'The step' }, title, words, now, el('div', { class: 'guide-nav' }, prev, again, next)),
    stage);
  root.append(node);

  /** a step: its words, said aloud if that is chosen, and its demo from the start */
  function show(i: number, aloud = true): void {
    at = i;
    const s = steps[i];
    demoLife?.end();
    const dl = lifetime();
    demoLife = dl;
    const board = makeBoard(dl, `The table, showing: ${s.title}`);
    board.setUp(us, them, { a: s.demo.start.a.length, b: s.demo.start.b.length });
    stage.replaceChildren(board.node);
    node.dataset.step = s.id;
    count.textContent = `${i + 1} of ${steps.length}`;
    title.textContent = s.title;
    words.textContent = s.words;
    now.textContent = '';
    prev.disabled = i === 0;
    next.textContent = i === steps.length - 1 ? '✓ Got it' : 'Next →';
    if (aloud) speak(`${s.title}. ${s.words}`);
    void demo(s, board, dl);
  }

  /** the step's little match, played out on its own table */
  async function demo(s: Step, board: Board, dl: Life): Promise<void> {
    /* once the step is left this never wakes, and the demo goes no further */
    const wait = (ms: number): Promise<void> => new Promise((done) => { dl.later(done, ms); });
    const d = s.demo;
    node.dataset.demo = 'playing';
    board.draw(sceneOf(d.start), keepersOf(d.start));
    board.glow(d.start.turn);
    await wait(PAUSE.start);
    const plays = played(d);
    if (d.pronto !== undefined) {
      /* A gol! is called, and the other side's goleiro slides across */
      now.textContent = 'A gol!';
      sfx.whistle();
      await wait(PAUSE.after);
      const placed = plays[0].before;
      board.svg.classList.add('keeper-moving');
      board.draw(sceneOf(placed), keepersOf(placed));
      await wait(PAUSE.slide);
      board.svg.classList.remove('keeper-moving');
      now.textContent = 'Pronto!';
      await wait(PAUSE.after);
    }
    for (const [k, { before, play }] of plays.entries()) {
      const f = d.flicks[k];
      board.glow(before.turn, before.phase === 'kickoff' ? before.used : []);
      board.arrow(before[before.turn][f.button]!, f);
      await wait(PAUSE.aim);
      board.clearAim();
      await board.play(play.frames, play.bumps, keepersOf(before));
      now.textContent = told(play, rule);
      if (play.event.kind === 'goal') sfx.cheer();
      if (play.event.kind === 'foul' || play.event.kind === 'parked') sfx.whistle();
      await wait(PAUSE.after);
      /* the free kick set up, or the turn passed; a goal stays where it went in */
      if (play.event.kind !== 'goal') {
        board.draw(sceneOf(play.next), keepersOf(play.next));
        board.glow(play.next.turn);
      }
    }
    node.dataset.demo = 'done';
  }

  prev.addEventListener('click', () => { if (at > 0) { sfx.tap(); show(at - 1); } });
  again.addEventListener('click', () => { sfx.tap(); show(at, false); });
  next.addEventListener('click', () => {
    sfx.tap();
    if (at < steps.length - 1) show(at + 1);
    else go('home');
  });
  const keys = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowRight' && at < steps.length - 1) show(at + 1);
    if (e.key === 'ArrowLeft' && at > 0) show(at - 1);
  };
  document.addEventListener('keydown', keys);

  show(0);
  return () => {
    life.end();
    demoLife?.end();
    document.removeEventListener('keydown', keys);
  };
}
