/* A match: two sides of four or five buttons and a goleiro, first to a number of goals.
 *
 * Side a defends the goal at the bottom and attacks the top; side b the
 * other way. The physics (botao.ts) always plays the side whose turn it is
 * as attacking the top, so for side b the table is turned round half a turn
 * first, and the frames turned back after: the table and both goals are the
 * same either way up, and a flick still does exactly the same thing every
 * time.
 *
 * The rules are the simple ones agreed for the first version, taken from the
 * CBFM's 3 Toques rulebook (2024) where they come from it:
 *
 * - Three free touches: a turn is up to three flicks, with any buttons. It
 *   passes to the other side after the third, straight away when a flick
 *   does not move the ball, or when the ball last touched one of theirs.
 * - "A gol!": a shot only counts when it was called, and it may only be
 *   called in a turn that started with the ball in the attacking half
 *   (Art. 74). The defender then slides their goleiro along the line and
 *   says Pronto (Art. 77). A goal not called is a goal kick (Art. 78).
 * - A foul: one of yours knocks one of theirs before any of yours has touched
 *   the ball (Art. 83). A free kick to them from there, or a penalty if it
 *   was in your own penalty area.
 * - Kick-off from the centre by the side that conceded, or by the toss: two
 *   flicks by different buttons, and the ball has to leave the centre circle
 *   (Art. 67), or it is taken again.
 * - A button that ends up in a net (half over the line, between the posts:
 *   the nets are no deeper than a button) is out of play: it sits out one whole
 *   turn of its side, then comes back on that goal line where the penalty
 *   area meets it, on the right as its own side sees it, once that spot is
 *   free (Art. 28, 29).
 * - The ball never goes out: the rim keeps it in. No offside.
 *
 * A penalty shootout, its own way to play, is at the end of this file.
 *
 * Or a match is played to 1 Toque, from the CBFM's 1 Toque rulebook
 * (v2.1.2, 2010), with everything else as above:
 *
 * - One flick a turn, then it is the other side's (Art. 8 §3); the kick-off
 *   is still two (Art. 15). A shot is called as before, from a turn that
 *   starts with the ball in the attacking half (Art. 21 §3).
 * - The goleiro may stand anywhere in its small area, off its line too: placed
 *   when a shot is called, and moved on its own side's turn (Art. 10).
 * - No parking the ball. Two of your buttons less than a button apart with
 *   the ball between them: your next flick has to free it. Three of yours
 *   boxing it in, after your flick: straight away. Either way, a free kick
 *   to the other side from where the ball is (Art. 8 §10–12, Art. 63). */

import { BALL, KEEPER_OUT, KEEPER_SPAN, KEEPER_W, L, MARKS, MOUTH, R, W, simulate, type Bump, type Point, type Table } from './botao';

export type Side = 'a' | 'b';
export const other = (s: Side): Side => (s === 'a' ? 'b' : 'a');

/** buttons a side, besides its goleiro: the first is the one a match starts with */
export const SIZES = [4, 5] as const;
export const BUTTONS = 5;
/** flicks in a turn, and in a kick-off */
export const TOUCHES = 3;
export const KICKOFF_TOUCHES = 2;
/** the centre circle the kick-off has to leave (the pitch's own, table.ts) */
export const CIRCLE = 8;
/** how many goals win: the first is the one a match starts with */
export const GOALS = [3, 5, 10] as const;
/** the rule a match is played to: 3 Toques, or 1 Toque; the first is the one a match starts with */
export const RULES = ['3', '1'] as const;
export type Rule = (typeof RULES)[number];
/** flicks in a turn, by the rule */
export const touchesFor = (rule: Rule): number => (rule === '1' ? 1 : TOUCHES);
/** a flick that moves the ball less than this has not moved it */
const STILL = 0.3;
/** at a free kick, the fouling side's buttons stand at least this far from the ball */
export const FREE_KICK_GAP = 4 * R;

export type Phase =
  | 'kickoff'
  /** an ordinary turn */
  | 'play'
  /** "A gol!" was called (or a penalty given): the defender places their goleiro */
  | 'placing'
  /** Pronto: the called shot */
  | 'shot'
  /** Pronto at a penalty: its one flick */
  | 'penalty'
  | 'over';

