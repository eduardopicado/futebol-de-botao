/* Futebol de Botão: the flick, the bounces, the rules, and the planner. */

import { describe, expect, it } from 'vitest';
import {
  BALL, KEEPER_OUT, KEEPER_W, KEEPER_Y, L, MARKS, MAX_SPEED, MOUTH, NET, POST, PULL, R, W,
  angles, flickFor, keeperFor, oneTouch, passPlan, robust, shownBounce, simulate, slant,
  type Point, type Table,
} from '../../src/content/botao';

const table = (ball: Point, us: Point[], extra: Partial<Table> = {}): Table => ({ ball, us, them: [], keeper: null, ...extra });
const MID = (MOUTH[0] + MOUTH[1]) / 2;
const dist = (a: Point, b: Point): number => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

describe('a flick', () => {
  it('sends the ball straight on through its middle, faster than the button', () => {
    const t = table({ x: MID, y: 40 }, [{ x: MID, y: 52 }]);
    const shot = simulate(t, { button: 0, vx: 0, vy: -70 });
    expect(shot.touched).toBe(true);
    expect(shot.goal).toBe(true);
    expect(shot.bumps[0]).toMatchObject({ what: 'touch', who: 0 });
    /* a frame after the touch, the ball has gone further than the button */
    const f = shot.bumps[0].frame;
    const [before, after] = [shot.frames[f], shot.frames[f + 3]];
    expect(dist(before[0], after[0])).toBeGreaterThan(dist(before[1], after[1]));
    expect(Math.abs(shot.end.ball.x - MID)).toBeLessThan(0.01);
  });

  it('does the same every time, and stops', () => {
    const t = table({ x: 20, y: 50 }, [{ x: 28, y: 60 }, { x: 50, y: 70 }], { them: [{ x: 30, y: 30 }], keeper: 30 });
    const f = { button: 0, vx: -60, vy: -80 };
    expect(simulate(t, f)).toEqual(simulate(t, f));
    const end = simulate(t, f).end;
    const again = simulate(end, { button: 1, vx: 0, vy: 0 });
    expect(again.frames).toHaveLength(2);
  });

  it('goes no faster than the fastest flick', () => {
    const t = table({ x: 10, y: 10 }, [{ x: MID, y: 80 }]);
    expect(simulate(t, { button: 0, vx: 0, vy: -1000 }).end).toEqual(simulate(t, { button: 0, vx: 0, vy: -MAX_SPEED }).end);
  });

  it('comes from pulling back: the other way, harder the further, up to the fastest', () => {
    expect(flickFor(0, 0, 10)).toEqual({ button: 0, vx: -0, vy: -10 * PULL });
    const far = flickFor(1, 300, 400);
    expect(Math.sqrt(far.vx ** 2 + far.vy ** 2)).toBeCloseTo(MAX_SPEED);
    expect(far.vx).toBeLessThan(0);
    expect(far.vy).toBeLessThan(0);
  });
});

