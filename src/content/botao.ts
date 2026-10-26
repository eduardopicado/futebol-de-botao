/* Futebol de Botão: the table, a flick, and everything that happens after it.
 *
 * Futebol de botão is the Brazilian table game: the players are buttons,
 * flicked with a palheta at a little ball, and the goalkeeper is a block. In
 * the regra carioca, three touches, a side has up to three touches to score,
 * and before the third the ball has to go to another of its buttons.
 *
 * The physics is worked out here a small step at a time, with nothing but
 * + − × ÷ and square roots, so a flick does exactly the same thing on every
 * device and in the tests. A button slides and slows; it knocks the ball
 * along the line through both their middles; things bounce off the rim of
 * the table, the posts, the goleiro and each other.
 *
 * The table is W wide and L long, and he always attacks the goal at the
 * top, y = 0. There is a goal at each end, and both are open: a button can
 * go into the mouth as well as the ball, and the net stops what goes in. */

/* shaped like a real table (a Klopf is 1.86 m by 1.21 m), about half as
   long again as it is wide */
export const W = 64;
export const L = 98;
/** a button's radius, and the ball's */
export const R = 5;
export const BALL = 1.6;
/** the goal mouth, post to post, and how deep the net is */
export const MOUTH: readonly [number, number] = [21, 43];
export const NET = 5;
export const POST = 0.8;
/** the goleiro: a block this wide, just in front of the line */
export const KEEPER_W = 6;
/** the markings at each end, across and deep: the small area (the goal
    area), the penalty area, the spot, and the radius of the arc on the
    penalty area's edge. As on a real table the goal is clearly narrower
    than the small area; the areas are drawn larger than on a real pitch so
    the goal can stay big enough to score in */
export const MARKS = { box: [32, 7], penalty: [50, 18], spot: 12, arc: 8.5 } as const;
export const KEEPER_Y: readonly [number, number] = [0.6, 3.4];
const MID = (MOUTH[0] + MOUTH[1]) / 2;

export interface Point { x: number; y: number }

/** everything on the table: the ball, his buttons, the other side's, and
    where the goleiro stands (the middle of the block), if there is one */
export interface Table {
  ball: Point;
  us: Point[];
  them: Point[];
  keeper: number | null;
}

/** a flick: which of his buttons, and how fast it sets off, in table units a second */
export interface Flick { button: number; vx: number; vy: number }

export type Bump = 'touch' | 'block' | 'keeper' | 'post' | 'wall';

/** the ball coming off the rim: when (a frame number), where its middle was,
    the way into the table from that wall, and the ball's way just before and
    just after */
export interface Bounce { frame: number; at: Point; normal: Point; into: Point; out: Point }

export interface Shot {
  /** every disc's place, sixty times a second: the ball, then his, then theirs */
  frames: Point[][];
  /** where everything stopped */
  end: Table;
  goal: boolean;
  /** the ball went into his own net, at the far end */
  own: boolean;
  /** what the ball hit, in order, and when (a frame number); who is which button */
  bumps: { what: Bump; frame: number; who?: number }[];
  /** every time the ball came off the rim, for showing its angles */
  bounces: Bounce[];
  /** did the flicked button reach the ball itself */
  touched: boolean;
}

/** a flick goes no faster than this */
export const MAX_SPEED = 130;

const DT = 1 / 240;
const PER_FRAME = 4;
const MAX_STEPS = 240 * 8;
/* slowing down: a steady drag of the felt, and a little more the faster it goes */
const SLOW = { button: [40, 0.9], ball: [18, 0.6] } as const;
const MASS = { button: 1, ball: 0.3 };
/* the ball comes off the rim at exactly the angle it went in, which the game
   shows in degrees; off a post or the goleiro it loses a little. A button,
   heavier, thuds */
const BOUNCE = { disc: 0.9, rim: 1, ball: 0.95, button: 0.5, net: 0.1 };

interface Disc { x: number; y: number; vx: number; vy: number; r: number; m: number; ball: boolean }

const len = (x: number, y: number): number => Math.sqrt(x * x + y * y);

/** push a disc off a fixed point it overlaps (by `pad`, for a post), and bounce it */
function offPoint(d: Disc, cx: number, cy: number, pad = 0): boolean {
  const dx = d.x - cx;
  const dy = d.y - cy;
  const reach = d.r + pad;
  if (dx * dx + dy * dy >= reach * reach) return false;
  const dist = len(dx, dy) || 1e-9;
  const nx = dx / dist;
  const ny = dy / dist;
  d.x = cx + nx * reach;
  d.y = cy + ny * reach;
  const vn = d.vx * nx + d.vy * ny;
  const e = d.ball ? BOUNCE.ball : BOUNCE.button;
  if (vn < 0) { d.vx -= (1 + e) * vn * nx; d.vy -= (1 + e) * vn * ny; }
  return true;
}

