/* The computer: its aim and how far off it is at each level, its kick-off,
   when it calls "Pro gol!", its shots, its goleiro, and a whole match of it
   against itself that ends with a winner. */

import { describe, expect, it } from 'vitest';
import { GOLEIROS, L, MOUTH, W, chipPlan, keeperFor, keeperOut, simulate, type Point } from '../../src/content/botao';
import { LEVELS, SKILL, coverKeeper, decide, placeKeeper, shotFor, standKeeper, wobble, type Level } from '../../src/content/computer';
import { RULES, SIZES, call, clampKeeper, flick, inAttack, mayCall, newMatch, other, pronto, tableFor, type Match, type Side } from '../../src/content/match';

const G3 = GOLEIROS['3'];

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

    it(`side ${side}: calls "Pro gol!" with the ball in front of goal, and then scores past a goleiro standing aside`, () => {
      const m = chance(side);
      expect(decide(m, 'hard', steady)).toEqual({ kind: 'call' });
      const keeperAside = side === 'a' ? MOUTH[0] + G3.w / 2 : W - MOUTH[0] - G3.w / 2;
      const ready = pronto(call(m), keeperAside);
      const move = decide(ready, 'hard', steady);
      if (move.kind !== 'flick') throw new Error('a shot is a flick');
      expect(flick(ready, move.button, move.vx, move.vy).event).toEqual({ kind: 'goal', side, own: false });
    });
  }

  it('with no sure way in, still shoots: from near their goal on any flick, from further out on its last', () => {
    /* their goal shut: two of theirs on the line, either side of where its goleiro stands */
    const b = [{ x: 25, y: 5 }, { x: 39, y: 5 }, ...parked('b').slice(2)];
    const near = chance('a', { b, ball: { x: 32, y: 28 }, a: [{ x: 32, y: 40 }, ...parked('a').slice(1)] });
    const far = chance('a', { b, ball: { x: 32, y: 40 }, a: [{ x: 32, y: 52 }, ...parked('a').slice(1)] });
    expect(decide(near, 'medium', steady).kind).toBe('call');
    expect(decide(far, 'medium', steady).kind).toBe('flick');
    expect(decide({ ...far, touches: 2 }, 'medium', steady).kind).toBe('call');
    /* at 1 Toque every flick is the last */
    expect(decide({ ...far, rule: '1' }, 'medium', steady).kind).toBe('call');
  });

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
  for (const rule of RULES) it(`calls "Pro gol!" in a good share of the turns it may, and scores no goal it did not call, at ${rule} Toque${rule === '1' ? '' : 's'}`, () => {
    const rand = seeded(29);
    let [may, calls, uncalled] = [0, 0, 0];
    for (const first of ['a', 'b'] as const) {
      let m = newMatch(2, first, 5, rule);
      let flicks = 0;
      while (m.phase !== 'over' && flicks < 400) {
        if (m.phase === 'placing') { m = pronto(m, placeKeeper(m, 'medium', rand)); continue; }
        if (mayCall(m)) may += 1;
        const move = decide(m, 'medium', rand);
        if (move.kind === 'call') { calls += 1; m = call(m); continue; }
        const play = flick(m, move.button, move.vx, move.vy);
        if (play.event.kind === 'uncalled' && play.event.couldCall) uncalled += 1;
        m = play.next;
        flicks += 1;
      }
    }
    expect(calls / may).toBeGreaterThan(0.2);
    expect(uncalled).toBe(0);
  }, 120_000);

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

