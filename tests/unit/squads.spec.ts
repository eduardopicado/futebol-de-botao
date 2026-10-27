/* The players: every real team's six, numbers and names, the buttons they go
 * on at four and five a side, the shootout's takers, and the names and
 * numbers anyone can change on this device.
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
  return { ...(await import('../../src/game/squads')), ...(await import('../../src/game/teams')) };
}

describe('the squads', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('every real team has six, each a name and a shirt number, no number twice; You and the Rivals have numbers only', async () => {
    const { SQUADS, TEAMS, real, squadOf } = await load();
    for (const t of TEAMS) {
      const six = squadOf(t);
      expect(six, t.id).toHaveLength(6);
      for (const p of six) {
        expect(Number.isInteger(p.n) && p.n >= 1 && p.n <= 99, `${t.id} ${p.n}`).toBe(true);
        expect(real(t) ? p.name.length > 0 : p.name === '', `${t.id} ${p.name}`).toBe(true);
      }
      expect(new Set(six.map((p) => p.n)).size, t.id).toBe(6);
      expect(Boolean(SQUADS[t.id]), t.id).toBe(real(t));
    }
  });

  it('five a side, the five outfield players in line-up order; four a side, the second midfielder sits out', async () => {
    const { buttonsOf, squadOf, teamById, goleiroOf } = await load();
    const brazil = teamById('brazil')!;
    const [gk, d1, d2, m1, m2, f] = squadOf(brazil);
    expect(goleiroOf(brazil)).toEqual(gk);
    expect(buttonsOf(brazil, 5)).toEqual([d1, d2, m1, m2, f]);
    expect(buttonsOf(brazil, 4)).toEqual([d1, d2, m1, f]);
  });

  it('a shootout starts with the forward, then back through the team, and round again', async () => {
    const { takerOf, squadOf, teamById } = await load();
    const spain = teamById('spain')!;
    const [, d1, d2, m1, m2, f] = squadOf(spain);
    expect([0, 1, 2, 3, 4, 5].map((k) => takerOf(spain, k))).toEqual([f, m2, m1, d2, d1, f]);
  });

  it('a name or number changed on this device wins, a bad one is ignored, and the real squad comes back', async () => {
    const { changedSquad, resetSquad, setPlayer, squadOf, teamById, SQUADS } = await load();
    const brazil = teamById('brazil')!;
    expect(changedSquad(brazil)).toBe(false);
    setPlayer(brazil, 5, { name: 'Pelé', n: 10 });
    setPlayer(brazil, 1, { n: 0 });
    expect(squadOf(brazil)[5]).toEqual({ n: 10, name: 'Pelé' });
    expect(squadOf(brazil)[1]).toEqual(SQUADS.brazil[1]);
    expect(changedSquad(brazil)).toBe(true);
    resetSquad(brazil);
    expect(squadOf(brazil)).toEqual(SQUADS.brazil);
    expect(changedSquad(brazil)).toBe(false);
  });

  it('reads whatever was saved without breaking: a wrong kind of value is no change', async () => {
    const { squadOf, teamById, SQUADS } = await load({ players: { brazil: [null, 'x', { n: 'seven', name: 3 }] } });
    expect(squadOf(teamById('brazil')!)).toEqual(SQUADS.brazil);
    const again = await load({ players: [1, 2] });
    expect(again.squadOf(again.teamById('brazil')!)).toEqual(again.SQUADS.brazil);
  });

  it('a player as shown: "10 · Lionel Messi", or "Number 9" with no name', async () => {
    const { playerLabel } = await load();
    expect(playerLabel({ n: 10, name: 'Lionel Messi' })).toBe('10 · Lionel Messi');
    expect(playerLabel({ n: 9, name: '' })).toBe('Number 9');
  });
});
