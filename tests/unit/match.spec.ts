/* A match: turns, "A gol!", fouls and penalties, kick-off, buttons in a net,
   and winning, for both sides. */

import { describe, expect, it } from 'vitest';
import { BALL, KEEPER_OUT, KEEPER_SPAN, KEEPER_W, L, MARKS, MOUTH, R, W, oneTouch, simulate, type Point } from '../../src/content/botao';
import {
  BUTTONS, CIRCLE, SIZES, FREE_KICK_GAP, call, clampKeeper, flick, formation, inAttack, mayCall, mayFlick, mayMoveGoleiro, moveGoleiro, mustFree,
  newMatch, other, placeGoleiro, pronto, tableFor,
  kicked, missed, newShootout, penaltyFor, scoredFrom, shootoutGoals, shootoutTaken,
  type Match, type Shootout, type Side,
} from '../../src/content/match';

const dist = (p: Point, q: Point): number => Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2);
const turned = (p: Point): Point => ({ x: W - p.x, y: L - p.y });
const MIDDLE = { x: W / 2, y: L / 2 };

/** a match in ordinary play, with everything where it is given */
function playing(over: Partial<Match> & { turn: Side }): Match {
  const m = newMatch(3, over.turn);
  return { ...m, phase: 'play', touches: 0, used: [], attack: inAttack(over.ball ?? m.ball, over.turn), ...over };
}

/** far out of everyone's way, for buttons a test does not need */
const parked = (side: Side): Point[] => [
  { x: 6, y: side === 'a' ? 92 : 6 }, { x: 58, y: side === 'a' ? 92 : 6 },
  { x: 6, y: side === 'a' ? 76 : 22 }, { x: 58, y: side === 'a' ? 76 : 22 }, { x: 58, y: side === 'a' ? 60 : 38 },
];

describe('the line-up', () => {
  it('puts four or five a side on the table, nothing touching, the kickers in the circle and the others out of it', () => {
    for (const size of SIZES) for (const first of ['a', 'b'] as const) {
      const m = newMatch(3, first, size);
      expect(m.a).toHaveLength(size);
      expect(m.b).toHaveLength(size);
      expect(m.ball).toEqual(MIDDLE);
      expect(m.phase).toBe('kickoff');
      expect(m.turn).toBe(first);
      const all = [...m.a, ...m.b] as Point[];
      for (const [i, p] of all.entries()) {
        expect(p.x - R).toBeGreaterThan(0);
        expect(p.x + R).toBeLessThan(W);
        expect(p.y - R).toBeGreaterThan(0);
        expect(p.y + R).toBeLessThan(L);
        expect(dist(p, m.ball)).toBeGreaterThan(R + BALL);
        for (const q of all.slice(i + 1)) expect(dist(p, q)).toBeGreaterThan(2 * R);
      }
      /* each side in its own half */
      for (const p of m.a as Point[]) expect(p.y).toBeGreaterThan(L / 2);
      for (const p of m.b as Point[]) expect(p.y).toBeLessThan(L / 2);
      const near = (side: Side): number => (m[side] as Point[]).filter((p) => dist(p, MIDDLE) < CIRCLE + R + 6).length;
      expect(near(first)).toBe(2);
      expect((m[first === 'a' ? 'b' : 'a'] as Point[]).every((p) => dist(p, MIDDLE) > CIRCLE + R)).toBe(true);
    }
  });

  it('is the same for both sides, turned round', () => {
    for (const size of SIZES) expect(formation('b', true, size)).toEqual(formation('a', true, size).map(turned));
  });

  it('five a side unless asked, and the same number again after a goal', () => {
    expect(newMatch(3, 'a').a).toHaveLength(BUTTONS);
    let m: Match = { ...newMatch(3, 'a', 4), turn: 'a' as Side, phase: 'shot' as const, touches: 0, used: [], attack: true,
      ball: { x: 32, y: 6 }, a: [{ x: 32, y: 14 }, ...parked('a').slice(1, 4)], b: parked('b').slice(0, 4), keepers: { a: 32, b: 12 } };
    m = flick(m, 0, 0, -60).next;
    expect(m.score.a).toBe(1);
    expect(m.a).toHaveLength(4);
    expect(m.b).toHaveLength(4);
  });
});

