/* The table on the screen, shared by Treino and the match: the buttons of
 * both sides, the ball and the two goleiros drawn on it, a flick played out
 * sixty times a second with its sounds, and the finger.
 *
 * Side a plays up the table from the bottom ("us" on the screen, its buttons
 * .us .b0 to .b4); side b down it from the top (.them .t0 to .t4). Their
 * goleiros stand at the bottom and the top. Everything is in table units
 * (src/content/botao.ts), the SVG's own.
 *
 * The finger: it comes down on a button and pulls back, as the palheta
 * presses on its edge; an arrow shows which way the button will go and how
 * hard, and a game may show the start of the ball's way too. The pull counts
 * from where the finger came down, not from the middle of the button, so a
 * finger resting anywhere on a button, a tap or a palm sends nothing
 * anywhere: under 1.5 units of movement is no flick. A pointercancel drops
 * the drag, and so does a finger still down when a shot starts. Nothing
 * guide-like stays drawn once no button is held. */

import { el, svg } from '../lib/dom';
import type { Life } from '../lib/life';
import { sfx } from '../lib/sfx';
import { BALL, KEEPER_W, KEEPER_Y, L, MOUTH, R, VIEW, W, flickFor, type Bump, type Flick, type Point } from '../content/botao';
import type { Scene, Side } from '../content/match';
import { FAR, SHADOW, at, button, goalFrame, pitch, shading } from './table';
import type { Team } from './teams';

/** a goleiro's place across its line, or null for none */
export interface Keepers { top: number | null; bottom: number | null }

/** a button out of play, drawn faded on the rim beside the net it went into */
export interface Benched { side: Side; index: number; net: 'top' | 'bottom' }

/** what the finger may do, asked as it comes down */
export interface Finger {
  /** which side's buttons it may pick up now, or null for none */
  side: () => Side | null;
  /** may it pick up this one? Says why not, if it may not */
  may?: (side: Side, index: number) => boolean;
  /** the start of the ball's way for this flick, to show while aiming, if any */
  guide?: (side: Side, index: number, f: Flick) => { ball: Point[]; mine: Point[] } | null;
  /** let go: the flick, as on the screen (up is towards y = 0) */
  flick: (side: Side, index: number, f: Flick) => void;
}

export interface Board {
  /** the table and its tray, sized for the screen */
  node: HTMLElement;
  svg: SVGSVGElement;
  /** the teams, and how many buttons a side */
  setUp: (a: Team, b: Team, counts: { a: number; b: number }) => void;
  draw: (s: Scene, keepers: Keepers, benched?: Benched[]) => void;
  /** a flick played out; resolves when everything has stopped */
  play: (frames: Scene[], bumps: { what: Bump; frame: number }[], keepers: Keepers, benched?: Benched[]) => Promise<void>;
  /** the side to play, glowing */
  glow: (side: Side | null) => void;
  /** the goleiro being placed, which the finger may slide along its line */
  placing: (which: 'top' | 'bottom' | null, onMove?: (x: number) => void) => void;
  arrow: (from: Point, f: Flick) => void;
  /** a way drawn on the table, dashed (Show me) */
  way: (ball: Point[], mine?: Point[]) => void;
  ghost: (at: Point | null) => void;
  clearAim: () => void;
  /** a net shakes */
  bulge: (net: 'top' | 'bottom') => void;
  /** the finger's rules, from now on */
  listen: (f: Finger) => void;
  /** any drag in progress is dropped (a shot or Show me is starting) */
  drop: () => void;
}

const line = (pts: Point[]): string => pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');

/** a goleiro's block, drawn round x = 0 and moved by a transform, so it can slide across */
function keeperBlock(bottom: boolean): { g: SVGGElement; block: SVGRectElement } {
  const [lo, hi] = bottom ? [L - KEEPER_Y[1], L - KEEPER_Y[0]] : KEEPER_Y;
  const shape = { x: -KEEPER_W / 2, y: lo, width: KEEPER_W, height: hi - lo, rx: 0.8 };
  const block = svg('rect', { ...shape, class: 'bt-keeper-block' });
  const g = svg('g', { class: `bt-keeper ${bottom ? 'home' : 'away'}` },
    svg('rect', { ...shape, x: shape.x + SHADOW.x, y: shape.y + SHADOW.y, class: 'bt-shadow' }),
    block,
    svg('rect', { ...shape, class: 'bt-keeper-shine' }));
  return { g, block };
}

