/* The computer: its aim and how far off it is at each level, its kick-off,
   when it calls "A gol!", its shots, its goleiro, and a whole match of it
   against itself that ends with a winner. */

import { describe, expect, it } from 'vitest';
import { KEEPER_W, L, MOUTH, W, keeperFor, type Point } from '../../src/content/botao';
import { LEVELS, SKILL, decide, placeKeeper, shotFor, wobble, type Level } from '../../src/content/computer';
import { RULES, SIZES, call, clampKeeper, flick, inAttack, newMatch, other, pronto, tableFor, type Match, type Side } from '../../src/content/match';

/* the same choices on every run */
function seeded(seed: number): () => number {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}
const steady = (): number => 0.5;
const turned = (p: Point): Point => ({ x: W - p.x, y: L - p.y });
const MID = (MOUTH[0] + MOUTH[1]) / 2;

const parked = (side: Side): Point[] => [
  { x: 6, y: side === 'a' ? 92 : 6 }, { x: 58, y: side === 'a' ? 92 : 6 },
  { x: 6, y: side === 'a' ? 76 : 22 }, { x: 58, y: side === 'a' ? 76 : 22 }, { x: 58, y: side === 'a' ? 60 : 38 },
];

/** `side` with the ball in front of the other goal, its button behind it */
function chance(side: Side, extra: Partial<Match> = {}): Match {
  const put = side === 'a' ? (p: Point): Point => p : turned;
  const mine = [put({ x: MID, y: 42 }), ...parked(side).slice(1)];
  const m = newMatch(3, side);
  const ball = put({ x: MID, y: 30 });
  return {
    ...m, phase: 'play', touches: 0, used: [], attack: inAttack(ball, side), ball,
    a: side === 'a' ? mine : parked('a'), b: side === 'b' ? mine : parked('b'), ...extra,
  };
}

describe('its aim', () => {
  it('is off by no more than its level allows, either way', () => {
    const f = { button: 0, vx: 0, vy: -100 };
    for (const level of LEVELS) {
      const { turn, power } = SKILL[level];
      for (const r of [0, 1]) {
        const g = wobble(f, level, () => r);
        const angle = Math.abs(Math.atan2(g.vx, -g.vy)) * 180 / Math.PI;
        const speed = Math.sqrt(g.vx ** 2 + g.vy ** 2);
        expect(angle).toBeCloseTo(turn, 6);
        expect(Math.abs(speed / 100 - 1)).toBeCloseTo(power, 6);
      }
      expect(wobble(f, level, steady)).toEqual({ button: 0, vx: 0, vy: -100 });
    }
  });

  it('gets steadier level by level, and only plays off the wall from medium, and passes on hard', () => {
    expect(SKILL.easy.turn).toBeGreaterThan(SKILL.medium.turn);
    expect(SKILL.medium.turn).toBeGreaterThan(SKILL.hard.turn);
    expect([SKILL.easy.walls, SKILL.medium.walls, SKILL.hard.walls]).toEqual([false, true, true]);
    expect([SKILL.easy.passes, SKILL.medium.passes, SKILL.hard.passes]).toEqual([false, false, true]);
  });
});

