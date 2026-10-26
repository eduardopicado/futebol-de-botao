/* Treino: Goleiro — ten shots at your goal, to save.
 *
 * The computer's attackers come at the goal at the bottom, set up the way
 * Treino's are (src/content/treino.ts, turned round), with your three
 * defenders standing in the way. It calls "A gol!", you slide your goleiro
 * along the line and tap Pronto, and it shoots, at the level chosen in the
 * settings: straight on easy, off the wall too on medium, and on hard it may
 * pass first, then call again. Its aim stays hidden until you have said
 * Pronto. Saves are counted, and your best run of ten is kept on the device. */

import { el } from '../lib/dom';
import { lifetime } from '../lib/life';
import { go } from '../lib/router';
import { sfx } from '../lib/sfx';
import { read, write } from '../lib/storage';
import { L, W, oneTouch, passPlan, simulate, type Point, type Shot, type Table } from '../content/botao';
import { SKILL, shotFor, wobble } from '../content/computer';
import { clampKeeper, type Scene } from '../content/match';
import { drill } from '../content/treino';
import { makeBoard } from './board';
import { narrate } from './narration';
import { computerLevel } from './choices';
import { modeSwitch } from './treino';
import { label, ourTeam, rivalFor } from './teams';

/** shots in a run */
export const SHOTS = 10;
const BEST = 'goleiro-best';

const turned = (p: Point): Point => ({ x: W - p.x, y: L - p.y });