export interface Out { side: Side; index: number; net: 'top' | 'bottom'; since: number }

export interface Match {
  ball: Point;
  /** each side's buttons, null for one that is out of play */
  a: (Point | null)[];
  b: (Point | null)[];
  /** where each goleiro stands across its goal line: a's at the bottom, b's at the top */
  keepers: Record<Side, number>;
  /** how far each goleiro stands off its line: 0 on it (1 Toque lets it come
      out, anywhere in its small area) */
  keepersOut: Record<Side, number>;
  out: Out[];
  score: Record<Side, number>;
  /** goals to win */
  goals: number;
  /** buttons a side, besides the goleiro */
  size: number;
  rule: Rule;
  turn: Side;
  /** counts turns, for when a button that went out comes back */
  turnNo: number;
  phase: Phase;
  /** a penalty is being taken: the placing ends in its one flick */
  penalty: boolean;
  /** flicks so far this turn, and which buttons made them */
  touches: number;
  used: number[];
  /** the turn started with the ball in its attacking half, so it may call a shot */
  attack: boolean;
  winner: Side | null;
}

/** what a flick led to, for the words above the table */
export type Event =
  | { kind: 'goal'; side: Side; own: boolean }
  | { kind: 'champion'; side: Side; own: boolean }
  /** it went in but was not called, or could not be: a goal kick to the other side */
  | { kind: 'uncalled'; side: Side; couldCall: boolean }
  /** `side` was fouled and has the free kick, or the penalty */
  | { kind: 'foul'; side: Side; penalty: boolean }
  /** 1 Toque: the other side parked the ball between its own buttons, and `side` has the free kick */
  | { kind: 'parked'; side: Side }
  /** the kick-off did not leave the circle: again */
  | { kind: 'retake'; side: Side }
  /** the turn passes to `side` */
  | { kind: 'turn'; side: Side; why: 'touches' | 'still' | 'theirs' | 'kickoff' | 'penalty' }
  /** the same side plays on */
  | { kind: 'on'; left: number };

/** where everything is, as drawn: the ball and both sides */
export interface Scene { ball: Point; a: (Point | null)[]; b: (Point | null)[] }

const turned = (p: Point): Point => ({ x: W - p.x, y: L - p.y });
const dist = (p: Point, q: Point): number => Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2);
const MIDDLE = { x: W / 2, y: L / 2 };

/** a goleiro stays on its line, between the posts, give or take */
export const clampKeeper = (x: number): number =>
  Math.min(MOUTH[1] - KEEPER_W / 2 + 1, Math.max(MOUTH[0] + KEEPER_W / 2 - 1, x));

/** is the ball in this side's attacking half (touching the halfway line is in neither) */
export const inAttack = (ball: Point, side: Side): boolean =>
  (side === 'a' ? ball.y + BALL < L / 2 : ball.y - BALL > L / 2);

/**
 * Where a side lines up: two at the back, two in midfield (one, with four
 * buttons), one up front. The side kicking off has its forward behind the
 * ball and a midfielder beside it, both in the centre circle; the other
 * side's forward waits outside it.
 */
export function formation(side: Side, kicking: boolean, size = BUTTONS): Point[] {
  const mid = L / 2;
  const beside = { x: 43, y: mid + 2 };
  const forward = { x: W / 2, y: kicking ? mid + 7.5 : mid + 14 };
  const ours = size === 4
    ? [{ x: 20, y: 84 }, { x: 44, y: 84 }, kicking ? beside : { x: W / 2, y: 76 }, forward]
    : [{ x: 20, y: 84 }, { x: 44, y: 84 }, { x: 12, y: 68 }, kicking ? beside : { x: 52, y: 68 }, forward];
  return side === 'a' ? ours : ours.map(turned);
}

const actives = (m: Match, side: Side): number[] => m[side].flatMap((p, i) => (p ? [i] : []));

