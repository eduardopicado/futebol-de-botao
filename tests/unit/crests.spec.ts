/* Team crests: the square cut from a picture, and keeping them on this
 * device, only ever as pictures the app made. And the Rivals, the made-up
 * opponent a crest is often for, who play only when picked.
 *
 *   npm run test:unit */

import { afterEach, describe, expect, it, vi } from 'vitest';

/** localStorage, as a plain map; `full` makes every write fail, as a full iPad does */
function fakeStorage(seed: Record<string, unknown> = {}, full = false) {
  const items = new Map(Object.entries(seed).map(([k, v]) => [`fdb:${k}`, JSON.stringify(v)]));
  return {
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => { if (full) throw new Error('QuotaExceededError'); items.set(k, v); },
  };
}

async function load(seed: Record<string, unknown> = {}, full = false) {
  vi.resetModules();
  vi.stubGlobal('window', { localStorage: fakeStorage(seed, full) });
  return import('../../src/lib/crests');
}

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('team crests', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('cut the biggest square from the middle of a picture', async () => {
    const { squareCrop } = await load();
    expect(squareCrop(400, 300)).toEqual({ sx: 50, sy: 0, side: 300 });
    expect(squareCrop(300, 500)).toEqual({ sx: 0, sy: 100, side: 300 });
    expect(squareCrop(256, 256)).toEqual({ sx: 0, sy: 0, side: 256 });
  });

  it('are kept for a team, and removed', async () => {
    const { clearCrest, crestOf, setCrest } = await load();
    expect(crestOf('you')).toBeNull();
    expect(setCrest('you', PNG)).toBe(true);
    expect(setCrest('brazil', PNG)).toBe(true);
    expect(crestOf('you')).toBe(PNG);
    clearCrest('you');
    expect(crestOf('you')).toBeNull();
    expect(crestOf('brazil')).toBe(PNG);
  });

  it('are only ever pictures the app made: nothing else is kept or shown', async () => {
    const { crestOf, setCrest } = await load({ crests: { you: 'https://example.com/crest.png', brazil: 'data:image/svg+xml;base64,PHN2Zz4=', france: 42, spain: PNG } });
    expect(crestOf('you')).toBeNull();
    expect(crestOf('brazil')).toBeNull();
    expect(crestOf('france')).toBeNull();
    expect(crestOf('spain')).toBe(PNG);
    expect(setCrest('you', 'javascript:alert(1)')).toBe(false);
    expect(setCrest('you', 'data:image/png;base64,"><script>')).toBe(false);
    expect(crestOf('you')).toBeNull();
  });

  it('say so when the device will not keep one', async () => {
    const { crestOf, setCrest } = await load({}, true);
    expect(setCrest('you', PNG)).toBe(false);
    expect(crestOf('you')).toBeNull();
  });

  it('survive what is saved being the wrong kind of thing', async () => {
    const { crestOf } = await load({ crests: ['not', 'an', 'object'] });
    expect(crestOf('you')).toBeNull();
  });
});

describe('the opponent', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  async function teams(seed: Record<string, unknown> = {}) {
    await load(seed);
    return import('../../src/game/teams');
  }

  it('is a real team at random: never one of the made-up sides, your team, or the last one', async () => {
    const { RIVALS, YOU, ourTeam, real, rivalFor, teamById } = await teams({ 'team-a': 'brazil' });
    const us = ourTeam();
    expect(us.id).toBe('brazil');
    const last = teamById('flamengo')!;
    for (let i = 0; i < 200; i += 1) {
      const them = rivalFor(us, last);
      expect(real(them)).toBe(true);
      expect([YOU, RIVALS, us, last]).not.toContain(them);
    }
  });

  it('is the one picked, the Rivals included, every time', async () => {
    const { RIVALS, ourTeam, rivalFor } = await teams({ 'team-b': 'rivals' });
    for (let i = 0; i < 20; i += 1) expect(rivalFor(ourTeam())).toBe(RIVALS);
  });

  it('is never your own side, even when picked', async () => {
    const { ourTeam, rivalFor } = await teams({ 'team-a': 'palmeiras', 'team-b': 'palmeiras' });
    for (let i = 0; i < 50; i += 1) expect(rivalFor(ourTeam()).id).not.toBe('palmeiras');
  });
});
