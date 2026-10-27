/* The computer: what it flicks, when it calls "A gol!", and where it stands
 * its goleiro.
 *
 * It plays with the planner in botao.ts, and then misses by a little, more
 * at the easier levels: every flick is turned up to a few degrees and made a
 * little harder or softer at random. Easy only shoots straight; medium also
 * plays it off the wall; hard also passes to set up a shot. The flicks are
 * still played by the same physics as everyone's, so a computer flick does
 * exactly what the same flick by a finger would. At 1 Toque it never passes,
 * and it never leaves the ball parked between its own buttons.
 *
 * It decides from the match as it stands (match.ts), on its own turn, and
 * when it has to place its goleiro after the other side calls a shot. Its
 * aim is its own until the flick: the screen shows its arrow only for the
 * moment before it lets go. */

import {
  BALL, L, MOUTH, POST, W, aimAt, keeperFor, oneTouch, passPlan,
  type Flick, type Point, type Table,
} from './botao';
import { clampKeeper, flick, inAttack, mayCall, mayFlick, mustFree, tableFor, type Match } from './match';

export type Level = 'easy' | 'medium' | 'hard';
export const LEVELS: readonly Level[] = ['easy', 'medium', 'hard'];

/** how well it plays: how far off it may aim (degrees), how far off its
    power (a share either way), whether it plays off the wall or passes,
    and how far off it stands its goleiro (table units) */
export interface Skill { turn: number; power: number; walls: boolean; passes: boolean; keeper: number }

export const SKILL: Record<Level, Skill> = {
  easy: { turn: 8, power: 0.25, walls: false, passes: false, keeper: 6 },
  medium: { turn: 4, power: 0.12, walls: true, passes: false, keeper: 3 },
  hard: { turn: 1.5, power: 0.06, walls: true, passes: true, keeper: 1 },
};

type Rand = () => number;

/** what it does on its turn */
export type Move = { kind: 'call' } | { kind: 'flick'; button: number; vx: number; vy: number };

const spread = (rand: Rand): number => rand() * 2 - 1;

/** a flick as it means it, then off by a little, as a finger would be */
export function wobble(f: Flick, level: Level, rand: Rand): Flick {
  const { turn, power } = SKILL[level];
  const a = spread(rand) * turn * Math.PI / 180;
  const k = 1 + spread(rand) * power;
  const [c, s] = [Math.cos(a), Math.sin(a)];
  return { button: f.button, vx: (f.vx * c - f.vy * s) * k, vy: (f.vx * s + f.vy * c) * k };
}

const MID = (MOUTH[0] + MOUTH[1]) / 2;

/** the furthest off a flick can come, each way: turned and harder or softer */
const CORNERS = [[0, 0], [0, 1], [1, 0], [1, 1]] as const;

/** a shot at the goal at the top, from a table where it attacks the top:
    the planner's way to score if there is one, or else the best try, at the
    side of the goal furthest from their goleiro */
export function shotFor(t: Table, buttons: readonly number[], level: Level): Flick {
  const { walls } = SKILL[level];
  const plan = oneTouch(t, buttons, walls);
  if (plan) return plan.flicks[0];
  /* no sure way in: the far side of the goal from the goleiro, from whichever
     button meets the ball fullest */
  const inside = BALL + POST + 0.8;
  const target = { x: t.keeper === null || t.keeper > MID ? MOUTH[0] + inside : MOUTH[1] - inside, y: -2.5 };
  let best: { f: Flick; cut: number } | null = null;
  for (const b of buttons) {
    const aim = aimAt(t, b, target);
    if (aim && (!best || aim.cut > best.cut)) best = { f: { button: b, vx: aim.x * 110, vy: aim.y * 110 }, cut: aim.cut };
  }
  if (best) return best.f;
  /* nothing lines up: straight at the ball, from the nearest */
  const near = [...buttons].sort((p, q) => dist(t.us[p], t.ball) - dist(t.us[q], t.ball))[0];
  const p = t.us[near];
  const d = dist(p, t.ball) || 1;
  return { button: near, vx: (t.ball.x - p.x) / d * 90, vy: (t.ball.y - p.y) / d * 90 };
}

const dist = (p: Point, q: Point): number => Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2);

/** a flick from the side to play's own table (attacking the top) as seen on the screen */
const onScreen = (m: Match, f: Flick, index: number): Move =>
  ({ kind: 'flick', button: index, vx: m.turn === 'a' ? f.vx : -f.vx, vy: m.turn === 'a' ? f.vy : -f.vy });

/** is there a shot worth calling from here, if their goleiro stands in the middle of the way? */
function worthCalling(t: Table, buttons: readonly number[], level: Level): boolean {
  if (t.ball.y > 46) return false;
  const guarded = { ...t, keeper: keeperFor('middle', t.ball) };
  return oneTouch(guarded, buttons, SKILL[level].walls) !== null;
}

/**
 * Moving the ball on, when there is no shot: every button, at a few points
 * ahead of the ball and the goal, at a few speeds, each played through the
 * rules; the best is the one that takes the ball furthest up the table and
 * keeps it, with no foul, no goal it did not call and nothing in its own net.
 */