describe('the table', () => {
  it('bounces the ball off a wall at exactly the angle it went in', () => {
    /* pushed up and to the left at 45°, into the left wall */
    const ball = { x: 14, y: 70 };
    const t = table(ball, [{ x: ball.x + 7, y: ball.y + 7 }]);
    const shot = simulate(t, { button: 0, vx: -70, vy: -70 });
    expect(shot.bumps.some((b) => b.what === 'wall')).toBe(true);
    const [b] = shot.bounces;
    expect(b.normal).toEqual({ x: 1, y: 0 });
    expect(b.at.x).toBeCloseTo(BALL);
    const [into, out] = angles(b);
    expect(into).toBe(out);
    expect(into).toBeGreaterThan(35);
    expect(into).toBeLessThan(55);
    /* and the frames agree: it really went off that way */
    /* the angle to the wall, which runs up and down the table */
    const way = (a: Point, c: Point): number => Math.atan2(Math.abs(c.x - a.x), Math.abs(c.y - a.y)) * 180 / Math.PI;
    expect(way(shot.frames[b.frame - 3][0], shot.frames[b.frame - 1][0])).toBeCloseTo(into, -0.5);
    expect(way(shot.frames[b.frame + 1][0], shot.frames[b.frame + 3][0])).toBeCloseTo(out, -0.5);
  });

  /* the angles he is shown are for a ball he sent at the wall himself */
  it('shows the angles of a bounce his button sent straight there', () => {
    const ball = { x: 14, y: 70 };
    const shot = simulate(table(ball, [{ x: ball.x + 7, y: ball.y + 7 }]), { button: 0, vx: -70, vy: -70 });
    expect(shot.bounces.length).toBeGreaterThan(0);
    expect(shownBounce(shot, 0)).toEqual(shot.bounces[0]);
  });

  it('shows none for a ball that glanced off something else on its way to the wall', () => {
    /* pushed straight up, it clips his other button and goes off left into the wall */
    const ball = { x: 20, y: 60 };
    const viaMate = simulate(table(ball, [{ x: 20, y: 70 }, { x: 24, y: 45 }]), { button: 0, vx: 0, vy: -90 });
    expect(viaMate.bumps.some((b) => b.what === 'touch' && b.who === 1)).toBe(true);
    expect(viaMate.bounces.length).toBeGreaterThan(0);
    expect(shownBounce(viaMate, 0)).toBeNull();
    /* the same off a defender */
    const viaThem = simulate(table(ball, [{ x: 20, y: 70 }], { them: [{ x: 24, y: 45 }] }), { button: 0, vx: 0, vy: -90 });
    expect(viaThem.bumps.some((b) => b.what === 'block')).toBe(true);
    expect(viaThem.bounces.length).toBeGreaterThan(0);
    expect(shownBounce(viaThem, 0)).toBeNull();
    /* and a ball that never met the wall has nothing to show */
    expect(shownBounce(simulate(table({ x: MID, y: 40 }, [{ x: MID, y: 52 }]), { button: 0, vx: 0, vy: -70 }), 0)).toBeNull();
  });

  it('says how steeply the ball met the wall: 90° straight at it, small when it only grazes it', () => {
    const left = { x: 1, y: 0 };
    expect(slant({ x: -10, y: 0 }, left)).toBe(90);
    expect(slant({ x: -10, y: -10 }, left)).toBe(45);
    expect(slant({ x: -1, y: -10 }, left)).toBe(6);
    /* the same on every wall, whichever way along it the ball goes */
    expect(slant({ x: 3, y: 4 }, { x: 0, y: -1 })).toBe(53);
    expect(slant({ x: -3, y: 4 }, { x: 0, y: -1 })).toBe(53);
    expect(slant({ x: 4, y: -3 }, { x: -1, y: 0 })).toBe(53);
  });

  it('comes straight back from a shot straight at the wall, a right angle', () => {
    const ball = { x: 20, y: 60 };
    const shot = simulate(table(ball, [{ x: ball.x + 10, y: ball.y }]), { button: 0, vx: -80, vy: 0 });
    const [b] = shot.bounces;
    expect(angles(b)).toEqual([90, 90]);
  });

  it('counts no bounce for a goal: the net is not a wall', () => {
    const t = table({ x: MID, y: 40 }, [{ x: MID, y: 52 }]);
    const shot = simulate(t, { button: 0, vx: 0, vy: -100 });
    expect(shot.goal).toBe(true);
    expect(shot.bounces).toEqual([]);
  });

  it('is shaped like a real table: half as long again as it is wide, the goal clearly narrower than the small area', () => {
    expect(L / W).toBeGreaterThan(1.45);
    expect(L / W).toBeLessThan(1.6);
    const [boxW, boxD] = MARKS.box;
    const [penW, penD] = MARKS.penalty;
    expect(MOUTH[1] - MOUTH[0]).toBeLessThanOrEqual(0.75 * boxW);
    expect(boxW).toBeLessThan(penW);
    expect(boxD).toBeLessThan(MARKS.spot);
    expect(MARKS.spot).toBeLessThan(penD);
    /* the arc round the spot reaches past the penalty area's edge */
    expect(MARKS.spot + MARKS.arc).toBeGreaterThan(penD);
    /* and the goleiro leaves a gap each side the ball fits through */
    expect((MOUTH[1] - MOUTH[0] - KEEPER_W) / 2).toBeGreaterThan(2 * BALL + 2 * POST);
  });

  it('lets the goleiro stop a shot hit straight at him', () => {
    const t = table({ x: 30, y: 30 }, [{ x: 30, y: 42 }], { keeper: 30 });
    const shot = simulate(t, { button: 0, vx: 0, vy: -100 });
    expect(shot.goal).toBe(false);
    expect(shot.bumps.map((b) => b.what)).toContain('keeper');
  });

  it('has posts: a shot at one bounces off', () => {
    const t = table({ x: MOUTH[0], y: 30 }, [{ x: MOUTH[0], y: 42 }]);
    const shot = simulate(t, { button: 0, vx: 0, vy: -90 });
    expect(shot.bumps.map((b) => b.what)).toContain('post');
    expect(shot.goal).toBe(false);
  });

  it('has no wall across a goal mouth: a button sent at the goal goes in and stops against the net', () => {
    const t = table({ x: 5, y: 85 }, [{ x: MID, y: 20 }]);
    const shot = simulate(t, { button: 0, vx: 0, vy: -MAX_SPEED });
    const way = shot.frames.map((f) => f[1].y);
    /* in past the line, as far as the back of the net, and no bounce back off the line */
    expect(Math.min(...way)).toBeLessThan(0.5);
    expect(Math.min(...way)).toBeGreaterThanOrEqual(-NET + R - 0.01);
    expect(shot.end.us[0].y).toBeLessThan(R - 2);
    expect(shot.end.us[0].x).toBeCloseTo(MID, 6);
  });

  it('keeps a button on the table beside the goal: the rim is a wall there', () => {
    const t = table({ x: MID, y: 85 }, [{ x: 8, y: 20 }]);
    const end = simulate(t, { button: 0, vx: 0, vy: -MAX_SPEED }).end;
    expect(end.us[0].y).toBeGreaterThanOrEqual(R - 0.01);
    expect(end.us[0].y).toBeGreaterThan(R + 2);
  });

  it('has an open goal at the far end too: the ball in there is an own goal, not a bounce', () => {
    const t = table({ x: MID, y: 80 }, [{ x: MID, y: 68 }]);
    const shot = simulate(t, { button: 0, vx: 0, vy: 100 });
    expect(shot.own).toBe(true);
    expect(shot.goal).toBe(false);
    expect(shot.bounces).toEqual([]);
    expect(shot.end.ball.y).toBeGreaterThan(L);
    expect(shot.end.ball.y).toBeLessThanOrEqual(L + NET - BALL + 0.01);
    /* and a button sent in there on its own stops against that net */
    const alone = simulate(table({ x: 5, y: 10 }, [{ x: MID, y: 75 }]), { button: 0, vx: 0, vy: MAX_SPEED });
    const way = alone.frames.map((f) => f[1].y);
    expect(Math.max(...way)).toBeGreaterThan(L - 0.5);
    expect(Math.max(...way)).toBeLessThanOrEqual(L + NET - R + 0.01);
    expect(alone.own).toBe(false);
  });

  it('scores no own goal from a shot at his own end that misses the mouth', () => {
    const t = table({ x: 10, y: 80 }, [{ x: 10, y: 68 }]);
    const shot = simulate(t, { button: 0, vx: 0, vy: 100 });
    expect(shot.own).toBe(false);
    expect(shot.bounces.length).toBeGreaterThan(0);
    expect(shot.end.ball.y).toBeLessThanOrEqual(L - BALL + 0.01);
  });
});