/** the table as the physics sees it for the side whose turn it is: attacking the top */
export function tableFor(m: Match): { table: Table; ours: number[]; theirs: number[] } {
  const me = m.turn;
  const you = other(me);
  const ours = actives(m, me);
  const theirs = actives(m, you);
  const put = me === 'a' ? (p: Point): Point => ({ ...p }) : turned;
  const across = me === 'a' ? (x: number): number => x : (x: number): number => W - x;
  return {
    table: {
      ball: put(m.ball),
      us: ours.map((i) => put(m[me][i]!)),
      them: theirs.map((i) => put(m[you][i]!)),
      keeper: across(m.keepers[you]),
      home: across(m.keepers[me]),
      keeperOut: m.keepersOut[you],
      homeOut: m.keepersOut[me],
    },
    ours,
    theirs,
  };
}

function lineUp(m: Match, side: Side): void {
  m.ball = { ...MIDDLE };
  m.a = formation('a', side === 'a', m.size);
  m.b = formation('b', side === 'b', m.size);
  m.keepers = { a: W / 2, b: W / 2 };
  m.keepersOut = { a: 0, b: 0 };
  m.out = [];
  m.turn = side;
  m.turnNo += 1;
  m.phase = 'kickoff';
  m.penalty = false;
  m.touches = 0;
  m.used = [];
  m.attack = false;
}

export function newMatch(goals: number, first: Side, size = BUTTONS, rule: Rule = RULES[0]): Match {
  const m: Match = {
    ball: { ...MIDDLE }, a: [], b: [], keepers: { a: W / 2, b: W / 2 }, keepersOut: { a: 0, b: 0 }, out: [],
    score: { a: 0, b: 0 }, goals, size, rule, turn: first, turnNo: 0, phase: 'kickoff', penalty: false,
    touches: 0, used: [], attack: false, winner: null,
  };
  lineUp(m, first);
  return m;
}

/* ── 1 Toque: no parking the ball ──────────────────────────────────────── */

/** two buttons count as parking the ball when the gap between them is less
    than a button is wide (6 cm on a table whose buttons are 6 cm) */
const PARK = 4 * R;

/** is the ball wholly in the gap between two of these buttons, close together? */
function between2(ball: Point, p: Point, q: Point): boolean {
  const d = dist(p, q);
  if (d >= PARK || d === 0) return false;
  const [ux, uy] = [(q.x - p.x) / d, (q.y - p.y) / d];
  const along = (ball.x - p.x) * ux + (ball.y - p.y) * uy;
  const across = Math.abs((ball.x - p.x) * uy - (ball.y - p.y) * ux);
  return along > 0 && along < d && across <= R - BALL;
}

/** is the ball inside the triangle of three of these buttons, all close together? */
function between3(ball: Point, p: Point, q: Point, r: Point): boolean {
  if (dist(p, q) >= PARK || dist(q, r) >= PARK || dist(r, p) >= PARK) return false;
  const side = (a: Point, b: Point): number => (b.x - a.x) * (ball.y - a.y) - (b.y - a.y) * (ball.x - a.x);
  const [s1, s2, s3] = [side(p, q), side(q, r), side(r, p)];
  return (s1 > 0 && s2 > 0 && s3 > 0) || (s1 < 0 && s2 < 0 && s3 < 0);
}

const live = (ps: (Point | null)[]): Point[] => ps.flatMap((p) => (p ? [p] : []));
const pairs = <T>(xs: T[]): [T, T][] => xs.flatMap((x, i) => xs.slice(i + 1).map((y): [T, T] => [x, y]));

/** is the ball parked between two of these buttons? */
const parkedBy2 = (ball: Point, buttons: (Point | null)[]): boolean =>
  pairs(live(buttons)).some(([p, q]) => between2(ball, p, q));

/** is the ball boxed in by three of these buttons? */
const parkedBy3 = (ball: Point, buttons: (Point | null)[]): boolean => {
  const ps = live(buttons);
  return ps.some((p, i) => pairs(ps.slice(i + 1)).some(([q, r]) => between3(ball, p, q, r)));
};

/** 1 Toque: the side to play has the ball parked between two of its own
    buttons, so its flick has to free it */
export const mustFree = (m: Match): boolean =>
  m.rule === '1' && (m.phase === 'play' || m.phase === 'shot') && parkedBy2(m.ball, m[m.turn]);

/** may this button make the next flick? At a kick-off, the second flick is by another button */
export const mayFlick = (m: Match, button: number): boolean =>
  (m.phase === 'kickoff' || m.phase === 'play' || m.phase === 'shot' || m.phase === 'penalty')
  && m[m.turn][button] !== null
  && !(m.phase === 'kickoff' && m.used.includes(button));