describe('the table, either way up', () => {
  it('plays side b exactly as side a, turned round', () => {
    const forA = flick(newMatch(3, 'a'), 4, 0, -45);
    const forB = flick(newMatch(3, 'b'), 4, 0, 45);
    const ball = forA.next.ball;
    expect(forB.next.ball.x).toBeCloseTo(W - ball.x, 9);
    expect(forB.next.ball.y).toBeCloseTo(L - ball.y, 9);
    expect(forB.frames.length).toBe(forA.frames.length);
  });

  it('gives the physics the side playing attacking the top, with their goleiro at the top and its own at the bottom', () => {
    const m = playing({ turn: 'b', keepers: { a: 25, b: 40 } });
    const { table } = tableFor(m);
    expect(table.keeper).toBe(W - 25);
    expect(table.home).toBe(W - 40);
    expect(table.us[0]).toEqual(turned(m.b[0]!));
  });
});

describe('kick-off', () => {
  it('is two flicks by different buttons', () => {
    const m = newMatch(3, 'a');
    const first = flick(m, 4, 0, -12);
    expect(first.event).toEqual({ kind: 'on', left: 1 });
    expect(mayFlick(first.next, 4)).toBe(false);
    expect(mayFlick(first.next, 3)).toBe(true);
  });

  it('is taken again when the ball stays in the circle', () => {
    const m = newMatch(3, 'b');
    /* two of b's back buttons, nudged back towards their own goal: the ball never moves */
    const once = flick(m, 0, 0, -10);
    const twice = flick(once.next, 1, 0, -10);
    expect(twice.event).toEqual({ kind: 'retake', side: 'b' });
    expect(twice.next.phase).toBe('kickoff');
    expect(twice.next.turn).toBe('b');
    expect(twice.next.ball).toEqual(MIDDLE);
  });

  it('passes to the other side once the ball is out of the circle', () => {
    const m = newMatch(3, 'a');
    /* the midfielder beside the ball, through it, out to the left */
    const [kicker, ball] = [m.a[3]!, m.ball];
    const d = dist(kicker, ball);
    const once = flick(m, 3, (ball.x - kicker.x) / d * 70, (ball.y - kicker.y) / d * 70);
    expect(dist(once.next.ball, MIDDLE)).toBeGreaterThan(CIRCLE);
    const twice = flick(once.next, 0, 0, 10);
    expect(twice.event).toEqual({ kind: 'turn', side: 'b', why: 'kickoff' });
    expect(twice.next.phase).toBe('play');
    expect(twice.next.turn).toBe('b');
  });
});

describe('three free touches', () => {
  /* a's button straight behind the ball, everyone else out of the way */
  const lined = (): Match => playing({
    turn: 'a', ball: { x: 32, y: 60 },
    a: [{ x: 32, y: 72 }, ...parked('a').slice(1)], b: parked('b'),
  });

  it('plays on after a touch, with any button, and passes after the third', () => {
    let m = lined();
    const one = flick(m, 0, 0, -40);
    expect(one.event).toEqual({ kind: 'on', left: 2 });
    m = one.next;
    /* the same button again, and again: the simple rule allows it */
    const ball = (): Point => m.ball;
    const at = (): Point => m.a[0]!;
    const towards = (k: number): [number, number] => { const d = dist(ball(), at()); return [(ball().x - at().x) / d * k, (ball().y - at().y) / d * k]; };
    const two = flick(m, 0, ...towards(70));
    expect(two.event).toEqual({ kind: 'on', left: 1 });
    m = two.next;
    const three = flick(m, 0, ...towards(70));
    expect(three.event).toEqual({ kind: 'turn', side: 'b', why: 'touches' });
    expect(three.next.turn).toBe('b');
    expect(three.next.touches).toBe(0);
  });

  it('passes straight away when a flick does not move the ball', () => {
    const missed = flick(lined(), 1, 10, 0);
    expect(missed.event).toEqual({ kind: 'turn', side: 'b', why: 'still' });
  });

  it("passes straight away when the ball last touched one of theirs", () => {
    const m = playing({
      turn: 'a', ball: { x: 32, y: 60 },
      a: [{ x: 32, y: 72 }, ...parked('a').slice(1)], b: [{ x: 32, y: 44 }, ...parked('b').slice(1)],
    });
    const blocked = flick(m, 0, 0, -60);
    expect(blocked.event).toEqual({ kind: 'turn', side: 'b', why: 'theirs' });
  });
});

