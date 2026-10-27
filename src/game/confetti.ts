/* Confetti in the winners' colours, falling once over a win: a match's full
 * time, a shootout's, and the Copa won. The fall is .confetti in app.css; the
 * router clears it on the way out. */

import { el } from '../lib/dom';
import type { Team } from './teams';

export function confetti(team: Team): HTMLElement {
  const colours = [team.colours[0], team.colours[1], '#F3B229', '#FFF6E7'];
  return el('div', { class: 'confetti', 'aria-hidden': 'true' },
    ...Array.from({ length: 48 }, (_, i) => el('i', { vars: { '--x': `${(i * 37) % 100}%`, '--d': `${(i % 7) * 0.18}s`, '--c': colours[i % colours.length], '--r': `${(i * 53) % 360}deg` } })));
}