/** the rim of the table, and the nets: the way into the table from the
    wall it came off, or null. Across a goal mouth there is no wall, for a
    button any more than for the ball: what goes in stops against the net */
function offRim(d: Disc): Point | null {
  let hit: Point | null = null;
  const e = d.ball ? BOUNCE.rim : BOUNCE.button;
  const inMouth = d.x > MOUTH[0] && d.x < MOUTH[1];
  const inNet = inMouth && (d.y < 0 || d.y > L);
  /* in a net, its sides keep it in */
  const lo = inNet ? MOUTH[0] + d.r : d.r;
  const hi = inNet ? MOUTH[1] - d.r : W - d.r;
  if (d.x < lo) { d.x = lo; if (d.vx < 0) d.vx = -d.vx * (inNet ? BOUNCE.net : e); if (!inNet) hit = { x: 1, y: 0 }; }
  if (d.x > hi) { d.x = hi; if (d.vx > 0) d.vx = -d.vx * (inNet ? BOUNCE.net : e); if (!inNet) hit = { x: -1, y: 0 }; }
  const bottom = inMouth ? L + NET - d.r : L - d.r;
  if (d.y > bottom) { d.y = bottom; if (d.vy > 0) d.vy = -d.vy * (inMouth ? BOUNCE.net : e); if (!inMouth) hit = { x: 0, y: -1 }; }
  const top = inMouth ? -NET + d.r : d.r;
  if (d.y < top) { d.y = top; if (d.vy < 0) d.vy = -d.vy * (inMouth ? BOUNCE.net : e); if (!inMouth) hit = { x: 0, y: 1 }; }
  return hit;
}

function offKeeper(d: Disc, keeper: number): boolean {
  const cx = Math.min(keeper + KEEPER_W / 2, Math.max(keeper - KEEPER_W / 2, d.x));
  const cy = Math.min(KEEPER_Y[1], Math.max(KEEPER_Y[0], d.y));
  return offPoint(d, cx, cy);
}

function slow(d: Disc): void {
  const s = len(d.vx, d.vy);
  if (s === 0) return;
  const [steady, more] = d.ball ? SLOW.ball : SLOW.button;
  /* a net stops a ball quickly */
  const net = d.ball && (d.y < 0 || d.y > L) ? 8 : 1;
  const next = s - (steady + more * s) * net * DT;
  if (next <= 0) { d.vx = 0; d.vy = 0; return; }
  d.vx *= next / s;
  d.vy *= next / s;
}