describe('"A gol!"', () => {
  const MID = (MOUTH[0] + MOUTH[1]) / 2;
  const chance = (side: Side): Match => {
    const a = side === 'a';
    const put = a ? (p: Point): Point => p : turned;
    return playing({
      turn: side, ball: put({ x: MID, y: 30 }),
      a: a ? [{ x: MID, y: 42 }, ...parked('a').slice(1)] : parked('a'),
      b: a ? parked('b') : [turned({ x: MID, y: 42 }), ...parked('b').slice(1)],
      /* the other side's goleiro off to one side, so a shot straight on goes in */
      keepers: a ? { a: W / 2, b: MOUTH[0] + KEEPER_W / 2 } : { a: W - MOUTH[0] - KEEPER_W / 2, b: W / 2 },
    });
  };

  it('may only be called in a turn that started in the attacking half', () => {
    expect(mayCall(chance('a'))).toBe(true);
    expect(mayCall(playing({ turn: 'a', ball: { x: 32, y: 70 } }))).toBe(false);
    /* touching the halfway line is in neither half */
    expect(inAttack({ x: 32, y: L / 2 - BALL + 0.1 }, 'a')).toBe(false);
    expect(mayCall({ ...chance('a'), phase: 'kickoff' })).toBe(false);
  });

  for (const side of ['a', 'b'] as const) {
    it(`side ${side}: called, the goleiro placed, Pronto, and the shot past him counts`, () => {
      let m = call(chance(side));
      expect(m.phase).toBe('placing');
      expect(mayFlick(m, 0)).toBe(false);
      /* the defender stands their goleiro to one side, and the shot goes the other */
      const keeperAt = MOUTH[0] + KEEPER_W / 2;
      m = pronto(m, side === 'a' ? keeperAt : W - keeperAt);
      expect(m.phase).toBe('shot');
      const { table } = tableFor(m);
      const plan = oneTouch(table, [0], false)!;
      const f = plan.flicks[0];
      const play = flick(m, 0, side === 'a' ? f.vx : -f.vx, side === 'a' ? f.vy : -f.vy);
      expect(play.event).toEqual({ kind: 'goal', side, own: false });
      expect(play.next.score[side]).toBe(1);
      /* and the other side kicks off */
      expect(play.next.phase).toBe('kickoff');
      expect(play.next.turn).toBe(side === 'a' ? 'b' : 'a');
      expect(play.next.ball).toEqual(MIDDLE);
    });
  }

  it('keeps the goleiro on its line, between the posts', () => {
    expect(clampKeeper(0)).toBeGreaterThan(MOUTH[0]);
    expect(clampKeeper(100)).toBeLessThan(MOUTH[1]);
    expect(clampKeeper(W / 2)).toBe(W / 2);
  });

  it('does not count a goal that was not called: a goal kick to the other side', () => {
    const m = chance('a');
    const play = flick(m, 0, 0, -90);
    expect(play.goal).toBe(true);
    expect(play.event).toEqual({ kind: 'uncalled', side: 'a', couldCall: true });
    expect(play.next.score.a).toBe(0);
    expect(play.next.turn).toBe('b');
    /* the ball in b's small area, at the top */
    expect(play.next.ball.y).toBeLessThan(MARKS.box[1]);
    expect(play.next.attack).toBe(false);
  });

  it('counts a goal in your own net, called or not, for the other side', () => {
    const m = playing({ turn: 'a', ball: { x: 32, y: 84 }, a: [{ x: 32, y: 72 }, ...parked('a').slice(1)], b: parked('b'), keepers: { a: 12, b: 32 } });
    const play = flick(m, 0, 0, 100);
    expect(play.event).toEqual({ kind: 'goal', side: 'b', own: true });
    expect(play.next.score.b).toBe(1);
    expect(play.next.turn).toBe('a');
  });

  it('wins the match at the last goal', () => {
    const m = { ...call(chance('a')), score: { a: 2, b: 1 } };
    const ready = pronto(m, MOUTH[0] + KEEPER_W / 2);
    const plan = oneTouch(tableFor(ready).table, [0], false)!;
    const play = flick(ready, 0, plan.flicks[0].vx, plan.flicks[0].vy);
    expect(play.event).toEqual({ kind: 'champion', side: 'a', own: false });
    expect(play.next.phase).toBe('over');
    expect(play.next.winner).toBe('a');
    expect(play.next.score).toEqual({ a: 3, b: 1 });
  });
});