describe('the goleiro', () => {
  it('puts the goleiro on the near post, or in the middle of the way to goal', () => {
    expect(keeperFor('none', { x: 10, y: 30 })).toBeNull();
    expect(keeperFor('side', { x: 10, y: 30 })!).toBeLessThan(MID);
    expect(keeperFor('side', { x: 54, y: 30 })!).toBeGreaterThan(MID);
    for (const x of [2, 20, 32, 44, 62]) {
      const k = keeperFor('middle', { x, y: 25 })!;
      expect(k - KEEPER_W / 2).toBeGreaterThan(MOUTH[0]);
      expect(k + KEEPER_W / 2).toBeLessThan(MOUTH[1]);
    }
  });

  it('off its line, it stops a shot that would have gone past it on the line', () => {
    /* from the left, across the face of goal into the far side of the net */
    const ball = { x: 20, y: 20 };
    const [ux, uy] = [Math.SQRT1_2, -Math.SQRT1_2];
    const button = { x: ball.x - ux * (R + BALL + 0.5), y: ball.y - uy * (R + BALL + 0.5) };
    const shot = (keeperOut: number) => simulate(table(ball, [button], { keeper: 28, keeperOut }), { button: 0, vx: ux * 100, vy: uy * 100 });
    expect(shot(0).goal).toBe(true);
    const out = shot(KEEPER_OUT);
    expect(out.goal).toBe(false);
    expect(out.bumps.some((b) => b.what === 'keeper')).toBe(true);
    expect(KEEPER_OUT + KEEPER_Y[1]).toBe(MARKS.box[1]);
  });
});