/** what a flick does: every disc moved until they all stop, or the ball is in the net */
export function simulate(table: Table, flick: Flick): Shot {
  const disc = (p: Point, ball: boolean): Disc => ({ x: p.x, y: p.y, vx: 0, vy: 0, r: ball ? BALL : R, m: ball ? MASS.ball : MASS.button, ball });
  const discs = [disc(table.ball, true), ...table.us.map((p) => disc(p, false)), ...table.them.map((p) => disc(p, false))];
  const ours = table.us.length;
  const mover = discs[1 + flick.button];
  const speed = len(flick.vx, flick.vy);
  const k = speed > MAX_SPEED ? MAX_SPEED / speed : 1;
  mover.vx = flick.vx * k;
  mover.vy = flick.vy * k;

  const ball = discs[0];
  const snap = (): Point[] => discs.map((d) => ({ x: d.x, y: d.y }));
  const frames: Point[][] = [snap()];
  const bumps: Shot['bumps'] = [];
  const bounces: Bounce[] = [];
  let goal = false;
  let own = false;
  let touched = false;
  let after = 0;
  /* a ball resting against something is one bump, not one every step */
  let last = '';
  const bump = (what: Bump, step: number, who?: number): void => {
    const key = `${what}${who ?? ''}`;
    if (key === last) return;
    last = key;
    bumps.push({ what, frame: Math.ceil(step / PER_FRAME), ...(who === undefined ? {} : { who }) });
  };

  for (let step = 1; step <= MAX_STEPS; step += 1) {
    for (const d of discs) { d.x += d.vx * DT; d.y += d.vy * DT; }
    for (let i = 0; i < discs.length; i += 1) {
      for (let j = i + 1; j < discs.length; j += 1) {
        const a = discs[i];
        const b = discs[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const reach = a.r + b.r;
        if (dx * dx + dy * dy >= reach * reach) continue;
        const dist = len(dx, dy) || 1e-9;
        const nx = dx / dist;
        const ny = dy / dist;
        const push = (reach - dist) / (1 / a.m + 1 / b.m);
        a.x -= nx * push / a.m; a.y -= ny * push / a.m;
        b.x += nx * push / b.m; b.y += ny * push / b.m;
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rel < 0) {
          const imp = -(1 + BOUNCE.disc) * rel / (1 / a.m + 1 / b.m);
          a.vx -= imp * nx / a.m; a.vy -= imp * ny / a.m;
          b.vx += imp * nx / b.m; b.vy += imp * ny / b.m;
        }
        if (i === 0) {
          if (j <= ours) bump('touch', step, j - 1); else bump('block', step, j - 1 - ours);
          if (b === mover) touched = true;
        }
      }
    }
    for (const d of discs) {
      const into = { x: d.vx, y: d.vy };
      const wall = offRim(d);
      if (wall && d === ball) {
        bump('wall', step);
        /* a real bounce, not a ball resting against the rim or crawling into it */
        if (into.x * wall.x + into.y * wall.y < -3) {
          bounces.push({ frame: Math.ceil(step / PER_FRAME), at: { x: d.x, y: d.y }, normal: wall, into, out: { x: d.vx, y: d.vy } });
        }
      }
      for (const py of [0, L]) for (const px of MOUTH) if (offPoint(d, px, py, POST) && d === ball) bump('post', step);
      if (table.keeper !== null && offKeeper(d, table.keeper) && d === ball) bump('keeper', step);
      slow(d);
    }
    /* over the line: a goal, or one in his own net, and a moment more for
       it to hit the net */
    if (ball.y + BALL < 0) goal = true;
    if (ball.y - BALL > L) own = true;
    if (goal || own) after += 1;
    const done = after > 90 || discs.every((d) => d.vx === 0 && d.vy === 0);
    if (step % PER_FRAME === 0 || done) frames.push(snap());
    if (done) break;
  }
  const at = (d: Disc): Point => ({ x: d.x, y: d.y });
  return {
    frames,
    end: { ball: at(ball), us: discs.slice(1, 1 + ours).map(at), them: discs.slice(1 + ours).map(at), keeper: table.keeper },
    goal,
    own,
    bumps,
    bounces,
    touched,
  };
}

/**
 * How steeply the ball met the wall: the angle between its way and the
 * wall, in whole degrees, 90 when it went straight at it. Only for showing
 * him; the physics never needs an angle.
 */
export function slant(way: Point, normal: Point): number {
  const across = Math.abs(way.x * normal.x + way.y * normal.y);
  const along = Math.abs(way.x * normal.y - way.y * normal.x);
  return Math.round(Math.atan2(across, along) * 180 / Math.PI);
}

/** the angle the ball went into the wall at, and the angle it came off at */
export const angles = (b: Bounce): [number, number] => [slant(b.into, b.normal), slant(b.out, b.normal)];

/**
 * The one bounce whose angles he is shown: the ball's first off the rim, when
 * the button he flicked sent it there with nothing else touching it on the
 * way. A ball that glances off another button, a post or the goleiro first
 * still comes off the wall at the angle it went in, but its way has a corner
 * he did not make and cannot see the reason for, so its angles would only
 * puzzle him. A second bounce adds clutter and nothing new.
 */
export function shownBounce(shot: Shot, button: number): Bounce | null {
  const first = shot.bounces[0];
  if (!first) return null;
  const before = shot.bumps.filter((b) => b.frame <= first.frame && b.what !== 'wall');
  return before.length > 0 && before.every((b) => b.what === 'touch' && b.who === button) ? first : null;
}

/* ── the rules ─────────────────────────────────────────────────────────── */

/** touches in an attack */
export const TOUCHES = 3;

/** before the third touch the ball has to go to another button: the one
    that took both of the first two may not take the third */
export const mayFlick = (touches: readonly number[], button: number): boolean =>
  !(touches.length === 2 && touches[0] === button && touches[1] === button);

export type KeeperPlay = 'none' | 'side' | 'middle';

/**
 * Where the goleiro stands for a ball here. Guarding one side, he covers
 * the post nearer the ball and leaves the far side open; in the middle, he
 * stands on the line from the ball to the middle of the goal, leaving a gap
 * each side.
 */