describe('fouls', () => {
  it('a button knocked before the ball is touched: a free kick to them from there, their opponents stood back', () => {
    /* a's button flicked straight into b's, which stands between it and the ball */
    const m = playing({
      turn: 'a', ball: { x: 32, y: 40 },
      a: [{ x: 32, y: 66 }, ...parked('a').slice(1)], b: [{ x: 32, y: 54 }, ...parked('b').slice(1)],
    });
    const play = flick(m, 0, 0, -50);
    expect(play.event).toEqual({ kind: 'foul', side: 'b', penalty: false });
    const n = play.next;
    expect(n.turn).toBe('b');
    expect(n.phase).toBe('play');
    expect(dist(n.ball, { x: 32, y: 54 })).toBeLessThan(R);
    for (const p of n.a) if (p) expect(dist(p, n.ball)).toBeGreaterThanOrEqual(FREE_KICK_GAP - 0.01);
  });

  it('touching the ball first is no foul, whatever is hit after', () => {
    const m = playing({
      turn: 'a', ball: { x: 32, y: 60 },
      a: [{ x: 32, y: 72 }, ...parked('a').slice(1)], b: [{ x: 32, y: 50 }, ...parked('b').slice(1)],
    });
    const shot = simulate(tableFor(m).table, { button: 0, vx: 0, vy: -80 });
    expect(shot.foul).toBeNull();
    expect(flick(m, 0, 0, -80).event.kind).not.toBe('foul');
  });

  it('in your own penalty area, a penalty: the ball on the spot, the area cleared, the goleiro to be placed', () => {
    /* b's attacker in a's area, a's defender flicked into it */
    const m = playing({
      turn: 'a', ball: { x: 50, y: 70 },
      a: [{ x: 32, y: 92 }, ...parked('a').slice(1).map((p) => ({ ...p, y: p.y - 30 }))], b: [{ x: 32, y: 82 }, ...parked('b').slice(1)],
    });
    const play = flick(m, 0, 0, -40);
    expect(play.event).toEqual({ kind: 'foul', side: 'b', penalty: true });
    const n = play.next;
    expect(n.turn).toBe('b');
    expect(n.phase).toBe('placing');
    expect(n.penalty).toBe(true);
    expect(n.ball).toEqual({ x: W / 2, y: L - MARKS.spot });
    const [areaW, areaD] = MARKS.penalty;
    const inArea = (p: Point): boolean => Math.abs(p.x - W / 2) < areaW / 2 && L - p.y < areaD;
    for (const p of [...n.a, ...n.b]) if (p) expect(inArea(p)).toBe(false);
    /* Pronto, and its one flick: then the ball goes over */
    const ready = pronto(n, W / 2);
    expect(ready.phase).toBe('penalty');
    const taker = ready.b.findIndex((p) => p && dist(p, ready.ball) < 10);
    expect(taker).toBeGreaterThanOrEqual(0);
    const missed = flick(ready, taker, 30, 0);
    expect(missed.event).toEqual({ kind: 'turn', side: 'a', why: 'penalty' });
  });
});

