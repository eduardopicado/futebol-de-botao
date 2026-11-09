/* The teams: an opponent picked at random never looks like your side on the table. */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { TEAMS, YOU, clash, real, rivalFor, teamById } from '../../src/game/teams';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('the opponent', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('tells apart faces that look alike, and ones that do not', () => {
    expect(clash(teamById('liverpool')!, teamById('man-united')!)).toBe(true);
    expect(clash(YOU, teamById('argentina')!)).toBe(false);
  });

  it('tells apart faces of one colour by the flag on them, or a crest added', async () => {
    /* both yellow, but 🇧🇷 and 🇦🇺 (and YOU's ⭐) are nothing alike */
    expect(clash(teamById('brazil')!, teamById('australia')!)).toBe(false);
    expect(clash(YOU, teamById('brazil')!)).toBe(false);
    /* two red clubs, until one has a crest */
    vi.resetModules();
    const items = new Map([['fdb:crests', JSON.stringify({ liverpool: PNG })]]);
    vi.stubGlobal('window', { localStorage: { getItem: (k: string) => items.get(k) ?? null, setItem: () => undefined } });
    const fresh = await import('../../src/game/teams');
    expect(fresh.clash(fresh.teamById('liverpool')!, fresh.teamById('man-united')!)).toBe(false);
  });

  it('picked at random, never clashes with your side when there is another to pick', () => {
    for (const us of TEAMS) {
      const choices = TEAMS.filter((t) => real(t) && t !== us && !clash(t, us));
      if (!choices.length) continue;
      for (let i = 0; i < 30; i += 1) expect(clash(rivalFor(us), us)).toBe(false);
    }
  });
});