describe('its turn', () => {
  for (const side of ['a', 'b'] as const) {
    for (const size of SIZES) it(`side ${side}, ${size} a side: kicks off with two different buttons, and the ball leaves the circle`, () => {
      let m = newMatch(3, side, size);
      const first = decide(m, 'medium', steady);
      expect(first.kind).toBe('flick');
      if (first.kind !== 'flick') return;
      const one = flick(m, first.button, first.vx, first.vy);
      m = one.next;
      const second = decide(m, 'medium', steady);
      if (second.kind !== 'flick') throw new Error('a kick-off is two flicks');
      expect(second.button).not.toBe(first.button);
      const two = flick(m, second.button, second.vx, second.vy);
      expect(two.event).toEqual({ kind: 'turn', side: other(side), why: 'kickoff' });
    });

    it(`side ${side}: calls "A gol!" with the ball in front of goal, and then scores past a goleiro standing aside`, () => {
      const m = chance(side);
      expect(decide(m, 'hard', steady)).toEqual({ kind: 'call' });
      const keeperAside = side === 'a' ? MOUTH[0] + KEEPER_W / 2 : W - MOUTH[0] - KEEPER_W / 2;
      const ready = pronto(call(m), keeperAside);
      const move = decide(ready, 'hard', steady);
      if (move.kind !== 'flick') throw new Error('a shot is a flick');
      expect(flick(ready, move.button, move.vx, move.vy).event).toEqual({ kind: 'goal', side, own: false });
    });
  }

  it('does not call a shot from its own half', () => {
    const m = chance('a', { ball: { x: 32, y: 70 }, a: [{ x: 32, y: 82 }, ...parked('a').slice(1)] });
    expect(decide(m, 'hard', steady).kind).toBe('flick');
  });

  it('moves the ball on from its own half without a foul or a goal in its own net, at every level', () => {
    const rand = seeded(11);
    for (const level of LEVELS) {
      for (let n = 0; n < 6; n += 1) {
        const m = { ...newMatch(3, 'b'), phase: 'play' as const, ball: { x: 20 + n * 4, y: 30 } };
        const move = decide(m, level, rand);
        if (move.kind !== 'flick') throw new Error('no shot from here');
        const play = flick(m, move.button, move.vx, move.vy);
        expect(play.event.kind).not.toBe('foul');
        expect(play.event.kind === 'goal' && play.event.side === 'a').toBe(false);
      }
    }
  });

  it('at 1 Toque, frees the ball parked between its own buttons', () => {
    const rand = seeded(5);
    /* its buttons close round the ball, where a careless flick would leave it parked */
    const close = (n: number): Match => ({
      ...newMatch(3, 'b', 4, '1'), phase: 'play', touches: 0, used: [], attack: false, ball: { x: 30 + n, y: 38 },
      b: [{ x: 23, y: 38 }, { x: 37, y: 38 }, { x: 30, y: 26 }, { x: 50, y: 20 }],
    });
    for (const level of LEVELS) {
      for (let n = 0; n < 4; n += 1) {
        const m = close(n);
        const move = decide(m, level, rand);
        if (move.kind !== 'flick') throw new Error('no shot from here');
        expect(flick(m, move.button, move.vx, move.vy).event.kind).not.toBe('parked');
      }
    }
  });

  it('on easy only shoots straight: no wall', () => {
    /* a defender between the ball and the goal: only a wall shot would do */
    const t = { ball: { x: 18, y: 40 }, us: [{ x: 26, y: 48 }], them: [{ x: 22, y: 28 }], keeper: null };
    const easy = shotFor(t, [0], 'easy' as Level);
    const medium = shotFor(t, [0], 'medium');
    expect(easy).not.toEqual(medium);
  });
});

describe('its goleiro', () => {
  it('stands in the middle of the way, on its line, off by a little at the easier levels', () => {
    for (const side of ['a', 'b'] as const) {
      /* `side` shoots, so the computer is the other side and places its goleiro */
      const m = call(chance(side, { ball: side === 'a' ? { x: 20, y: 30 } : turned({ x: 20, y: 30 }) }));
      const { table } = tableFor(m);
      const middle = keeperFor('middle', table.ball)!;
      const exact = clampKeeper(side === 'a' ? middle : W - middle);
      expect(placeKeeper(m, 'hard', steady)).toBeCloseTo(exact, 9);
      for (const level of LEVELS) {
        for (const r of [0, 1]) {
          const x = placeKeeper(m, level, () => r);
          expect(Math.abs(x - exact)).toBeLessThanOrEqual(SKILL[level].keeper + 1e-9);
          expect(x).toBe(clampKeeper(x));
        }
      }
    }
  });
});

describe('a whole match, the computer against itself', () => {
  for (const rule of RULES) it(`is played to the end, with a winner, at every level, at ${rule} Toque${rule === '1' ? '' : 's'}`, () => {
    for (const level of LEVELS) {
      const rand = seeded(level.length * 7);
      let m = newMatch(1, 'a', 4, rule);
      let flicks = 0;
      while (m.phase !== 'over' && flicks < 400) {
        if (m.phase === 'placing') { m = pronto(m, placeKeeper(m, level, rand)); continue; }
        const move = decide(m, level, rand);
        if (move.kind === 'call') { m = call(m); continue; }
        m = flick(m, move.button, move.vx, move.vy).next;
        flicks += 1;
      }
      expect(m.phase).toBe('over');
      expect(m.winner).not.toBeNull();
    }
  }, 120_000);
});