describe('a button in a net', () => {
  it('is out of play, sits out a whole turn of its side, and comes back on the goal line on its right', () => {
    /* a's button sent into b's goal, the ball nowhere near */
    /* nothing of b's on a's return spot, at the top on a's right */
    const b = parked('b').map((p) => (p.x === 58 && p.y === 6 ? { x: 44, y: 14 } : p));
    const m = playing({
      turn: 'a', ball: { x: 6, y: 50 },
      a: [{ x: 32, y: 30 }, ...parked('a').slice(1)], b, keepers: { a: 32, b: MOUTH[0] + KEEPER_W / 2 - 1 },
    });
    const sent = flick(m, 0, 0, -120);
    expect(sent.next.a[0]).toBeNull();
    expect(sent.next.out).toEqual([{ side: 'a', index: 0, net: 'top', since: m.turnNo }]);
    /* the flick did not move the ball, so b's turn: b passes back without touching anything */
    expect(sent.next.turn).toBe('b');
    const b1 = flick(sent.next, 4, -10, 0);
    expect(b1.next.turn).toBe('a');
    /* a's next turn, still without it */
    expect(b1.next.a[0]).toBeNull();
    expect(mayFlick(b1.next, 0)).toBe(false);
    const a1 = flick(b1.next, 4, 10, 0);
    /* a whole turn of a's gone by: back on the top goal line, on a's right */
    expect(a1.next.a[0]).toEqual({ x: W / 2 + MARKS.penalty[0] / 2, y: R + 0.5 });
    expect(a1.next.out).toEqual([]);

    /* with one of b's standing on that spot, it waits */
    const blocked = flick({ ...b1.next, b: b1.next.b.map((p, i) => (i === 1 ? { x: W / 2 + MARKS.penalty[0] / 2, y: R + 0.5 } : p)) }, 4, 10, 0);
    expect(blocked.next.a[0]).toBeNull();
    expect(blocked.next.out).toHaveLength(1);
  });
});

describe('1 Toque', () => {
  /* a's button straight behind the ball, everyone else out of the way */
  const lined = (): Match => playing({
    turn: 'a', rule: '1', ball: { x: 32, y: 60 },
    a: [{ x: 32, y: 72 }, ...parked('a').slice(1)], b: parked('b'),
  });
  /* the ball in the gap between two of a's buttons, a third behind it */
  const stuck = (rule: Match['rule']): Match => playing({
    turn: 'a', rule, ball: { x: 33, y: 60 },
    a: [{ x: 26, y: 60 }, { x: 40, y: 60 }, { x: 33, y: 72 }, ...parked('a').slice(3)], b: parked('b'),
  });

  it('is one flick a turn, then the other side plays', () => {
    const one = flick(lined(), 0, 0, -40);
    expect(one.event).toEqual({ kind: 'turn', side: 'b', why: 'touches' });
    expect(one.next.turn).toBe('b');
  });

  it('still kicks off with two flicks', () => {
    const first = flick(newMatch(3, 'a', 5, '1'), 4, 0, -12);
    expect(first.event).toEqual({ kind: 'on', left: 1 });
  });

  it('starts with 3 Toques unless asked', () => {
    expect(newMatch(3, 'a').rule).toBe('3');
    expect(lined().rule).toBe('1');
  });

  it('the ball parked between two of yours: your flick has to free it, or it is a free kick to them from there', () => {
    const m = stuck('1');
    expect(mustFree(m)).toBe(true);
    /* a far button, nudged: the ball stays parked */
    const left = flick(m, 4, -10, 0);
    expect(left.event).toEqual({ kind: 'parked', side: 'b' });
    expect(left.next.turn).toBe('b');
    expect(left.next.ball).toEqual(m.ball);
    /* one of the two moved away frees it, even with the ball left where it is */
    const freed = flick(m, 0, -40, 0);
    expect(freed.event).toEqual({ kind: 'turn', side: 'b', why: 'still' });
    expect(mustFree({ ...freed.next, turn: 'a' })).toBe(false);
  });

  it('three of yours boxing the ball in after your flick: a free kick to them straight away', () => {
    const m = playing({
      turn: 'a', rule: '1', ball: { x: 33, y: 56 },
      a: [{ x: 26, y: 60 }, { x: 40, y: 60 }, { x: 33, y: 48 }, ...parked('a').slice(3)], b: parked('b'),
    });
    expect(mustFree(m)).toBe(false);
    expect(flick(m, 4, -10, 0).event).toEqual({ kind: 'parked', side: 'b' });
  });

  it('is not a rule of 3 Toques', () => {
    const m = stuck('3');
    expect(mustFree(m)).toBe(false);
    expect(flick(m, 4, -10, 0).event).toEqual({ kind: 'turn', side: 'b', why: 'still' });
  });
});

