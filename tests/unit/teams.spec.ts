/* The teams: an opponent picked at random never looks like your side on the table. */

import { describe, expect, it } from 'vitest';
import { TEAMS, YOU, clash, real, rivalFor, teamById } from '../../src/game/teams';

describe('the opponent', () => {
  it('tells apart faces that look alike, and ones that do not', () => {
    expect(clash(YOU, teamById('brazil')!)).toBe(true);
    expect(clash(YOU, teamById('argentina')!)).toBe(false);
    expect(clash(teamById('liverpool')!, teamById('man-united')!)).toBe(true);
  });

  it('picked at random, never clashes with your side when there is another to pick', () => {
    for (const us of TEAMS) {
      const choices = TEAMS.filter((t) => real(t) && t !== us && !clash(t, us));
      if (!choices.length) continue;
      for (let i = 0; i < 30; i += 1) expect(clash(rivalFor(us), us)).toBe(false);
    }
  });
});
