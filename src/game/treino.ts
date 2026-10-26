/* Treino — pull back a button, let go, and score in three touches.
 *
 * His three buttons are in his team's colours, with the flag on for a
 * country; the other side's three are in the rival's, and their goleiro is a
 * block in front of the goal who gets in line with the ball after each touch.
 *
 * He puts a finger on one of his buttons and pulls back, as the palheta
 * presses on its edge: an arrow shows which way it will go and how hard, and
 * a short dashed line the start of the ball's way. He lets go and it slides.
 * The pull counts from where his finger came down, not from the middle of
 * the button, so a finger resting anywhere on a button, a tap or a palm
 * sends nothing anywhere; under 1.5 units of movement is no flick at all.
 *
 * Nothing guide-like is left on the table once no button is held: the last
 * shot's line, left there, read as "the guide came on by itself". What
 * happened is said in words above the table instead. Show me plays a way to
 * score from the start, and clears it again.
 *
 * Three touches, as in the regra carioca, and before the third the ball has
 * to go to another of his buttons. A goal is shouted by the commentator. All
 * the physics is in src/content/botao.ts; the set-ups in treino.ts. */

import { el, svg } from '../lib/dom';
import { lifetime } from '../lib/life';
import { go } from '../lib/router';
import { sfx } from '../lib/sfx';
import { say } from '../lib/speech';
import {
  BALL, KEEPER_W, KEEPER_Y, L, R, TOUCHES, VIEW,
  flickFor, keeperFor, mayFlick, simulate,
  type Flick, type Point, type Shot, type Table,
} from '../content/botao';
import { drill, type Drill } from '../content/treino';
import { narrate } from './narration';
import { FAR, SHADOW, at, button, goalFrame, pitch, shading } from './table';
import { label, ourTeam, rivalFor } from './teams';

/** how far along its way the ball is shown while he aims */
const GUIDE = 16;