export function mount(root: HTMLElement): () => void {
  const life = lifetime();
  const wait = (ms: number): Promise<void> => new Promise((done) => { life.later(done, ms); });
  const us = ourTeam();
  const them = rivalFor(us);
  const level = computerLevel();

  const savesEl = el('span', { text: '0' });
  const score = el('p', { class: 'score', 'aria-live': 'polite' }, el('span', { class: 'lbl', text: 'Saves' }), savesEl);
  const back = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Back to the start', text: '←' });
  back.addEventListener('click', () => go('home'));
  const words = el('span', { class: 'say-words' });
  const actions = el('span', { class: 'say-actions' });
  const sayEl = el('div', { class: 'bt-say', 'aria-live': 'polite' }, words, actions);
  const shotEl = el('p', { class: 'bt-touches' });
  const board = makeBoard(life, `The table: your goal at the bottom, and ${them.name}'s attackers coming at it`);
  const stage = el('div', { class: 'bt-stage' }, board.node);
  const overlay = el('div', { class: 'bt-overlay', hidden: '' });
  stage.append(overlay);
  const node = el('div', { class: 'game' },
    el('header', { class: 'topbar' }, back, el('div', { class: 'titles' }, modeSwitch('goleiro')), score),
    sayEl, stage, el('div', { class: 'bt-foot' }, shotEl));
  root.append(node);
  const pronto = el('button', { class: 'btn small pronto', type: 'button', text: '✋ Pronto' });

  /* the attack in the computer's own terms (attacking the top), and your goleiro on the screen */
  let t: Table = drill().table;
  let keeper = W / 2;
  let shotNo = 0;
  let saves = 0;
  /* on hard, a pass first: then it calls again */
  let passed = false;
  let busy = true;

  /** the computer's table as drawn: turned round, so it attacks the bottom */
  const scene = (tt: Table): Scene => ({ ball: turned(tt.ball), a: tt.them.map(turned), b: tt.us.map(turned) });
  const frames = (shot: Shot): Scene[] =>
    shot.frames.map((f) => ({ ball: turned(f[0]), a: f.slice(1 + t.us.length).map(turned), b: f.slice(1, 1 + t.us.length).map(turned) }));
  const draw = (): void => board.draw(scene(t), { top: null, bottom: keeper });

  const tell = (text: string, ...buttons: HTMLElement[]): void => {
    words.textContent = text;
    actions.replaceChildren(...buttons);
  };

  function placing(): void {
    busy = false;
    node.dataset.phase = 'placing';
    board.placing('bottom', (x) => { keeper = clampKeeper(x); draw(); });
    tell(`Shot ${shotNo} of ${SHOTS}: A gol! Slide your goleiro along the line, then tap Pronto.`, pronto);
  }

  function next(): void {
    if (shotNo >= SHOTS) { done(); return; }
    shotNo += 1;
    passed = false;
    t = drill().table;
    keeper = W / 2;
    node.dataset.shot = String(shotNo);
    shotEl.textContent = `Shot ${shotNo} of ${SHOTS} · ${level}`;
    board.glow('b');
    draw();
    sfx.whistle();
    placing();
  }

  async function shoot(): Promise<void> {
    busy = true;
    node.dataset.phase = 'shot';
    board.placing(null);
    tell(`${label(them, true)} shoots…`);
    /* its table sees your goleiro at the top, turned round */
    const mine: Table = { ...t, keeper: W - keeper };
    const buttons = t.us.map((_, i) => i);
    /* hard: a pass to set up the shot, if there is no shot from here */
    const direct = oneTouch(mine, buttons, SKILL[level].walls);
    const pass = SKILL[level].passes && !passed && !direct
      ? buttons.flatMap((from) => buttons.filter((to) => to !== from).map((to) => passPlan(mine, from, to, 'middle'))).find((p) => p)
      : undefined;
    const aim = pass ? wobble(pass.flicks[0], level, Math.random) : wobble(shotFor(mine, buttons, level), level, Math.random);
    await wait(400);
    board.arrow(turned(mine.us[aim.button]), { button: aim.button, vx: -aim.vx, vy: -aim.vy });
    await wait(800);
    board.clearAim();
    const shot = simulate(mine, aim);
    await board.play(frames(shot), shot.bumps, { top: null, bottom: keeper });
    t = { ...shot.end, keeper: null };
    if (pass && !shot.goal) {
      /* a pass: it calls again, and you place your goleiro again */
      passed = true;
      sfx.whistle();
      tell('A pass! A gol! again.');
      await wait(900);
      placing();
      return;
    }
    if (shot.goal) {
      sfx.cheer();
      narrate('goal', them, () => undefined, life.later);
      tell('GOL! It went in.');
      node.dataset.result = 'goal';
    } else {
      saves += 1;
      savesEl.textContent = String(saves);
      narrate('save', us, () => undefined, life.later);
      sfx.right();
      tell(shot.bumps.some((b) => b.what === 'home') ? 'Defendeu! What a save!' : 'Saved! It did not go in.');
      node.dataset.result = 'save';
    }
    node.dataset.saves = String(saves);
    await wait(1800);
    next();
  }

  pronto.addEventListener('click', () => { if (!busy) void shoot(); });

  function done(): void {
    busy = true;
    node.dataset.phase = 'done';
    board.glow(null);
    const best = Math.max(read<number>(BEST, 0), saves);
    write(BEST, best);
    tell(`${saves} of ${SHOTS} saved!`);
    const again = el('button', { class: 'btn', type: 'button', text: '🔁 Again' });
    again.addEventListener('click', () => {
      overlay.setAttribute('hidden', '');
      shotNo = 0;
      saves = 0;
      savesEl.textContent = '0';
      next();
    });
    overlay.replaceChildren(el('div', { class: 'win', role: 'dialog', 'aria-label': 'The run is over' },
      el('p', { class: 'win-shout', text: saves >= 7 ? 'Paredão!' : saves >= 4 ? 'Boa!' : 'Next time!' }),
      el('p', { class: 'win-team', text: `${saves} of ${SHOTS} saved` }),
      el('p', { class: 'win-score', text: `Your best: ${best}` }),
      el('div', { class: 'row' }, again)));
    overlay.removeAttribute('hidden');
  }

  /* the computer's buttons at the top, yours (and your goleiro) at the bottom */
  board.setUp(us, them, { a: t.them.length, b: t.us.length });
  board.listen({ side: () => null, flick: () => undefined });
  next();
  return () => life.end();
}