describe('the goleiro at 1 Toque', () => {
  it('stands anywhere in its small area; at 3 Toques only on its line, between the posts', () => {
    expect(placeGoleiro('3', 2, 3)).toEqual({ x: clampKeeper(2), out: 0 });
    expect(placeGoleiro('1', 32, 2)).toEqual({ x: 32, out: 2 });
    expect(placeGoleiro('1', -10, 99)).toEqual({ x: W / 2 - KEEPER_SPAN, out: KEEPER_OUT });
    expect(placeGoleiro('1', 99, -3)).toEqual({ x: W / 2 + KEEPER_SPAN, out: 0 });
  });

  it('placed off its line when a shot is called, and the physics sees it there, either way up', () => {
    for (const side of ['a', 'b'] as const) {
      const m = call(playing({ turn: side, rule: '1', ball: side === 'a' ? { x: 32, y: 30 } : { x: 32, y: L - 30 } }));
      const ready = pronto(m, 30, 2.5);
      expect(ready.keepersOut[other(side)]).toBe(2.5);
      expect(tableFor(ready).table.keeperOut).toBe(2.5);
      expect(tableFor(ready).table.homeOut).toBe(0);
      /* at 3 Toques the same Pronto keeps it on the line */
      expect(pronto({ ...m, rule: '3' }, 30, 2.5).keepersOut[other(side)]).toBe(0);
    }
  });

  it('moved by its own side on its turn, and only at 1 Toque, in play', () => {
    const m = playing({ turn: 'a', rule: '1' });
    expect(mayMoveGoleiro(m)).toBe(true);
    const moved = moveGoleiro(m, 26, 3);
    expect(moved.keepers.a).toBe(26);
    expect(moved.keepersOut.a).toBe(3);
    expect(moved.keepers.b).toBe(m.keepers.b);
    expect(moveGoleiro({ ...m, rule: '3' }, 26, 3)).toEqual({ ...m, rule: '3' });
    expect(moveGoleiro({ ...m, phase: 'shot' }, 26, 3)).toEqual({ ...m, phase: 'shot' });
    /* back on the line at the next kick-off */
    expect(newMatch(3, 'a', 4, '1').keepersOut).toEqual({ a: 0, b: 0 });
  });
});