/** may the side playing call "A gol!" now? */
export const mayCall = (m: Match): boolean => m.phase === 'play' && m.attack;

/** "A gol!": the defender places their goleiro */
export function call(m: Match): Match {
  if (!mayCall(m)) return m;
  return { ...m, phase: 'placing' };
}

/** where a goleiro may stand: on its line between the posts, or at 1 Toque
    anywhere in its small area (Art. 10) */
export function placeGoleiro(rule: Rule, x: number, out = 0): { x: number; out: number } {
  if (rule === '3') return { x: clampKeeper(x), out: 0 };
  return { x: Math.min(W / 2 + KEEPER_SPAN, Math.max(W / 2 - KEEPER_SPAN, x)), out: Math.min(KEEPER_OUT, Math.max(0, out)) };
}

/** Pronto: the defender's goleiro stands there, and the shot (or the penalty) may be taken */
export function pronto(m: Match, x: number, out = 0): Match {
  if (m.phase !== 'placing') return m;
  const at = placeGoleiro(m.rule, x, out);
  const you = other(m.turn);
  return { ...m, keepers: { ...m.keepers, [you]: at.x }, keepersOut: { ...m.keepersOut, [you]: at.out }, phase: m.penalty ? 'penalty' : 'shot' };
}

/** 1 Toque: on its own turn a side may move its goleiro anywhere in its small area (Art. 10 §4) */
export const mayMoveGoleiro = (m: Match): boolean => m.rule === '1' && m.phase === 'play';

export function moveGoleiro(m: Match, x: number, out: number): Match {
  if (!mayMoveGoleiro(m)) return m;
  const at = placeGoleiro(m.rule, x, out);
  return { ...m, keepers: { ...m.keepers, [m.turn]: at.x }, keepersOut: { ...m.keepersOut, [m.turn]: at.out } };
}

/* ── moving things about between turns ─────────────────────────────────── */

const onTable = (p: Point, r: number): Point => ({
  x: Math.min(W - r - 0.5, Math.max(r + 0.5, p.x)),
  y: Math.min(L - r - 0.5, Math.max(r + 0.5, p.y)),
});

/**
 * Nudge buttons apart until none overlaps another or the ball, keeping the
 * ball where it is, and these buttons too if given (the ones just placed).
 */
function settle(m: Match, fixed: Point[] = []): void {
  for (let round = 0; round < 40; round += 1) {
    let moved = false;
    const discs = [
      { p: m.ball, r: BALL, fixed: true },
      ...(['a', 'b'] as const).flatMap((s) => m[s].flatMap((p) => (p ? [{ p, r: R, fixed: fixed.includes(p) }] : []))),
    ];
    for (const [i, d] of discs.entries()) {
      for (const e of discs.slice(i + 1)) {
        const gap = d.r + e.r + 0.5 - dist(d.p, e.p);
        if (gap <= 0) continue;
        const l = dist(d.p, e.p) || 1;
        const [ux, uy] = l > 0.01 ? [(e.p.x - d.p.x) / l, (e.p.y - d.p.y) / l] : [0, 1];
        const share = d.fixed && e.fixed ? 0 : d.fixed || e.fixed ? 1 : 0.5;
        if (!e.fixed) Object.assign(e.p, onTable({ x: e.p.x + ux * gap * share, y: e.p.y + uy * gap * share }, e.r));
        if (!d.fixed) Object.assign(d.p, onTable({ x: d.p.x - ux * gap * share, y: d.p.y - uy * gap * share }, d.r));
        moved = true;
      }
    }
    if (!moved) return;
  }
}

/** a button that went out comes back after a whole turn of its side, if its spot is free */
function comeBack(m: Match, ended: Side): void {
  m.out = m.out.filter((o) => {
    if (o.side !== ended || o.since >= m.turnNo) return true;
    /* on the goal line where the penalty area meets it, on the right as its
       side sees it: a looks up the table, b down it */
    const half = MARKS.penalty[0] / 2;
    const spot = { x: o.side === 'a' ? W / 2 + half : W / 2 - half, y: o.net === 'top' ? R + 0.5 : L - R - 0.5 };
    const taken = dist(spot, m.ball) < R + BALL + 0.2
      || (['a', 'b'] as const).some((s) => m[s].some((p) => p && dist(p, spot) < 2 * R + 0.2));
    if (taken) return true;
    m[o.side][o.index] = spot;
    return false;
  });
}

