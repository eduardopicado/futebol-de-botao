/* A team as a shirt to tap, and a button to give a team its crest: the
 * same on the team picker before a match (pick.ts) and in the settings.
 *
 * A crest is a picture from the device's own photos (src/lib/crests.ts);
 * once added, every shirt and button of that team wears it. */

import { crestFromFile, crestOf, setCrest } from '../lib/crests';
import { el } from '../lib/dom';
import { kit, type Team } from './teams';

/** a team's shirt with its name under it, or Anyone's die; data-team is its id */
export function shirtTile(t: Team | null): HTMLButtonElement {
  /* the name as shown first, then in full where it is shortened: PSG, Paris Saint-Germain */
  const named = !t ? 'Anyone, a different team each time' : t.short === t.name ? t.name : `${t.short}, ${t.name}`;
  return el('button', { class: 'team', type: 'button', 'data-team': t ? t.id : 'any', 'aria-label': named },
    t ? kit(t, 44) : el('span', { class: 'any', 'aria-hidden': 'true', text: '🎲' }),
    el('span', { class: 'team-name', 'aria-hidden': 'true', text: t ? `${t.flag ? `${t.flag} ` : ''}${t.short}` : 'Anyone' })) as HTMLButtonElement;
}

/** the shirts of this team on the screen, drawn again (with its crest, or without) */
export function redrawShirts(within: ParentNode, t: Team): void {
  for (const tile of within.querySelectorAll<HTMLElement>(`.team[data-team="${t.id}"]`)) {
    tile.querySelector('.pk-kit')?.replaceWith(kit(t, 44));
  }
}

/**
 * "📷 Add a crest" for whichever team `team` gives, or "Change crest" when it
 * has one, with the team's name: a picture from the device, cut square and kept. `done` hears what
 * happened, in words, once it is kept or could not be.
 */
export function crestButton(team: () => Team | null, done: (t: Team, words: string) => void): { node: HTMLLabelElement; update: () => void } {
  const file = el('input', { type: 'file', accept: 'image/*' });
  const words = el('span', {});
  const node = el('label', { class: 'btn ghost small crest-btn' }, words, file) as HTMLLabelElement;
  const update = (): void => {
    const t = team();
    node.hidden = !t;
    if (t) words.textContent = `📷 ${crestOf(t.id) ? 'Change crest' : 'Add a crest'}: ${t.short}`;
  };
  file.addEventListener('change', () => {
    const chosen = file.files?.[0];
    const t = team();
    file.value = '';
    if (!chosen || !t) return;
    crestFromFile(chosen).then(
      (crest) => { const kept = setCrest(t.id, crest); update(); done(t, kept ? `Crest saved for ${t.name}, on this device.` : 'This device would not keep the picture. Try removing another crest first.'); },
      () => done(t, 'That picture could not be read. Try another one.'),
    );
  });
  update();
  return { node, update };
}