describe('a penalty shootout', () => {
  const run = (first: Side, kicks: boolean[]): Shootout => kicks.reduce((s, k) => kicked(s, k), newShootout(first));

  it('takes turns, five each, and is decided as soon as one side cannot be caught', () => {
    /* a scores three, b misses three: after b's third, b could only reach two */
    const s = run('a', [true, false, true, false, true, false]);
    expect(s.winner).toBe('a');
    expect(shootoutGoals(s, 'a')).toBe(3);
    expect(shootoutTaken(s, 'b')).toBe(3);
    /* one kick earlier it was still open */
    expect(run('a', [true, false, true, false, true]).winner).toBeNull();
  });

  it('goes to a kick each when level after five, until one scores and the other does not', () => {
    const five = [true, true, false, false, true, true, true, true, false, false];
    expect(run('b', five).winner).toBeNull();
    /* both score their sixth: still on */
    expect(run('b', [...five, true, true]).winner).toBeNull();
    /* the first to kick scores its sixth: the other still has its own */
    expect(run('b', [...five, true]).winner).toBeNull();
    /* b scores, a misses */
    const done = run('b', [...five, true, false]);
    expect(done.winner).toBe('b');
    expect(kicked(done, true)).toBe(done);
  });

  it('a kick: the ball on the spot, the taker behind it, the goleiro to place, one flick', () => {
    for (const taker of ['a', 'b'] as const) {
      const m = penaltyFor(taker);
      expect(m.phase).toBe('placing');
      expect(mayCall(m)).toBe(false);
      const keeperAside = taker === 'a' ? MOUTH[0] + KEEPER_W / 2 : W - MOUTH[0] - KEEPER_W / 2;
      const ready = pronto(m, keeperAside);
      expect(ready.phase).toBe('penalty');
      const { table } = tableFor(ready);
      const plan = oneTouch(table, [0], false)!;
      const f = plan.flicks[0];
      const play = flick(ready, 0, taker === 'a' ? f.vx : -f.vx, taker === 'a' ? f.vy : -f.vy);
      expect(scoredFrom(play, taker)).toBe(true);
      /* straight back at its own end: no goal */
      expect(scoredFrom(flick(ready, 0, 0, taker === 'a' ? 30 : -30), taker)).toBe(false);
    }
  });
});

describe('a shot that missed, for the commentator', () => {
  /** side's shot called from the edge of the area, the ball sent towards x on
      the end line it attacks, the goleiro by the far post */
  function shotAt(side: Side, x: number): ReturnType<typeof flick> {
    const a = side === 'a';
    const put = a ? (p: Point): Point => p : turned;
    const ball = { x: W / 2, y: 26 };
    const d = dist(ball, { x, y: 0 });
    const dir = { x: (x - ball.x) / d, y: -ball.y / d };
    const me = { x: ball.x - dir.x * (R + BALL + 4), y: ball.y - dir.y * (R + BALL + 4) };
    const m = call(playing({
      turn: side, ball: put(ball),
      a: a ? [me, ...parked('a').slice(1)] : parked('a'),
      b: a ? parked('b') : [turned(me), ...parked('b').slice(1)],
    }));
    const keeper = MOUTH[1] - KEEPER_W / 2;
    return flick(pronto(m, a ? keeper : W - keeper), 0, (a ? 1 : -1) * dir.x * 80, (a ? 1 : -1) * dir.y * 80);
  }

  for (const side of ['a', 'b'] as const) {
    it(`side ${side}: off the post and out is the post; in off the post is a goal, no miss at all`, () => {
      const out = shotAt(side, MOUTH[0] - 1);
      expect(out.goal).toBe(false);
      expect(missed(out, side)).toBe('post');
      const inOff = shotAt(side, MOUTH[0] + 2);
      expect(inOff.bumps.map((b) => b.what)).toContain('post');
      expect(inOff.goal).toBe(true);
      expect(missed(inOff, side)).toBeNull();
    });

    it(`side ${side}: just outside a post is close; further out is not, and nor is a ball back from the corner`, () => {
      expect(missed(shotAt(side, MOUTH[0] - 4), side)).toBe('close');
      expect(missed(shotAt(side, MOUTH[0] - 9), side)).toBeNull();
      /* into the corner, back along the end past the post */
      const corner = shotAt(side, MOUTH[0] - 15);
      const seen = corner.frames.map((f) => (side === 'a' ? f.ball : turned(f.ball)));
      expect(seen.some((p) => p.y <= BALL * 2 && p.x > MOUTH[0] - 6 && p.x < MOUTH[0])).toBe(true);
      expect(missed(corner, side)).toBeNull();
    });

    it(`side ${side}: at the goleiro is a save`, () => {
      expect(missed(shotAt(side, MOUTH[1] - 3), side)).toBe('save');
    });
  }
});
