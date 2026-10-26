/* The grown-ups' settings: his team, the opponent, the commentator, the
 * sounds, and the crests.
 *
 * Behind a button held for three seconds on the start screen. Everything is
 * kept on this device (src/lib/storage.ts). A crest is a picture a grown-up
 * chooses from the iPad's own photos, cut to a square and kept small
 * (src/lib/crests.ts); the app never ships a club's crest, which is the
 * club's trademark. */

import { clearCrest, crestFromFile, crestOf, setCrest } from '../lib/crests';
import { el } from '../lib/dom';
import { go } from '../lib/router';
import { setSfxEnabled } from '../lib/sfx';
import { read, write } from '../lib/storage';
import { narrationSelect } from './narration';
import { TEAMS, label, ourTeam, rivalChoice, setOurTeam, setRival, teamById } from './teams';

export function mount(root: HTMLElement): void {
  const back = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Back to the start', text: '←' });
  back.addEventListener('click', () => go('home'));

  const options = (withAny: boolean): HTMLOptionElement[] => [
    ...(withAny ? [el('option', { value: 'any', text: 'Anyone (a different team each time)' })] : []),
    ...TEAMS.map((t) => el('option', { value: t.id, text: label(t) })),
  ];
  const team = el('select', {}, ...options(false));
  team.value = ourTeam().id;
  const rival = el('select', {}, ...options(true));
  rival.value = teamById(rivalChoice()) ? rivalChoice() : 'any';

  const sounds = el('input', { type: 'checkbox' });
  /* read as the app starts, in src/main.ts */
  sounds.checked = read<boolean>('sounds', true);
  sounds.addEventListener('change', () => { write('sounds', sounds.checked); setSfxEnabled(sounds.checked); });

  /** a crest, and the buttons to choose or remove it, for the team chosen in `pick` */
  function crestSlot(pick: HTMLSelectElement, who: string): { node: HTMLElement; draw: (said?: string) => void } {
    const shown = el('span', { class: 'shown' });
    const name = el('strong');
    const file = el('input', { type: 'file', accept: 'image/*' });
    const choose = el('label', { class: 'btn ghost small' }, '🖼️ Choose a picture', file);
    const remove = el('button', { class: 'btn ghost small', type: 'button', text: 'Remove' });
    const said = el('p', { class: 'said', 'aria-live': 'polite' });
    const node = el('div', { class: 'panel' }, el('p', { class: 'lbl', text: `Crest: ${who}` }),
      el('div', { class: 'crest' }, shown, name, choose, remove), said);
    const draw = (words = ''): void => {
      const t = teamById(pick.value);
      node.hidden = !t;
      if (!t) return;
      const crest = crestOf(t.id);
      name.textContent = t.name;
      shown.replaceChildren(crest ? el('img', { src: crest, alt: `The crest for ${t.name}` }) : el('span', { class: 'none', text: 'No crest' }));
      remove.hidden = !crest;
      said.textContent = words;
    };
    file.addEventListener('change', () => {
      const chosen = file.files?.[0];
      const t = teamById(pick.value);
      file.value = '';
      if (!chosen || !t) return;
      crestFromFile(chosen).then(
        (crest) => draw(setCrest(t.id, crest) ? `Saved for ${t.name}, on this device.` : 'This device would not keep the picture. Try removing another crest first.'),
        () => draw('That picture could not be read. Try another one.'),
      );
    });
    remove.addEventListener('click', () => { const t = teamById(pick.value); if (t) clearCrest(t.id); draw('Removed.'); });
    return { node, draw };
  }
  const ours = crestSlot(team, 'his team');
  const theirs = crestSlot(rival, 'the opponent');
  team.addEventListener('change', () => { setOurTeam(team.value); ours.draw(); });
  rival.addEventListener('change', () => { setRival(rival.value); theirs.draw(); });
  ours.draw();
  theirs.draw();

  root.append(el('div', { class: 'wrap gu' },
    el('header', { class: 'topbar' }, back, el('div', { class: 'titles' }, el('h1', {}, 'Grown-ups'))),
    el('div', { class: 'panel' },
      el('label', { class: 'field' }, 'His team', team),
      el('div', { class: 'row' }),
      el('label', { class: 'field' }, 'Playing against', rival),
      el('div', { class: 'row' }),
      el('label', { class: 'field' }, 'Commentator', narrationSelect()),
      el('label', { class: 'check' }, sounds, 'Sound effects')),
    ours.node,
    theirs.node,
    el('p', { class: 'tag', text: 'Everything here stays on this device. Nothing is sent anywhere.' })));
}