export function mount(root: HTMLElement): () => void {
  const life = lifetime();
  const wait = (ms: number): Promise<void> => new Promise((done) => { life.later(done, ms); });
  const us = ourTeam();
  let rival = rivalFor(us);

  const goalsEl = el('span', { text: '0' });
  const score = el('p', { class: 'score', 'aria-live': 'polite' }, el('span', { class: 'lbl', text: 'Goals' }), goalsEl);
  const back = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Back to the start', text: '←' });
  back.addEventListener('click', () => go('home'));
  const title = el('div', { class: 'titles' }, el('h1', {}, 'Treino'));
  const sayEl = el('p', { class: 'bt-say', 'aria-live': 'polite' });
  const pips = el('span', { class: 'bt-pips', role: 'img' });
  const touchesEl = el('p', { class: 'bt-touches' }, el('span', { text: 'Touches' }), pips);
  const showMe = el('button', { class: 'btn ghost small', type: 'button', text: '👀 Show me' }) as HTMLButtonElement;

  const board = svg('svg', {
    class: 'bt-table', viewBox: `${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`, role: 'img',
    'aria-label': 'The table: your buttons, the ball, and the goal at the top',
  });
  const path = svg('polyline', { class: 'bt-path' });
  const trail = svg('polyline', { class: 'bt-trail' });
  const band = svg('line', { class: 'bt-band' });
  const arrow = svg('polygon', { class: 'bt-arrow' });
  const ghost = svg('circle', { r: R, class: 'bt-ghost', hidden: '' });
  /* drawn round x = 0 and moved by a transform, so it can slide across: a
     block with its shadow, lit on top */
  const block = { x: -KEEPER_W / 2, y: KEEPER_Y[0], width: KEEPER_W, height: KEEPER_Y[1] - KEEPER_Y[0], rx: 0.8 };
  const keeperBlock = svg('rect', { ...block, class: 'bt-keeper-block' });
  const keeperEl = svg('g', { class: 'bt-keeper' },
    svg('rect', { ...block, x: block.x + SHADOW.x, y: block.y + SHADOW.y, class: 'bt-shadow' }),
    keeperBlock,
    svg('rect', { ...block, class: 'bt-keeper-shine' }));
  const ballEl = svg('g', { class: 'bt-ball' },
    svg('circle', { r: BALL, cx: SHADOW.x * 0.6, cy: SHADOW.y * 0.6, class: 'bt-shadow' }),
    svg('circle', { r: BALL, class: 'bt-ball-face' }));
  const discs = svg('g', {});
  const field = pitch();
  board.append(shading(), field, trail, path, ghost, keeperEl, discs, ballEl,
    goalFrame(), svg('g', { class: 'bt-goal-far', transform: FAR }, goalFrame()), band, arrow);
  const ourNet = field.querySelector('.bt-net.ours')!;
  const ownNet = field.querySelector('.bt-goal-far .bt-net')!;
  /* a net shakes when the ball goes in */
  const bulge = (net: Element): void => {
    net.classList.remove('bulge');
    void net.getBoundingClientRect();
    net.classList.add('bulge');
    life.later(() => net.classList.remove('bulge'), 900);
  };

  /* the table's shape, for its size on the screen (app.css) */
  const wrap = el('div', { class: 'bt-wrap', vars: { '--bt-shape': String(VIEW.w / VIEW.h) } }, board);
  const stage = el('div', { class: 'bt-stage' }, wrap);
  const node = el('div', { class: 'game' },
    el('header', { class: 'topbar' }, back, title, score),
    sayEl, stage, el('div', { class: 'bt-foot' }, touchesEl, showMe));
  root.append(node);

  /* ── drawing ─────────────────────────────────────────────────────────── */

  let ours: SVGGElement[] = [];
  let theirs: SVGGElement[] = [];

  function setUp(t: Table): void {
    ours = t.us.map((_, i) => button(us, `us b${i}`));
    theirs = t.them.map(() => button(rival, 'them'));
    discs.replaceChildren(...theirs, ...ours);
    keeperBlock.setAttribute('fill', rival.colours[0]);
  }

  /** everything where it is now */
  function draw(t: Table): void {
    at(ballEl, t.ball);
    t.us.forEach((p, i) => { at(ours[i], p); ours[i].dataset.x = p.x.toFixed(3); ours[i].dataset.y = p.y.toFixed(3); });
    t.them.forEach((p, i) => at(theirs[i], p));
    keeperEl.toggleAttribute('hidden', t.keeper === null);
    if (t.keeper !== null) keeperEl.style.transform = `translateX(${t.keeper.toFixed(2)}px)`;
  }

  /** one frame of a shot */
  const frame = (t: Table, f: Point[]): void =>
    draw({ ...t, ball: f[0], us: f.slice(1, 1 + t.us.length), them: f.slice(1 + t.us.length) });

  /** the shot, played out sixty times a second; noises when the ball is hit */
  function play(t: Table, shot: Shot): Promise<void> {
    return new Promise((done) => {
      const start = performance.now();
      let heard = 0;
      let netted = false;
      const tick = (): void => {
        const i = Math.min(shot.frames.length - 1, Math.floor((performance.now() - start) / (1000 / 60)));
        frame(t, shot.frames[i]);
        if (shot.goal && !netted && shot.frames[i][0].y + BALL < 0) { netted = true; bulge(ourNet); }
        if (shot.own && !netted && shot.frames[i][0].y - BALL > L) { netted = true; bulge(ownNet); }
        for (; heard < shot.bumps.length && shot.bumps[heard].frame <= i; heard += 1) {
          const what = shot.bumps[heard].what;
          if (what === 'touch' || what === 'block') sfx.clack();
          else if (what === 'post') sfx.post();
          else sfx.tap();
        }
        if (i >= shot.frames.length - 1) { done(); return; }
        life.later(tick, 16);
      };
      tick();
    });
  }

  const line = (pts: Point[]): string => pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  /** nothing guide-like left on the table */
  const clearAim = (): void => {
    for (const n of [path, trail, arrow]) n.setAttribute('points', '');
    for (const k of ['x1', 'y1', 'x2', 'y2']) band.setAttribute(k, '0');
    ghost.setAttribute('hidden', '');
  };

  /** the arrow from a button: which way, and how hard */
  function drawArrow(from: Point, f: Flick): void {
    const s = Math.sqrt(f.vx * f.vx + f.vy * f.vy) || 1;
    const [ux, uy] = [f.vx / s, f.vy / s];
    const long = R + 2 + (s / 130) * 16;
    const tip = { x: from.x + ux * long, y: from.y + uy * long };
    const back = { x: tip.x - ux * 3.2, y: tip.y - uy * 3.2 };
    const side = { x: -uy * 2, y: ux * 2 };
    arrow.setAttribute('points', line([
      { x: from.x + ux * R - side.x * 0.35, y: from.y + uy * R - side.y * 0.35 },
      { x: back.x - side.x * 0.35, y: back.y - side.y * 0.35 },
      { x: back.x - side.x, y: back.y - side.y }, tip, { x: back.x + side.x, y: back.y + side.y },
      { x: back.x + side.x * 0.35, y: back.y + side.y * 0.35 },
      { x: from.x + ux * R + side.x * 0.35, y: from.y + uy * R + side.y * 0.35 },
    ]));
  }

  /** where the ball would go: only the start of its way, or all of it */
  function drawGuide(t: Table, f: Flick, all: boolean): void {
    const shot = simulate(t, f);
    const way: Point[] = [];
    let gone = 0;
    for (const fr of shot.frames) {
      const last = way.at(-1);
      if (last && last.x === fr[0].x && last.y === fr[0].y) continue;
      if (last) gone += Math.sqrt((fr[0].x - last.x) ** 2 + (fr[0].y - last.y) ** 2);
      if (!all && gone > GUIDE) break;
      way.push(fr[0]);
    }
    path.setAttribute('points', way.length > 1 ? line(way) : '');
    /* his button's own way, faint, until it reaches the ball */
    const mine = shot.frames.map((fr) => fr[1 + f.button]);
    const hit = shot.bumps.find((b) => b.what === 'touch');
    trail.setAttribute('points', line(mine.slice(0, hit ? hit.frame + 1 : mine.length)));
  }

  function setPips(used: number, tired: number | null): void {
    pips.replaceChildren(...Array.from({ length: TOUCHES }, (_, i) => el('span', { class: `bt-pip${i < used ? ' used' : ''}` })));
    pips.setAttribute('aria-label', `${used} of ${TOUCHES} touches used`);
    node.dataset.touches = String(used);
    ours.forEach((g, i) => g.classList.toggle('tired', i === tired));
  }

  const tell = (words: string, aloud = true): void => {
    sayEl.textContent = words;
    if (aloud) say(words);
  };

  /* ── the game ────────────────────────────────────────────────────────── */

  let goals = 0;
  let d: Drill = drill();
  let table: Table = d.table;
  let touches: number[] = [];
  /* a shot or Show me is playing: no finger does anything until it is over */
  let busy = false;
  let first = true;

  function next(): void {
    d = drill();
    table = { ...d.table, us: [...d.table.us], them: [...d.table.them] };
    touches = [];
    busy = false;
    setUp(table);
    draw(table);
    clearAim();
    setPips(0, null);
    node.dataset.plan = JSON.stringify(d.plan.flicks);
    delete node.dataset.goal;
    showMe.disabled = false;
    tell(first ? `${label(us)} against ${label(rival, true)}. Pull back a button and let go. Three touches to score!` : 'Three touches to score!', first);
    first = false;
  }

  /** the way to score, played from the start, and cleared again */
  async function demo(): Promise<void> {
    busy = true;
    drag = null;
    showMe.disabled = true;
    tell('Watch: here is one way.');
    let t: Table = d.table;
    draw(t);
    clearAim();
    setPips(0, null);
    await wait(900);
    for (const f of d.plan.flicks) {
      /* the spot his button meets the ball */
      const shot = simulate(t, f);
      const meet = shot.bumps.find((b) => b.what === 'touch' && b.who === f.button);
      const spot = meet ? shot.frames[meet.frame][1 + f.button] : t.us[f.button];
      ghost.setAttribute('cx', spot.x.toFixed(2));
      ghost.setAttribute('cy', spot.y.toFixed(2));
      ghost.removeAttribute('hidden');
      drawArrow(t.us[f.button], f);
      drawGuide(t, f, true);
      await wait(1600);
      clearAim();
      await play(t, shot);
      t = { ...shot.end, keeper: keeperFor('middle', shot.end.ball) };
      draw(t);
      if (shot.goal) { node.dataset.goal = 'shown'; bulge(ourNet); }
      await wait(500);
    }
    tell('Your turn! Here is a new one.');
    await wait(1800);
    next();
  }
  showMe.addEventListener('click', () => { if (!busy) void demo(); });

  async function flick(f: Flick): Promise<void> {
    busy = true;
    drag = null;
    showMe.disabled = true;
    const shot = simulate(table, f);
    touches.push(f.button);
    setPips(touches.length, null);
    await play(table, shot);
    table = { ...shot.end, keeper: keeperFor('middle', shot.end.ball) };
    if (shot.own) {
      tell('Own goal! That one went into your own net.');
      await wait(2200);
      next();
      return;
    }
    if (shot.goal) {
      goals += 1;
      goalsEl.textContent = String(goals);
      node.dataset.goal = 'scored';
      sfx.cheer();
      tell(`GOL! ${touches.length === 1 ? 'In one touch!' : `In ${touches.length} touches.`}`, false);
      narrate('goal', us, () => undefined, life.later);
      await wait(2600);
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
    if (touches.length >= TOUCHES) {
      tell(`${what} No touches left. Here is a new one.`, !bumped.includes('keeper'));
      await wait(2200);
      next();
      return;
    }
    /* the goleiro gets ready for where the ball is now */
    keeperEl.classList.add('moving');
    draw(table);
    life.later(() => keeperEl.classList.remove('moving'), 400);
    const tired = touches.length === 2 && touches[0] === touches[1] ? touches[0] : null;
    setPips(touches.length, tired);
    const left = TOUCHES - touches.length;
    tell(`${what} ${left} ${left === 1 ? 'touch' : 'touches'} left.${tired === null ? '' : ' The last one has to be another button: pass!'}`, false);
    busy = false;
    showMe.disabled = false;
  }

  /* ── his finger ──────────────────────────────────────────────────────── */

  /* the button the finger came down on, and where it came down. The pull is
     how far it has moved since, not how far it is from the middle of the
     button: a finger resting anywhere on the button is no pull, and lifting
     it is no flick */
  let drag: { button: number; pointer: number; from: Point } | null = null;
  const toTable = (e: PointerEvent): Point => {
    const box = board.getBoundingClientRect();
    return { x: VIEW.x + ((e.clientX - box.left) / box.width) * VIEW.w, y: VIEW.y + ((e.clientY - box.top) / box.height) * VIEW.h };
  };
  const pullOf = (e: PointerEvent, from: Point): Point => { const p = toTable(e); return { x: p.x - from.x, y: p.y - from.y }; };
  /** a pull too small to see is no pull */
  const tiny = (pull: Point): boolean => Math.sqrt(pull.x * pull.x + pull.y * pull.y) < 1.5;

  board.addEventListener('pointerdown', (e) => {
    if (busy || drag) return;
    const p = toTable(e);
    /* the nearest of his buttons, with some room round it for a small finger */
    let best = -1;
    let near = R + 3;
    table.us.forEach((b, i) => {
      const dist = Math.sqrt((b.x - p.x) ** 2 + (b.y - p.y) ** 2);
      if (dist < near) { near = dist; best = i; }
    });
    if (best < 0) return;
    e.preventDefault();
    if (!mayFlick(touches, best)) {
      sfx.wrong();
      tell('That button has had two touches. Use another one!', false);
      return;
    }
    drag = { button: best, pointer: e.pointerId, from: p };
    try { board.setPointerCapture(e.pointerId); } catch { /* the drag still works inside the table */ }
    clearAim();
  });
  board.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointer || busy) return;
    const pull = pullOf(e, drag.from);
    const from = table.us[drag.button];
    /* the band from the button, as far back as he has pulled */
    band.setAttribute('x1', from.x.toFixed(2)); band.setAttribute('y1', from.y.toFixed(2));
    band.setAttribute('x2', (from.x + pull.x).toFixed(2)); band.setAttribute('y2', (from.y + pull.y).toFixed(2));
    if (tiny(pull)) { for (const n of [path, trail, arrow]) n.setAttribute('points', ''); return; }
    const f = flickFor(drag.button, pull.x, pull.y);
    drawArrow(from, f);
    drawGuide(table, f, false);
  });
  board.addEventListener('pointerup', (e) => {
    if (!drag || e.pointerId !== drag.pointer) return;
    const pull = pullOf(e, drag.from);
    const which = drag.button;
    drag = null;
    clearAim();
    /* a tap, a pull too small to see, or a finger still down from before a
       shot or Show me started, is not a flick */
    if (busy || tiny(pull)) return;
    void flick(flickFor(which, pull.x, pull.y));
  });
  /* the system took the finger (a swipe from the edge, a call): no flick */
  board.addEventListener('pointercancel', (e) => {
    if (drag && e.pointerId === drag.pointer) { drag = null; clearAim(); }
  });

  next();
  return () => life.end();
}