describe('its chip (Cobertura)', () => {
  /* the ball straight in front of goal, its button straight behind it, their goleiro in the way */
  const table = { ball: { x: MID, y: 22 }, us: [{ x: MID, y: 34 }], them: [], keeper: MID };

  it('a chip that goes in over the goleiro, where the same flick along the felt is saved; a little off, it still goes in', () => {
    const f = chipPlan(table, [0])!;
    expect(f.lift).toBeGreaterThan(0.5);
    expect(simulate(table, f).goal).toBe(true);
    expect(simulate(table, { ...f, lift: 0 }).goal).toBe(false);
    for (const k of [0.975, 1.025]) expect(simulate(table, { ...f, vx: f.vx * k, vy: f.vy * k }).goal, `speed × ${k}`).toBe(true);
  });

  /** the first choice (to chip or not) as given, everything after it steady */
  const first = (n: number): (() => number) => { let i = 0; return () => (i++ === 0 ? n : 0.5); };

  for (const side of ['a', 'b'] as const) {
    it(`side ${side}: with their goleiro in the way of its called shot, medium and hard chip him now and then, and score; easy never`, () => {
      const put = side === 'a' ? (p: Point): Point => p : turned;
      const m = pronto(call(chance(side, { ball: put(table.ball), [side]: [put(table.us[0]), ...parked(side).slice(1)] })), MID);
      for (const level of ['medium', 'hard'] as const) {
        const move = decide(m, level, first(0.1));
        if (move.kind !== 'flick') throw new Error('no flick');
        expect(move.lift, level).toBeGreaterThan(0.5);
        expect(flick(m, move.button, move.vx, move.vy, move.lift).event, level).toEqual({ kind: 'goal', side, own: false });
        /* and not every time: there is a way in along the felt too */
        const low = decide(m, level, first(0.9));
        expect(low.kind === 'flick' && low.lift === undefined, level).toBe(true);
      }
      const low = decide(m, 'easy', first(0.1));
      expect(low.kind === 'flick' && low.lift === undefined).toBe(true);
    });
  }
});

describe('its goleiro at 1 Toque', () => {
  const G1 = GOLEIROS['1'];
  const one = (m: Match): Match => ({ ...m, rule: '1' });

  it('comes off its line for a called shot, towards the ball: further on hard than medium, never on easy, never at 3 Toques', () => {
    /* a's shot from the left of the area: b's goleiro, at the top */
    const m = call(one(chance('a', { ball: { x: MID - 10, y: 30 }, a: [{ x: MID - 12, y: 42 }, ...parked('a').slice(1)] })));
    const [easy, medium, hard] = (['easy', 'medium', 'hard'] as const).map((level) => standKeeper(m, level, steady));
    expect(easy.out).toBe(0);
    expect(medium.out).toBeCloseTo(0.4 * keeperOut(G1), 6);
    expect(hard.out).toBeCloseTo(0.8 * keeperOut(G1), 6);
    /* out along the way to the ball: nearer the ball's side than on the line */
    expect(hard.x).toBeLessThan(medium.x);
    expect(medium.x).toBeLessThan(easy.x);
    /* and Pronto takes it there */
    const ready = pronto(m, hard.x, hard.out);
    expect(ready.keepers.b).toBeCloseTo(hard.x, 6);
    expect(ready.keepersOut.b).toBeCloseTo(hard.out, 6);
    expect(standKeeper({ ...m, rule: '3' }, 'hard', steady).out).toBe(0);
  });

  it('stays on its line for a penalty', () => {
    const m = { ...call(one(chance('a'))), penalty: true };
    expect(standKeeper(m, 'hard', steady).out).toBe(0);
  });

  it('on its own turn, moves to cover the ball before it flicks: both sides, not on easy, not at 3 Toques, not right on top of the ball', () => {
    for (const side of ['a', 'b'] as const) {
      const put = side === 'a' ? (p: Point): Point => p : turned;
      /* the ball in its own half, to one side */
      const m = one(chance(side, { ball: put({ x: MID + 12, y: 70 }) }));
      const at = coverKeeper(m, 'hard')!;
      expect(at.out).toBeCloseTo(0.8 * keeperOut(G1), 6);
      /* towards the ball's side of its goal */
      expect(Math.sign(at.x - MID)).toBe(Math.sign(m.ball.x - MID));
      expect(coverKeeper(m, 'easy')).toBeNull();
      expect(coverKeeper({ ...m, rule: '3' }, 'hard')).toBeNull();
      /* the ball almost on it: it stays back */
      const near = one(chance(side, { ball: put({ x: MID, y: L - 6 }) }));
      expect(coverKeeper(near, 'hard')!.out).toBe(0);
    }
  });
});