export function keeperFor(play: KeeperPlay, ball: Point): number | null {
  if (play === 'none') return null;
  const edge = KEEPER_W / 2 + 0.6;
  if (play === 'side') return ball.x < MID ? MOUTH[0] + edge : MOUTH[1] - edge;
  const x = MID + (ball.x - MID) * (KEEPER_Y[1] / Math.max(ball.y, KEEPER_Y[1]));
  return Math.min(MOUTH[1] - edge, Math.max(MOUTH[0] + edge, x));
}

/* ── finding a way to score ────────────────────────────────────────────── */

export type PlanKind = 'straight' | 'cut' | 'wall' | 'pass';

/** the flicks that score from here, and what kind of shot it is */
export interface Plan { flicks: Flick[]; kind: PlanKind }

const GOAL_Y = -2.5;
/* a shot must still score turned a little either way, and a little softer
   or harder: one that only goes in exactly is no use to show a child */
const TURN = 1.5 * Math.PI / 180;
const [COS, SIN] = [Math.cos(TURN), Math.sin(TURN)];
const SPEEDS = [50, 65, 80, 100, 120];

const turned = (f: Flick, sin: number): Flick => ({ button: f.button, vx: f.vx * COS - f.vy * sin, vy: f.vx * sin + f.vy * COS });
const scaled = (f: Flick, k: number): Flick => ({ button: f.button, vx: f.vx * k, vy: f.vy * k });

/** does it still go in if he is a little out? */
export function robust(t: Table, f: Flick): boolean {
  return [turned(f, SIN), turned(f, -SIN), scaled(f, 0.94), scaled(f, 1.06)].every((g) => simulate(t, g).goal);
}

/** the way to flick a button so that it sends the ball towards a point: at
    the ball's far side from that point, where the button will touch it */
export function aimAt(t: Table, button: number, to: Point): { x: number; y: number; cut: number } | null {
  const b = t.ball;
  const p = t.us[button];
  const dl = len(to.x - b.x, to.y - b.y);
  const [dx, dy] = [(to.x - b.x) / dl, (to.y - b.y) / dl];
  /* where the button's middle is when it touches the ball */
  const gx = b.x - dx * (R + BALL);
  const gy = b.y - dy * (R + BALL);
  const al = len(gx - p.x, gy - p.y);
  if (al < 0.5) return null;
  const [ax, ay] = [(gx - p.x) / al, (gy - p.y) / al];
  const cut = ax * dx + ay * dy;
  /* hit too thinly, the ball barely moves */
  return cut < 0.4 ? null : { x: ax, y: ay, cut };
}

/** points in the goal to aim for, the most open first */
function goalPoints(keeper: number | null): number[] {
  const xs: number[] = [];
  for (let x = MOUTH[0] + BALL + POST + 0.6; x <= MOUTH[1] - BALL - POST - 0.6; x += 1.5) xs.push(x);
  if (keeper === null) return xs.sort((a, b) => Math.abs(a - MID) - Math.abs(b - MID));
  return xs.filter((x) => Math.abs(x - keeper) > KEEPER_W / 2 + BALL)
    .sort((a, b) => Math.abs(b - keeper) - Math.abs(a - keeper));
}

/** is the straight way from p to q clear, for a disc of radius r, of every disc but these? */
function clear(t: Table, p: Point, q: Point, r: number, skip: readonly Point[]): boolean {
  const [dx, dy] = [q.x - p.x, q.y - p.y];
  const l2 = dx * dx + dy * dy || 1e-9;
  const others = [...t.us.map((c) => ({ c, r: R })), ...t.them.map((c) => ({ c, r: R })), { c: t.ball, r: BALL }]
    .filter((o) => !skip.includes(o.c));
  return others.every(({ c, r: rc }) => {
    const k = Math.min(1, Math.max(0, ((c.x - p.x) * dx + (c.y - p.y) * dy) / l2));
    const [ex, ey] = [p.x + dx * k - c.x, p.y + dy * k - c.y];
    /* a little leeway: a glancing touch may still let it through, and the sim decides */
    return ex * ex + ey * ey > (rc + r - 0.6) * (rc + r - 0.6);
  });
}

