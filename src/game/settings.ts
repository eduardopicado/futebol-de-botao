/* The settings: how a match is played, how well the computer plays, what is
 * heard, and the crests.
 *
 * A plain ⚙ on the start screen opens them. Everything is kept on this device
 * (src/lib/storage.ts) and read where a game needs it (choices.ts). A crest
 * is a picture from the device's own photos, cut to a square and kept small
 * (src/lib/crests.ts); the app never ships a club's crest, which is the
 * club's trademark. Teams are not here: each match starts by picking them
 * (pick.ts). */

import { clearCrest, crestOf } from '../lib/crests';
import { el } from '../lib/dom';
import { go } from '../lib/router';
import { setSfxEnabled } from '../lib/sfx';
import { write } from '../lib/storage';
import { LEVELS, type Level } from '../content/computer';
import { GOALS, RULES, SIZES } from '../content/match';
import { RULE_NAMES, buttonsPerSide, computerLevel, goalsToWin, matchRule, readAloud, soundsOn } from './choices';
import { narrationSelect } from './narration';
import { crestButton, redrawShirts, shirtTile } from './shirts';
import { TEAMS, type Team } from './teams';

/** one choice of a few, as a row of chips; the one chosen is pressed */
function chips<T extends string | number>(name: string, options: readonly { value: T; text: string }[], now: T, set: (v: T) => void): HTMLElement {
  const buttons = options.map((o) => {
    const b = el('button', { class: 'chip', type: 'button', text: o.text, 'aria-pressed': String(o.value === now) });
    b.addEventListener('click', () => {
      set(o.value);
      for (const other of buttons) other.setAttribute('aria-pressed', String(other === b));
    });
    return b;
  });
  return el('div', { class: 'row', role: 'group', 'aria-label': name }, ...buttons);
}

/** a switch, on or off */
function toggle(text: string, now: boolean, set: (on: boolean) => void): HTMLElement {
  const box = el('input', { type: 'checkbox' });
  box.checked = now;
  box.addEventListener('change', () => set(box.checked));
  return el('label', { class: 'check' }, box, text);
}

const LEVEL_NAMES: Record<Level, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

export function mount(root: HTMLElement): void {
  const back = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Back to the start', text: '←' });
  back.addEventListener('click', () => go('home'));

  /* a crest for any team: tap its shirt, then add the picture */
  let picked: Team = TEAMS[0];
  const tiles = TEAMS.map((t) => {
    const tile = shirtTile(t);
    tile.addEventListener('click', () => { picked = t; drawCrest(); });
    return tile;
  });
  const grid = el('div', { class: 'teams', role: 'group', 'aria-label': 'Team for a crest' }, ...tiles);
  const shown = el('span', { class: 'shown' });
  const remove = el('button', { class: 'btn ghost small', type: 'button', text: 'Remove' });
  const said = el('p', { class: 'said', 'aria-live': 'polite' });
  const add = crestButton(() => picked, (t, words) => { redrawShirts(grid, t); drawCrest(words); });
  function drawCrest(words = ''): void {
    const crest = crestOf(picked.id);
    for (const tile of tiles) tile.setAttribute('aria-pressed', String(tile.dataset.team === picked.id));
    shown.replaceChildren(crest ? el('img', { src: crest, alt: `The crest for ${picked.name}` }) : el('span', { class: 'none', text: 'No crest' }));
    remove.hidden = !crest;
    add.update();
    said.textContent = words;
  }
  remove.addEventListener('click', () => { clearCrest(picked.id); redrawShirts(grid, picked); drawCrest('Removed.'); });
  drawCrest();

  root.append(el('div', { class: 'wrap settings' },
    el('header', { class: 'topbar' }, back, el('div', { class: 'titles' }, el('h1', {}, 'Settings'))),
    el('section', { class: 'panel' },
      el('h2', { class: 'lbl', text: 'A match is won by' }),
      chips('Goals to win', GOALS.map((g) => ({ value: g, text: `${g} goals` })), goalsToWin(), (g) => write('goals', g))),
    el('section', { class: 'panel' },
      el('h2', { class: 'lbl', text: 'The rule' }),
      chips('Rule', RULES.map((r) => ({ value: r, text: RULE_NAMES[r] })), matchRule(), (r) => write('rule', r)),
      el('p', { class: 'tag', text: '3 toques: up to three flicks a turn. 1 toque: one flick a turn, and no parking the ball between your own buttons.' })),
    el('section', { class: 'panel' },
      el('h2', { class: 'lbl', text: 'Buttons a side' }),
      chips('Buttons a side', SIZES.map((n) => ({ value: n, text: `${n} and a goleiro` })), buttonsPerSide(), (n) => write('buttons', n))),
    el('section', { class: 'panel' },
      el('h2', { class: 'lbl', text: 'The computer plays' }),
      chips('Computer level', LEVELS.map((l) => ({ value: l, text: LEVEL_NAMES[l] })), computerLevel(), (l) => write('level', l))),
    el('section', { class: 'panel' },
      el('h2', { class: 'lbl', text: 'Sound' }),
      el('label', { class: 'field' }, 'Commentator', narrationSelect()),
      toggle('Sound effects', soundsOn(), (on) => { write('sounds', on); setSfxEnabled(on); }),
      toggle('Read the words aloud', readAloud(), (on) => write('read-aloud', on))),
    el('section', { class: 'panel' },
      el('h2', { class: 'lbl', text: 'Crests' }),
      el('p', { class: 'tag', text: "Put a team's crest on its shirt and its buttons, from your own photos. Tap the team:" }),
      grid,
      el('div', { class: 'crest' }, shown, add.node, remove), said),
    el('p', { class: 'tag', text: 'Everything here stays on this device. Nothing is sent anywhere.' })));
}
