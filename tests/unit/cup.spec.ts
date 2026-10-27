/* The Copa: the draw, the rounds, going through and going out, the cups won,
 * and whatever was saved read without breaking.
 *
 *   npm run test:unit */

import { afterEach, describe, expect, it, vi } from 'vitest';

function fakeStorage(seed: Record<string, unknown> = {}) {
  const items = new Map(Object.entries(seed).map(([k, v]) => [`fdb:${k}`, JSON.stringify(v)]));
  return {
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => { items.set(k, v); },
  };
}

async function load(seed: Record<string, unknown> = {}) {
  vi.resetModules();
  vi.stubGlobal('window', { localStorage: fakeStorage(seed) });
  return { ...(await import('../../src/game/cup')), ...(await import('../../src/game/teams')) };
}

/** a steady run of numbers in [0, 1) */
const seeded = (seed: number) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; };

describe('the Copa', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('draws three different real teams, never your own nor one whose buttons look like yours, and keeps the cup', async () => {
    const { newCup, cupNow, teamById, real, clash, TEAMS, ROUNDS } = await load();
    expect(ROUNDS.map((r) => r.level)).toEqual(['easy', 'medium', 'hard']);
    for (const team of TEAMS) {
      for (let n = 1; n <= 5; n += 1) {
        const c = newCup(team, seeded(n * 31 + team.id.length));
        expect(c.opponents, team.id).toHaveLength(3);
        expect(new Set(c.opponents).size).toBe(3);
        for (const id of c.opponents) {
          const t = teamById(id)!;
          expect(real(t)).toBe(true);
          expect(id).not.toBe(team.id);
          expect(clash(t, team), `${team.id} v ${id}`).toBe(false);
        }
        expect(cupNow()).toEqual(c);
      }
    }
  });

  it('a win takes you to the next round; three wins win the cup, and the cups won go up by one', async () => {
    const { newCup, recordResult, stageOf, roundOf, cupsWon, teamById } = await load();
    let c = newCup(teamById('brazil')!, seeded(7));
    expect(stageOf(c)).toBe('playing');
    expect(roundOf(c)).toBe(0);
    c = recordResult({ us: 3, them: 1 })!;
    expect([stageOf(c), roundOf(c)]).toEqual(['playing', 1]);
    c = recordResult({ us: 3, them: 2 })!;
    expect([stageOf(c), roundOf(c)]).toEqual(['playing', 2]);
    expect(cupsWon()).toBe(0);
    c = recordResult({ us: 3, them: 0 })!;
    expect(stageOf(c)).toBe('won');
    expect(cupsWon()).toBe(1);
    /* nothing more counts once it is over */
    expect(recordResult({ us: 0, them: 3 })!.results).toHaveLength(3);
    expect(cupsWon()).toBe(1);
  });

  it('a defeat puts you out, and nothing after it counts', async () => {
    const { newCup, recordResult, stageOf, teamById, cupsWon } = await load();
    newCup(teamById('flamengo')!, seeded(3));
    recordResult({ us: 3, them: 2 });
    const c = recordResult({ us: 1, them: 3 })!;
    expect(stageOf(c)).toBe('out');
    expect(recordResult({ us: 3, them: 0 })!.results).toHaveLength(2);
    expect(cupsWon()).toBe(0);
  });

  it('reads whatever was saved without breaking: anything that is not a cup is no cup', async () => {
    for (const saved of [null, 'cup', [1], { team: 'nowhere', opponents: [], results: [] },
      { team: 'brazil', opponents: ['spain', 'italy'], results: [] },
      { team: 'brazil', opponents: ['spain', 'italy', 'mars'], results: [] },
      { team: 'brazil', opponents: ['spain', 'italy', 'france'], results: [{ us: 'three', them: 0 }] }]) {
      const { cupNow } = await load({ cup: saved });
      expect(cupNow(), JSON.stringify(saved)).toBeNull();
    }
    const { cupsWon } = await load({ 'cups-won': 'lots' });
    expect(cupsWon()).toBe(0);
  });

  it('a new cup starts again from the quarter-final, and clearing it leaves none', async () => {
    const { newCup, recordResult, clearCup, cupNow, teamById, roundOf } = await load();
    newCup(teamById('spain')!, seeded(1));
    recordResult({ us: 3, them: 0 });
    const again = newCup(teamById('spain')!, seeded(2));
    expect(roundOf(again)).toBe(0);
    expect(again.results).toEqual([]);
    clearCup();
    expect(cupNow()).toBeNull();
  });
});
