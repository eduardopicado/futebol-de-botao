/* How to play: every demo in the guide, played through the rules, does what
 * its words say, at both rules; and the words follow the rule and the goals.
 *
 *   npm run test:unit */

import { describe, expect, it } from 'vitest';
import { guideSteps, played, told } from '../../src/content/guide';
import { CIRCLE, GOALS, RULES, type Event, type Match } from '../../src/content/match';
import { L, W, type Bump } from '../../src/content/botao';

const ids = (rule: '3' | '1') => guideSteps(rule, 3).map((s) => s.id);
const step = (rule: '3' | '1', id: string) => guideSteps(rule, 3).find((s) => s.id === id)!;
const same = (p: Match['a'], q: Match['a']): boolean => JSON.stringify(p) === JSON.stringify(q);

describe('How to play', () => {
  it('has the steps for each rule: no parking only at 1 Toque, the kick-off last', () => {
    expect(ids('3')).toEqual(['flick', 'touches', 'call', 'goleiro', 'foul', 'kickoff']);
    expect(ids('1')).toEqual(['flick', 'touches', 'call', 'goleiro', 'foul', 'parked', 'kickoff']);
  });

  for (const rule of RULES) {
    describe(`at ${rule} Toque${rule === '1' ? '' : 's'}`, () => {
      for (const s of guideSteps(rule, 3)) {
        it(`${s.id}: each flick leads to what the demo says`, () => {
          const plays = played(s.demo);
          expect(plays.map((p) => p.play.event.kind)).toEqual(s.demo.expect);
          /* everything starts on the table, and nothing overlaps */
          const m = s.demo.start;
          const discs = [m.ball, ...m.a, ...m.b].filter((p) => p !== null);
          for (const p of discs) expect(p.x > 0 && p.x < W && p.y > 0 && p.y < L, JSON.stringify(p)).toBe(true);
          for (const [i, p] of discs.entries()) for (const q of discs.slice(i + 1)) expect(Math.hypot(p.x - q.x, p.y - q.y), `${s.id} overlaps`).toBeGreaterThan(6.6);
        });
      }

      it('a flick moves the ball, and touches nobody else', () => {
        const [{ before, play }] = played(step(rule, 'flick').demo);
        expect(play.next.ball.y).toBeLessThan(before.ball.y - 10);
        expect(same(play.next.b, before.b)).toBe(true);
      });

      it('the touches: the turn passes after the last one, and their buttons are never touched', () => {
        const plays = played(step(rule, 'touches').demo);
        expect(plays).toHaveLength(rule === '1' ? 1 : 3);
        const last = plays[plays.length - 1].play.event;
        expect(last).toMatchObject({ kind: 'turn', side: 'b', why: 'touches' });
        for (const { before, play } of plays) {
          expect(same(play.next.b, before.b)).toBe(true);
          expect(Math.hypot(play.next.ball.x - before.ball.x, play.next.ball.y - before.ball.y)).toBeGreaterThan(6);
        }
        /* the same button twice: any button, the same one too */
        if (rule === '3') expect(step(rule, 'touches').demo.flicks.map((f) => f.button)).toEqual([3, 3, 2]);
      });

      it('A gol!: called, the goleiro placed, and the shot goes past it', () => {
        const d = step(rule, 'call').demo;
        const [{ before, play }] = played(d);
        expect(before.phase).toBe('shot');
        expect(before.keepers.b).toBe(d.pronto);
        expect(play.event).toEqual({ kind: 'goal', side: 'a', own: false });
      });

      it('your goleiro: slid across to where the shot comes, and it saves it', () => {
        const d = step(rule, 'goleiro').demo;
        expect(d.start.turn).toBe('b');
        expect(d.start.keepers.a).not.toBe(d.pronto);
        const [{ play }] = played(d);
        expect(play.bumps.map((b) => b.what)).toContain('keeper');
        expect(play.event).toEqual({ kind: 'turn', side: 'a', why: 'theirs' });
        expect(told(play, rule)).toBe('Saved! Your turn now.');
      });

      it('a foul: a free kick to them, not a penalty', () => {
        const [{ play }] = played(step(rule, 'foul').demo);
        expect(play.event).toEqual({ kind: 'foul', side: 'b', penalty: false });
        expect(play.bumps.some((b) => b.what === 'touch')).toBe(false);
      });

      it('the kick-off: two different buttons, and the ball leaves the circle', () => {
        const d = step(rule, 'kickoff').demo;
        expect(d.start.phase).toBe('kickoff');
        expect(new Set(d.flicks.map((f) => f.button)).size).toBe(2);
        const plays = played(d);
        expect(plays[1].play.event).toEqual({ kind: 'turn', side: 'b', why: 'kickoff' });
        const ball = plays[1].play.next.ball;
        expect(Math.hypot(ball.x - W / 2, ball.y - L / 2)).toBeGreaterThan(CIRCLE);
      });
    });
  }

  it('no parking at 1 Toque: the ball left between two of yours is a free kick to them', () => {
    const d = step('1', 'parked').demo;
    const [{ play }] = played(d);
    expect(play.event).toEqual({ kind: 'parked', side: 'b' });
    expect(told(play, '1')).toBe('Parked! A free kick to them.');
  });

  it('says what any flick led to, for whichever side, a save only when the goleiro touched it last', () => {
    const t = (event: Event, rule: '3' | '1' = '3', bumps: Bump[] = []) => told({ event, bumps: bumps.map((what, frame) => ({ what, frame })) }, rule);
    expect(t({ kind: 'goal', side: 'a', own: false })).toBe('GOL!');
    expect(t({ kind: 'champion', side: 'b', own: true })).toBe('Own goal!');
    expect(t({ kind: 'foul', side: 'b', penalty: false })).toBe('Foul! A free kick to them.');
    expect(t({ kind: 'foul', side: 'a', penalty: true })).toBe('Foul! A penalty to you.');
    expect(t({ kind: 'parked', side: 'a' }, '1')).toBe('Parked! A free kick to you.');
    expect(t({ kind: 'uncalled', side: 'a', couldCall: true })).toBe('Not called: no goal.');
    expect(t({ kind: 'retake', side: 'a' })).toBe('Still in the circle: again.');
    expect(t({ kind: 'on', left: 1 })).toBe('1 touch left.');
    expect(t({ kind: 'on', left: 2 })).toBe('2 touches left.');
    expect(t({ kind: 'turn', side: 'a', why: 'theirs' }, '3', ['touch', 'block', 'keeper'])).toBe('Saved! Your turn now.');
    expect(t({ kind: 'turn', side: 'b', why: 'theirs' }, '3', ['touch', 'keeper', 'block', 'wall'])).toBe('Blocked! Their turn now.');
    expect(t({ kind: 'turn', side: 'b', why: 'still' })).toBe('Missed the ball: their turn now.');
    expect(t({ kind: 'turn', side: 'a', why: 'kickoff' })).toBe('Out of the circle. Your turn now.');
    expect(t({ kind: 'turn', side: 'b', why: 'penalty' })).toBe('Penalty taken. Their turn now.');
    expect(t({ kind: 'turn', side: 'b', why: 'touches' })).toBe('No touches left: their turn now.');
    expect(t({ kind: 'turn', side: 'b', why: 'touches' }, '1')).toBe('One flick: their turn now.');
  });

  it('the words follow the rule and the goals, and are fit to be read aloud: no pictures in them', () => {
    expect(step('3', 'touches').title).toBe('Three touches');
    expect(step('1', 'touches').title).toBe('One touch');
    expect(step('1', 'goleiro').words).toContain('small area');
    expect(step('3', 'goleiro').words).not.toContain('small area');
    for (const goals of GOALS) expect(guideSteps('3', goals).at(-1)!.words).toContain(`First to ${goals} goals wins!`);
    for (const rule of RULES) for (const s of guideSteps(rule, 3)) expect(/\p{Extended_Pictographic}/u.test(s.title + s.words), s.id).toBe(false);
  });
});