/** the turn passes to `side` */
function pass(m: Match, side: Side): void {
  comeBack(m, m.turn);
  m.turn = side;
  m.turnNo += 1;
  m.phase = 'play';
  m.penalty = false;
  m.touches = 0;
  m.used = [];
  m.attack = inAttack(m.ball, side);
}

/** the goal `side` defends: its line, and which way is out into the table */
const ownGoal = (side: Side): { line: number; into: number } => (side === 'a' ? { line: L, into: -1 } : { line: 0, into: 1 });

/** a free kick to `side` with the ball here: the other side's buttons stand back */
function freeKick(m: Match, side: Side, spot: Point): void {
  m.ball = onTable(spot, BALL + 1);
  for (const p of m[other(side)]) {
    if (!p) continue;
    const d = dist(p, m.ball);
    if (d >= FREE_KICK_GAP) continue;
    const [ux, uy] = d > 0.01 ? [(p.x - m.ball.x) / d, (p.y - m.ball.y) / d] : [0, ownGoal(other(side)).into * -1];
    Object.assign(p, onTable({ x: m.ball.x + ux * FREE_KICK_GAP, y: m.ball.y + uy * FREE_KICK_GAP }, R));
  }
  settle(m);
  pass(m, side);
}

/** a penalty to `side`: the ball on the spot in front of the other side's goal,
    everyone else out of that area, one of `side`'s buttons behind the ball */
function penaltyKick(m: Match, side: Side): void {
  const { line, into } = ownGoal(other(side));
  const [areaW, areaD] = MARKS.penalty;
  const spot = { x: W / 2, y: line + into * MARKS.spot };
  const edge = line + into * (areaD + R + 1);
  const inArea = (p: Point): boolean => Math.abs(p.x - W / 2) < areaW / 2 + R && Math.abs(p.y - line) < areaD + R;
  for (const s of ['a', 'b'] as const) for (const p of m[s]) if (p && inArea(p)) p.y = edge;
  m.ball = spot;
  /* the taker: the nearest of `side`'s buttons, behind the ball */
  const ours = m[side].flatMap((p) => (p ? [p] : [])).sort((p, q) => dist(p, spot) - dist(q, spot));
  const taker = ours[0];
  if (taker) Object.assign(taker, { x: W / 2, y: line + into * (MARKS.spot + 9) });
  settle(m, taker ? [taker] : []);
  pass(m, side);
  m.penalty = true;
  m.phase = 'placing';
  m.attack = false;
}

/** a goal kick to `side`: the ball in its small area */
function goalKick(m: Match, side: Side): void {
  const { line, into } = ownGoal(side);
  m.ball = { x: W / 2, y: line + into * 6 };
  settle(m);
  pass(m, side);
}

/* ── a flick ───────────────────────────────────────────────────────────── */

export interface Play {
  /** every frame of it, as drawn */
  frames: Scene[];
  /** what the ball hit, and when (a frame number), for the sounds */
  bumps: { what: Bump; frame: number }[];
  goal: boolean;
  /** the match after it */
  next: Match;
  event: Event;
}

/**
 * The side whose turn it is flicks one of its buttons (an index into its
 * five), with this speed, as seen on the table (up is towards y = 0).
 */