/** a robust one-touch goal for one of these buttons, straight or off a wall */
export function oneTouch(t: Table, buttons: readonly number[], walls: boolean): Plan | null {
  const xs = goalPoints(t.keeper);
  const b = t.ball;
  /* off a wall, aim at the goal as it would be seen in the wall, like a mirror */
  const aims: { to: Point; via?: Point; goal: Point }[] = xs.map((x) => ({ to: { x, y: GOAL_Y }, goal: { x, y: GOAL_Y } }));
  if (walls) {
    for (const x of xs) {
      for (const wx of [BALL, W - BALL]) {
        const to = { x: 2 * wx - x, y: GOAL_Y };
        /* where it meets the wall */
        const k = (wx - b.x) / (to.x - b.x);
        const via = { x: wx, y: b.y + (to.y - b.y) * k };
        if (k > 0 && k < 1 && via.y > 4) aims.push({ to, via, goal: { x, y: GOAL_Y } });
      }
    }
  }
  for (const button of buttons) {
    const me = t.us[button];
    for (const { to, via, goal } of aims) {
      const aim = aimAt(t, button, to);
      if (!aim) continue;
      /* the button's way to the ball, and the ball's way to the goal, must be open */
      const ghost = { x: b.x - (to.x - b.x) / len(to.x - b.x, to.y - b.y) * (R + BALL), y: b.y - (to.y - b.y) / len(to.x - b.x, to.y - b.y) * (R + BALL) };
      if (!clear(t, me, ghost, R, [me, b])) continue;
      const legs = via ? [[b, via], [via, goal]] : [[b, goal]];
      if (!legs.every(([p, q]) => clear(t, p, q, BALL, [b, me]))) continue;
      for (const s of SPEEDS) {
        const f = { button, vx: aim.x * s, vy: aim.y * s };
        const shot = simulate(t, f);
        if (!shot.goal || !shot.touched) continue;
        /* a "straight" shot that only went in off a wall is a wall shot, and the other way round */
        const banked = shot.bumps.some((x) => x.what === 'wall');
        if (banked !== !!via) continue;
        /* one that only just trickles in may go in harder */
        if (!robust(t, f)) continue;
        return { flicks: [f], kind: via ? 'wall' : aim.cut > 0.97 ? 'straight' : 'cut' };
      }
    }
  }
  return null;
}

const SPREAD = 0.45;
const [SC, SS] = [Math.cos(SPREAD), Math.sin(SPREAD)];

/** a pass from one button to another, then that one scores */
export function passPlan(t: Table, from: number, to: number, keeper: KeeperPlay): Plan | null {
  const mate = t.us[to];
  const gl = len(MID - mate.x, GOAL_Y - mate.y);
  const [ux, uy] = [(MID - mate.x) / gl, (GOAL_Y - mate.y) / gl];
  for (const [c, s] of [[1, 0], [SC, SS], [SC, -SS]]) {
    const [vx, vy] = [ux * c - uy * s, ux * s + uy * c];
    for (const gap of [R + BALL + 3, R + BALL + 7]) {
      const spot = { x: mate.x + vx * gap, y: mate.y + vy * gap };
      if (spot.x < BALL + 2 || spot.x > W - BALL - 2 || spot.y < 6) continue;
      const aim = aimAt(t, from, spot);
      if (!aim) continue;
      for (const speed of [35, 45, 55, 70, 85]) {
        const f = { button: from, vx: aim.x * speed, vy: aim.y * speed };
        const shot = simulate(t, f);
        if (!shot.touched || shot.goal) continue;
        const next = { ...shot.end, keeper: keeperFor(keeper, shot.end.ball) };
        const then = oneTouch(next, [to], false);
        if (then) return { flicks: [f, then.flicks[0]], kind: 'pass' };
      }
    }
  }
  return null;
}

/* ── his finger ────────────────────────────────────────────────────────── */

/** a pull back of one table unit sets a button off at this speed */
export const PULL = 5;
/**
 * The wooden tray the table sits in: the design handoff's picture of it
 * (src/assets/tray.webp), 699 × 987, with its felt at 47 across and
 * 58 down, 609 by 838. The tray's front shows below its rim, so it is deeper
 * at the bottom than at the top.
 */
export const TRAY = { w: 699, h: 987, felt: { x: 47, y: 58, w: 609, h: 838 } } as const;
/** the table as drawn, in table units: the tray laid so its felt is exactly
    ours, with a goal at each end on its rim */
export const VIEW = (() => {
  const [kx, ky] = [W / TRAY.felt.w, L / TRAY.felt.h];
  return { x: -TRAY.felt.x * kx, y: -TRAY.felt.y * ky, w: TRAY.w * kx, h: TRAY.h * ky } as const;
})();

/** the flick a pull back gives: the other way, harder the further he pulls */
export function flickFor(button: number, pullX: number, pullY: number): Flick {
  const k = Math.min(1, MAX_SPEED / (len(pullX, pullY) * PULL || 1));
  return { button, vx: -pullX * PULL * k, vy: -pullY * PULL * k };
}
