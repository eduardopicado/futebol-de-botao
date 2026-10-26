/* Treino: every set-up fits on the table, and the way it comes with scores. */

import { describe, expect, it } from 'vitest';
import { BALL, L, R, W, keeperFor, robust, simulate } from '../../src/content/botao';
import { drill, fits } from '../../src/content/treino';

/* the same set-ups on every run */
function seeded(seed: number): () => number {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

describe('Treino', () => {
  it('sets up three of his, three of theirs and a goleiro, with room for all of them, and a way to score', () => {
    const rand = seeded(7);
    for (let n = 0; n < 16; n += 1) {
      const { table: t, plan } = drill(rand);
      expect(t.us).toHaveLength(3);
      expect(t.keeper).toBe(keeperFor('middle', t.ball));
      expect(fits(t)).toBe(true);
      for (const p of [t.ball, ...t.us, ...t.them]) {
        const r = p === t.ball ? BALL : R;
        expect(p.x - r).toBeGreaterThan(0);
        expect(p.x + r).toBeLessThan(W);
        expect(p.y + r).toBeLessThan(L);
      }
      /* played as given, only the last flick scores, and it still does a little off */
      let now = t;
      for (const [k, f] of plan.flicks.entries()) {
        const shot = simulate(now, f);
        expect(shot.touched).toBe(true);
        expect(shot.goal).toBe(k === plan.flicks.length - 1);
        if (shot.goal) expect(robust(now, f)).toBe(true);
        now = { ...shot.end, keeper: keeperFor('middle', shot.end.ball) };
      }
    }
  }, 60_000);
});