describe('the planner', () => {
  it('finds a straight shot from in front of goal that still scores a little off', () => {
    const t = table({ x: MID, y: 36 }, [{ x: MID, y: 48 }]);
    const plan = oneTouch(t, [0], false)!;
    expect(plan.kind).toBe('straight');
    expect(simulate(t, plan.flicks[0]).goal).toBe(true);
    expect(robust(t, plan.flicks[0])).toBe(true);
  });

  it('beats the goleiro: the shot it finds goes past him', () => {
    const ball = { x: 20, y: 30 };
    const t = table(ball, [{ x: 24, y: 42 }], { keeper: keeperFor('middle', ball) });
    const plan = oneTouch(t, [0], true)!;
    const shot = simulate(t, plan.flicks[0]);
    expect(shot.goal).toBe(true);
    expect(shot.bumps.map((b) => b.what)).not.toContain('keeper');
  });

  it('goes off the wall when a defender is in the way', () => {
    const ball = { x: 18, y: 40 };
    /* right on the ball's way to goal */
    const block = { x: 22, y: 28 };
    const t = table(ball, [{ x: 26, y: 48 }], { them: [block] });
    const plan = oneTouch(t, [0], true);
    if (plan && plan.kind === 'wall') {
      const shot = simulate(t, plan.flicks[0]);
      expect(shot.goal).toBe(true);
      expect(shot.bounces.length).toBeGreaterThan(0);
    } else {
      expect(plan?.kind).not.toBe('straight');
    }
  });

  it('passes to a team-mate, then shoots, when two defenders block the way to goal', () => {
    const ball = { x: 16, y: 62 };
    const t = table(ball, [{ x: 13, y: 75 }, { x: 48, y: 30 }], { them: [{ x: 21, y: 41 }, { x: 25, y: 25 }], keeper: keeperFor('middle', ball) });
    expect(oneTouch(t, [0], true)).toBeNull();
    const plan = passPlan(t, 0, 1, 'middle')!;
    expect(plan.kind).toBe('pass');
    const first = simulate(t, plan.flicks[0]);
    expect(first.touched).toBe(true);
    expect(first.goal).toBe(false);
    const then = simulate({ ...first.end, keeper: keeperFor('middle', first.end.ball) }, plan.flicks[1]);
    expect(then.goal).toBe(true);
  });
});