export function flick(m: Match, button: number, vx: number, vy: number): Play {
  const me = m.turn;
  const you = other(me);
  const { table, ours, theirs } = tableFor(m);
  const index = ours.indexOf(button);
  const flip = me === 'b';
  const shot = simulate(table, { button: index < 0 ? 0 : index, vx: flip ? -vx : vx, vy: flip ? -vy : vy });
  const back = flip ? turned : (p: Point): Point => p;

  /* the frames as drawn: the ball, and each side's buttons in their own places */
  const scene = (f: Point[]): Scene => {
    const s: Scene = { ball: back(f[0]), a: m.a.map(() => null), b: m.b.map(() => null) };
    ours.forEach((i, k) => { s[me][i] = back(f[1 + k]); });
    theirs.forEach((i, k) => { s[you][i] = back(f[1 + ours.length + k]); });
    return s;
  };
  const frames = shot.frames.map(scene);
  const end = frames[frames.length - 1];
  const next: Match = { ...m, ball: end.ball, a: end.a.map((p) => (p ? { ...p } : null)), b: end.b.map((p) => (p ? { ...p } : null)), out: [...m.out], used: [...m.used, button], touches: m.touches + 1, keepers: { ...m.keepers }, keepersOut: { ...m.keepersOut }, score: { ...m.score } };
  const result = (event: Event): Play => ({ frames, bumps: shot.bumps.map(({ what, frame }) => ({ what, frame })), goal: shot.goal || shot.own, next, event });

  /* a button that went into a net is out of play. The nets are as deep as a
     button is round, so one can only ever be half in: in, here, is between
     the posts and more than half way over the line */
  const between = (p: Point): boolean => p.x > MOUTH[0] && p.x < MOUTH[1];
  const into = (p: Point | null): 'top' | 'bottom' | null =>
    (!p || !between(p) ? null : p.y < R / 2 ? 'top' : p.y > L - R / 2 ? 'bottom' : null);
  for (const s of ['a', 'b'] as const) {
    next[s].forEach((p, i) => {
      const net = into(p);
      if (!net) return;
      next[s][i] = null;
      next.out.push({ side: s, index: i, net, since: m.turnNo });
    });
  }

  /* a foul comes first: play stopped there, whatever the ball did after */
  if (shot.foul) {
    const at = back(shot.foul.at);
    const { line } = ownGoal(me);
    const [areaW, areaD] = MARKS.penalty;
    const inArea = Math.abs(at.x - W / 2) < areaW / 2 && Math.abs(at.y - line) < areaD;
    if (inArea) penaltyKick(next, you);
    else freeKick(next, you, at);
    return result({ kind: 'foul', side: you, penalty: inArea });
  }

  /* a goal: in their net and called, or in your own net, which always counts */
  const called = m.phase === 'shot' || m.phase === 'penalty';
  if (shot.own || (shot.goal && called)) {
    const scorer = shot.own ? you : me;
    next.score[scorer] += 1;
    if (next.score[scorer] >= m.goals) {
      next.phase = 'over';
      next.winner = scorer;
      return result({ kind: 'champion', side: scorer, own: shot.own });
    }
    lineUp(next, other(scorer));
    return result({ kind: 'goal', side: scorer, own: shot.own });
  }
  if (shot.goal) {
    goalKick(next, you);
    return result({ kind: 'uncalled', side: me, couldCall: m.attack });
  }

  const last = [...shot.bumps].reverse().find((b) => b.what === 'touch' || b.what === 'block' || b.what === 'keeper' || b.what === 'home');
  const theirsLast = last?.what === 'block' || last?.what === 'keeper';

  if (m.phase === 'kickoff') {
    if (theirsLast) { pass(next, you); return result({ kind: 'turn', side: you, why: 'theirs' }); }
    if (next.touches < KICKOFF_TOUCHES) { next.phase = 'kickoff'; return result({ kind: 'on', left: KICKOFF_TOUCHES - next.touches }); }
    if (dist(next.ball, MIDDLE) <= CIRCLE) {
      lineUp(next, me);
      return result({ kind: 'retake', side: me });
    }
    pass(next, you);
    return result({ kind: 'turn', side: you, why: 'kickoff' });
  }

  if (m.phase === 'penalty') { pass(next, you); return result({ kind: 'turn', side: you, why: 'penalty' }); }
  /* 1 Toque: the ball left parked between two of yours that was parked there
     before the flick, or boxed in by three of yours: a free kick to them */
  if ((mustFree(m) && parkedBy2(next.ball, next[me])) || (m.rule === '1' && parkedBy3(next.ball, next[me]))) {
    freeKick(next, you, next.ball);
    return result({ kind: 'parked', side: you });
  }
  if (dist(next.ball, m.ball) < STILL) { pass(next, you); return result({ kind: 'turn', side: you, why: 'still' }); }
  if (theirsLast) { pass(next, you); return result({ kind: 'turn', side: you, why: 'theirs' }); }
  if (next.touches >= touchesFor(m.rule)) { pass(next, you); return result({ kind: 'turn', side: you, why: 'touches' }); }
  next.phase = 'play';
  return result({ kind: 'on', left: touchesFor(m.rule) - next.touches });
}