function advance(m: Match, level: Level, rand: Rand): Move {
  const { table: t, ours } = tableFor(m);
  const b = t.ball;
  const targets = [
    { x: MID, y: -2.5 },
    { x: b.x, y: b.y - 25 },
    { x: Math.max(8, b.x - 14), y: b.y - 22 },
    { x: Math.min(W - 8, b.x + 14), y: b.y - 22 },
  ];
  const stuck = mustFree(m);
  let best: { move: Move; score: number } | null = null;
  for (const [k, index] of ours.entries()) {
    if (!mayFlick(m, index)) continue;
    const p = t.us[k];
    const d = dist(p, b) || 1;
    /* at each of the points, at a few speeds; and with the ball parked
       between two of its own, stepping back off it, which frees it when
       nothing else gets to it */
    const flicks = [
      ...targets.flatMap((to) => {
        const aim = aimAt(t, k, to);
        return aim ? [45, 70, 95].map((speed) => ({ vx: aim.x * speed, vy: aim.y * speed })) : [];
      }),
      ...(stuck ? [{ vx: (p.x - b.x) / d * 50, vy: (p.y - b.y) / d * 50 }] : []),
    ];
    for (const { vx, vy } of flicks) {
      const move = onScreen(m, { button: k, vx, vy }, index);
      if (move.kind !== 'flick') continue;
      const play = flick(m, index, move.vx, move.vy);
      const e = play.event;
      /* how far up the table the ball is now, as this side sees it */
      const up = m.turn === 'a' ? L - play.next.ball.y : play.next.ball.y;
      let score = up;
      if (e.kind === 'on') score += 30;
      if (e.kind === 'turn' && e.why === 'still') score -= 50;
      if (e.kind === 'turn' && e.why === 'theirs') score -= 20;
      if (e.kind === 'foul' || e.kind === 'parked') score -= 200;
      if (e.kind === 'uncalled') score -= 100;
      if ((e.kind === 'goal' || e.kind === 'champion') && e.side !== m.turn) score -= 500;
      /* a little of chance, so it does not always play the same */
      score += rand() * 4;
      /* at 1 Toque, a flick that would leave the ball parked if it came off
         a little, as its flicks do, is as bad as one that does */
      if (m.rule === '1' && e.kind !== 'parked' && (!best || score > best.score)) {
        const off = CORNERS.some((c) => {
          let i = 0;
          const f = wobble({ button: index, vx: move.vx, vy: move.vy }, level, () => c[i++ % 2]);
          return flick(m, index, f.vx, f.vy).event.kind === 'parked';
        });
        if (off) score -= 200;
      }
      if (!best || score > best.score) best = { move, score };
    }
  }
  if (best) return best.move;
  /* nothing lines up: the nearest, straight at the ball */
  const f = shotFor(t, ours.map((_, k) => k).filter((k) => mayFlick(m, ours[k])), 'easy');
  return onScreen(m, f, ours[f.button]);
}

/** the kick-off: the button beside the ball sends it out of the circle; then
    another, that is not near it, makes the second flick */
function kickoff(m: Match): Move {
  const { table: t, ours } = tableFor(m);
  const order = ours.map((index, k) => ({ index, k })).sort((p, q) => dist(t.us[p.k], t.ball) - dist(t.us[q.k], t.ball));
  if (m.touches === 0) {
    /* the second nearest is beside the ball, level with it: it sends the ball out sideways */
    const kicker = order[1] ?? order[0];
    const p = t.us[kicker.k];
    const d = dist(p, t.ball) || 1;
    return onScreen(m, { button: kicker.k, vx: (t.ball.x - p.x) / d * 70, vy: (t.ball.y - p.y) / d * 70 }, kicker.index);
  }
  const spare = [...order].reverse().find((o) => mayFlick(m, o.index))!;
  /* back towards its own goal, away from everything */
  return onScreen(m, { button: spare.k, vx: 0, vy: 12 }, spare.index);
}

/** its move on its own turn */
export function decide(m: Match, level: Level, rand: Rand = Math.random): Move {
  if (m.phase === 'kickoff') return kickoff(m);
  const { table: t, ours } = tableFor(m);
  const may = ours.map((_, k) => k).filter((k) => mayFlick(m, ours[k]));
  if (m.phase === 'shot' || m.phase === 'penalty') {
    const f = wobble(shotFor(t, may, level), level, rand);
    return onScreen(m, f, ours[f.button]);
  }
  if (mayCall(m) && worthCalling(t, may, level)) return { kind: 'call' };
  /* hard: a pass to a team-mate in front of goal, to shoot from there (not
     at 1 Toque, where the other side plays before the shot could) */
  if (SKILL[level].passes && m.rule === '3' && inAttack(m.ball, m.turn) && m.touches < 2) {
    for (const from of may) {
      for (const to of may) {
        if (from === to) continue;
        const plan = passPlan(t, from, to, 'middle');
        if (plan) return onScreen(m, wobble(plan.flicks[0], level, rand), ours[from]);
      }
    }
  }
  const move = advance(m, level, rand);
  if (move.kind !== 'flick') return move;
  /* aimed, and then a little off */
  const f = wobble({ button: move.button, vx: move.vx, vy: move.vy }, level, rand);
  return { kind: 'flick', button: move.button, vx: f.vx, vy: f.vy };
}

/**
 * Where it stands its goleiro after the other side calls a shot: in the
 * middle of the ball's way to the goal, off by a little at the easier levels.
 * Its goleiro guards the goal the shooter attacks, at the top of the
 * shooter's own table.
 */
export function placeKeeper(m: Match, level: Level, rand: Rand = Math.random): number {
  const { table: t } = tableFor(m);
  const x = (keeperFor('middle', t.ball) ?? MID) + spread(rand) * SKILL[level].keeper;
  /* back from the shooter's table to the screen */
  return clampKeeper(m.turn === 'a' ? x : W - x);
}

/** the computer's side, in a match against it: the top */
export const COMPUTER = 'b' as const;