/** the table's shape, width over height, for the CSS: on the table, and on a
    game screen that sizes its columns by it */
export const SHAPE = { '--bt-shape': String(VIEW.w / VIEW.h) };

export function makeBoard(life: Life, label: string): Board {
  const board = svg('svg', { class: 'bt-table', viewBox: `${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`, role: 'img', 'aria-label': label });
  const path = svg('polyline', { class: 'bt-path' });
  const trail = svg('polyline', { class: 'bt-trail' });
  const band = svg('line', { class: 'bt-band' });
  const arrowEl = svg('polygon', { class: 'bt-arrow' });
  const ghostEl = svg('circle', { r: R, class: 'bt-ghost', hidden: '' });
  const top = keeperBlock(false);
  const bottom = keeperBlock(true);
  const ballEl = svg('g', { class: 'bt-ball' },
    svg('circle', { r: BALL, cx: SHADOW.x * 0.6, cy: SHADOW.y * 0.6, class: 'bt-shadow' }),
    svg('circle', { r: BALL, class: 'bt-ball-face' }));
  const discs = svg('g', {});
  const field = pitch();
  board.append(shading(), field, trail, path, ghostEl, top.g, bottom.g, discs, ballEl,
    goalFrame(), svg('g', { class: 'bt-goal-far', transform: FAR }, goalFrame()), band, arrowEl);
  const nets = { top: field.querySelector('.bt-net.ours')!, bottom: field.querySelector('.bt-goal-far .bt-net')! };
  /* the table's shape, for its size on the screen (app.css) */
  const node = el('div', { class: 'bt-wrap', vars: SHAPE }, board);

  let buttons: Record<Side, SVGGElement[]> = { a: [], b: [] };
  let scene: Scene = { ball: { x: W / 2, y: L / 2 }, a: [], b: [] };

  const setUp = (a: Team, b: Team, counts: { a: number; b: number }): void => {
    buttons = {
      a: Array.from({ length: counts.a }, (_, i) => button(a, `us b${i}`)),
      b: Array.from({ length: counts.b }, (_, i) => button(b, `them t${i}`)),
    };
    discs.replaceChildren(...buttons.b, ...buttons.a);
    top.block.setAttribute('fill', b.colours[0]);
    bottom.block.setAttribute('fill', a.colours[0]);
  };

  /** on the tray's rim beside a net, where a button out of play waits */
  const bench = (b: Benched, k: number): Point => ({
    x: MOUTH[1] + 7 + k * 6,
    y: b.net === 'top' ? VIEW.y / 2 : L - VIEW.y / 2 + 1,
  });

  const draw = (s: Scene, keepers: Keepers, benched: Benched[] = []): void => {
    scene = s;
    at(ballEl, s.ball);
    for (const side of ['a', 'b'] as const) {
      buttons[side].forEach((g, i) => {
        const p = s[side][i];
        const out = benched.findIndex((b) => b.side === side && b.index === i);
        g.classList.toggle('out', !p);
        if (p) {
          at(g, p);
          g.dataset.x = p.x.toFixed(3);
          g.dataset.y = p.y.toFixed(3);
        } else if (out >= 0) {
          const spot = bench(benched[out], out);
          g.setAttribute('transform', `translate(${spot.x.toFixed(2)} ${spot.y.toFixed(2)}) scale(.55)`);
          delete g.dataset.x;
          delete g.dataset.y;
        }
      });
    }
    for (const [k, el] of [[keepers.top, top.g], [keepers.bottom, bottom.g]] as const) {
      el.toggleAttribute('hidden', k === null);
      if (k !== null) el.style.transform = `translateX(${k.toFixed(2)}px)`;
      el.dataset.x = k === null ? '' : k.toFixed(2);
    }
  };

  const bulge = (net: 'top' | 'bottom'): void => {
    const n = nets[net];
    n.classList.remove('bulge');
    void n.getBoundingClientRect();
    n.classList.add('bulge');
    life.later(() => n.classList.remove('bulge'), 900);
  };

  const play = (frames: Scene[], bumps: { what: Bump; frame: number }[], keepers: Keepers, benched: Benched[] = []): Promise<void> =>
    new Promise((done) => {
      const start = performance.now();
      let heard = 0;
      let netted = false;
      const tick = (): void => {
        if (!life.alive()) return;
        const i = Math.min(frames.length - 1, Math.floor((performance.now() - start) / (1000 / 60)));
        const f = frames[i];
        draw(f, keepers, benched);
        if (!netted && f.ball.y + BALL < 0) { netted = true; bulge('top'); }
        if (!netted && f.ball.y - BALL > L) { netted = true; bulge('bottom'); }
        for (; heard < bumps.length && bumps[heard].frame <= i; heard += 1) {
          const what = bumps[heard].what;
          if (what === 'touch' || what === 'block') sfx.clack();
          else if (what === 'post') sfx.post();
          else sfx.tap();
        }
        if (i >= frames.length - 1) { done(); return; }
        life.later(tick, 16);
      };
      tick();
    });

  const glow = (side: Side | null): void => {
    board.classList.toggle('turn-a', side === 'a');
    board.classList.toggle('turn-b', side === 'b');
  };

  /** the arrow from a button: which way, and how hard */
  const arrow = (from: Point, f: Flick): void => {
    const s = Math.sqrt(f.vx * f.vx + f.vy * f.vy) || 1;
    const [ux, uy] = [f.vx / s, f.vy / s];
    const long = R + 2 + (s / 130) * 16;
    const tip = { x: from.x + ux * long, y: from.y + uy * long };
    const back = { x: tip.x - ux * 3.2, y: tip.y - uy * 3.2 };
    const side = { x: -uy * 2, y: ux * 2 };
    arrowEl.setAttribute('points', line([
      { x: from.x + ux * R - side.x * 0.35, y: from.y + uy * R - side.y * 0.35 },
      { x: back.x - side.x * 0.35, y: back.y - side.y * 0.35 },
      { x: back.x - side.x, y: back.y - side.y }, tip, { x: back.x + side.x, y: back.y + side.y },
      { x: back.x + side.x * 0.35, y: back.y + side.y * 0.35 },
      { x: from.x + ux * R + side.x * 0.35, y: from.y + uy * R + side.y * 0.35 },
    ]));
  };

  const way = (ball: Point[], mine: Point[] = []): void => {
    path.setAttribute('points', ball.length > 1 ? line(ball) : '');
    trail.setAttribute('points', mine.length > 1 ? line(mine) : '');
  };

  const ghost = (p: Point | null): void => {
    if (!p) { ghostEl.setAttribute('hidden', ''); return; }
    ghostEl.setAttribute('cx', p.x.toFixed(2));
    ghostEl.setAttribute('cy', p.y.toFixed(2));
    ghostEl.removeAttribute('hidden');
  };

  const clearAim = (): void => {
    for (const n of [path, trail, arrowEl]) n.setAttribute('points', '');
    for (const k of ['x1', 'y1', 'x2', 'y2']) band.setAttribute(k, '0');
    ghostEl.setAttribute('hidden', '');
  };

  /* ── the finger ─────────────────────────────────────────────────────── */

  let finger: Finger = { side: () => null, flick: () => undefined };
  let drag: { side: Side; index: number; pointer: number; from: Point } | null = null;
  let slide: { which: 'top' | 'bottom'; onMove?: (x: number) => void } | null = null;
  let sliding: { pointer: number; from: number; start: number } | null = null;

  const toTable = (e: PointerEvent): Point => {
    const box = board.getBoundingClientRect();
    return { x: VIEW.x + ((e.clientX - box.left) / box.width) * VIEW.w, y: VIEW.y + ((e.clientY - box.top) / box.height) * VIEW.h };
  };
  const pullOf = (e: PointerEvent, from: Point): Point => { const p = toTable(e); return { x: p.x - from.x, y: p.y - from.y }; };
  /** a pull too small to see is no pull */
  const tiny = (pull: Point): boolean => Math.sqrt(pull.x * pull.x + pull.y * pull.y) < 1.5;
  const keeperAt = (which: 'top' | 'bottom'): number => Number((which === 'top' ? top.g : bottom.g).dataset.x);

  board.addEventListener('pointerdown', (e) => {
    if (drag || sliding) return;
    const p = toTable(e);
    /* the goleiro being placed: a finger near it, along its line, slides it */
    if (slide) {
      const x = keeperAt(slide.which);
      const y = slide.which === 'top' ? (KEEPER_Y[0] + KEEPER_Y[1]) / 2 : L - (KEEPER_Y[0] + KEEPER_Y[1]) / 2;
      if (Math.abs(p.x - x) < KEEPER_W / 2 + 5 && Math.abs(p.y - y) < 8) {
        e.preventDefault();
        sliding = { pointer: e.pointerId, from: p.x, start: x };
        try { board.setPointerCapture(e.pointerId); } catch { /* the slide still works inside the table */ }
      }
      return;
    }
    const side = finger.side();
    if (!side) return;
    /* the nearest of that side's buttons, with some room round it for a finger */
    let best = -1;
    let near = R + 3;
    scene[side].forEach((b, i) => {
      if (!b) return;
      const d = Math.sqrt((b.x - p.x) ** 2 + (b.y - p.y) ** 2);
      if (d < near) { near = d; best = i; }
    });
    if (best < 0) return;
    e.preventDefault();
    if (finger.may && !finger.may(side, best)) return;
    drag = { side, index: best, pointer: e.pointerId, from: p };
    try { board.setPointerCapture(e.pointerId); } catch { /* the drag still works inside the table */ }
    clearAim();
  });
  board.addEventListener('pointermove', (e) => {
    if (sliding && e.pointerId === sliding.pointer && slide) {
      const x = sliding.start + (toTable(e).x - sliding.from);
      slide.onMove?.(x);
      return;
    }
    if (!drag || e.pointerId !== drag.pointer) return;
    const pull = pullOf(e, drag.from);
    const from = scene[drag.side][drag.index]!;
    /* the band from the button, as far back as it has been pulled */
    band.setAttribute('x1', from.x.toFixed(2)); band.setAttribute('y1', from.y.toFixed(2));
    band.setAttribute('x2', (from.x + pull.x).toFixed(2)); band.setAttribute('y2', (from.y + pull.y).toFixed(2));
    if (tiny(pull)) { for (const n of [path, trail, arrowEl]) n.setAttribute('points', ''); return; }
    const f = flickFor(drag.index, pull.x, pull.y);
    arrow(from, f);
    const shown = finger.guide?.(drag.side, drag.index, f);
    way(shown?.ball ?? [], shown?.mine ?? []);
  });
  const up = (e: PointerEvent): void => {
    if (sliding && e.pointerId === sliding.pointer) { sliding = null; return; }
    if (!drag || e.pointerId !== drag.pointer) return;
    const pull = pullOf(e, drag.from);
    const { side, index } = drag;
    drag = null;
    clearAim();
    /* a tap, or a pull too small to see, is not a flick */
    if (tiny(pull)) return;
    finger.flick(side, index, flickFor(index, pull.x, pull.y));
  };
  board.addEventListener('pointerup', up);
  /* the system took the finger (a swipe from the edge, a call): no flick */
  board.addEventListener('pointercancel', (e) => {
    if (sliding && e.pointerId === sliding.pointer) sliding = null;
    if (drag && e.pointerId === drag.pointer) { drag = null; clearAim(); }
  });

  return {
    node,
    svg: board,
    setUp,
    draw,
    play,
    glow,
    placing: (which, onMove) => {
      slide = which ? { which, onMove } : null;
      sliding = null;
      top.g.classList.toggle('placing', which === 'top');
      bottom.g.classList.toggle('placing', which === 'bottom');
    },
    arrow,
    way,
    ghost,
    clearAim,
    bulge,
    listen: (f) => { finger = f; },
    drop: () => { drag = null; sliding = null; clearAim(); },
  };
}