/* ── a penalty shootout ────────────────────────────────────────────────── */

/**
 * Five penalties each, taken in turn; decided as soon as one side can no
 * longer be caught, and level after five each it goes on a kick each until
 * one scores and the other does not. Each kick is a penalty as in a match:
 * the ball on the spot, the defender places their goleiro and says Pronto,
 * and the taker has one flick.
 */
export const SHOOTOUT_KICKS = 5;

export interface Shootout {
  first: Side;
  /** whose kick it is */
  turn: Side;
  kicks: { side: Side; scored: boolean }[];
  winner: Side | null;
}

export const newShootout = (first: Side): Shootout => ({ first, turn: first, kicks: [], winner: null });

/** goals and kicks taken by a side so far */
export const shootoutGoals = (s: Shootout, side: Side): number => s.kicks.filter((k) => k.side === side && k.scored).length;
export const shootoutTaken = (s: Shootout, side: Side): number => s.kicks.filter((k) => k.side === side).length;

/** a kick taken, scored or not: the next side's kick, or the winner */
export function kicked(s: Shootout, scored: boolean): Shootout {
  if (s.winner) return s;
  const next: Shootout = { ...s, kicks: [...s.kicks, { side: s.turn, scored }], turn: other(s.turn) };
  const goals = (side: Side): number => shootoutGoals(next, side);
  const taken = (side: Side): number => shootoutTaken(next, side);
  for (const side of ['a', 'b'] as const) {
    const you = other(side);
    /* in the five: out of reach of what the other side has left */
    if (taken(side) <= SHOOTOUT_KICKS && taken(you) <= SHOOTOUT_KICKS && goals(side) > goals(you) + SHOOTOUT_KICKS - taken(you)) next.winner = side;
  }
  /* after the five, or level at the end of them: a kick each, until one is ahead */
  if (!next.winner && taken('a') === taken('b') && taken('a') >= SHOOTOUT_KICKS && goals('a') !== goals('b')) {
    next.winner = goals('a') > goals('b') ? 'a' : 'b';
  }
  return next;
}

/** the table for one kick: the ball on the spot in front of the other side's
    goal, the taker behind it, no one else; the defender's goleiro to place */
export function penaltyFor(taker: Side): Match {
  const m = newMatch(1, taker);
  const { line, into } = ownGoal(other(taker));
  const spot = { x: W / 2, y: line + into * MARKS.spot };
  const behind = { x: W / 2, y: line + into * (MARKS.spot + 9) };
  return {
    ...m, ball: spot, a: [taker === 'a' ? behind : null], b: [taker === 'b' ? behind : null],
    phase: 'placing', penalty: true, attack: false,
  };
}

/** did this flick at a shootout kick score? */
export const scoredFrom = (play: Play, taker: Side): boolean =>
  (play.event.kind === 'goal' || play.event.kind === 'champion') && play.event.side === taker && !play.event.own;

/** how far outside a post a shot can reach the end and still be close, in units (about two balls across) */
const CLOSE = 6;

/**
 * What a shot by `side` that did not go in was, for the commentator: saved
 * by the goleiro, off a post, close (where the ball first reached the end it
 * attacks was just outside a post), or none of those. Only where it first
 * got there: a ball sent into the corner that comes back along the end
 * passes the posts too, and that was no near thing.
 */
export function missed(play: Play, side: Side): 'save' | 'post' | 'close' | null {
  if (play.goal) return null;
  const hit = (what: Bump): boolean => play.bumps.some((b) => b.what === what);
  if (hit('keeper')) return 'save';
  if (hit('post')) return 'post';
  const end = side === 'a' ? 0 : L;
  const first = play.frames.findIndex((f) => Math.abs(f.ball.y - end) <= BALL * 2);
  /* never there, or there already before the flick */
  if (first <= 0) return null;
  const { x } = play.frames[first].ball;
  const out = x < MOUTH[0] ? MOUTH[0] - x : x > MOUTH[1] ? x - MOUTH[1] : 0;
  return out > 0 && out <= CLOSE ? 'close' : null;
}
