/* The teams, and the shirts they play in.
 *
 * The real thing: World Cup winners and the big clubs. Countries
 * come with their flag. Clubs come as their kit colours and nothing more — a
 * club crest is someone's trademark and the app never comes with one, but a
 * green shirt is Palmeiras to anyone who follows them, and that is all a
 * player needs to know who they are playing. You can add a crest
 * from their own iPad's pictures, kept on that iPad (src/lib/crests.ts), and
 * every shirt and button of that team wears it.
 *
 * Two sides are made up rather than real: You, and the Rivals, for a
 * favourite opponent you give a crest to — a friend's team, or the club
 * across town. The Rivals only play when picked.
 *
 * The shirt is a small inline SVG so it needs no image files, stays sharp at
 * any size and works offline. */

import { crestOf } from '../lib/crests';
import { pick } from '../lib/random';
import { read, write } from '../lib/storage';

export type Pattern =
  | 'plain'    // one colour, collar and cuffs in the second
  | 'stripes'  // vertical stripes: Barcelona, Juventus, Argentina
  | 'hoops'    // horizontal bands: Flamengo
  | 'sleeves'  // body one colour, sleeves the other: Arsenal
  | 'band';    // one broad stripe down the middle: PSG

export interface Team {
  id: string;
  /** in full, for the kick-off */
  name: string;
  /** on the scoreboard, where a phone has room for about ten letters */
  short: string;
  kind: 'you' | 'rivals' | 'country' | 'club';
  /** countries only */
  flag?: string;
  colours: [string, string];
  pattern: Pattern;
  /** not always either shirt colour: Brazil play in royal blue shorts, Palmeiras in white */
  shorts: string;
  /** the team as a Brazilian commentator says it, with its article: "do
      Brasil", "da Argentina" — for "Goooool do Brasil!" */
  pt?: string;
}

/** the side you play for until you pick one */
export const YOU: Team = { id: 'you', name: 'You', short: 'You', kind: 'you', flag: '⭐', colours: ['#F3B229', '#10403E'], pattern: 'plain', shorts: '#10403E' };

/** a favourite opponent, made up: in purple, which no real team here wears */
export const RIVALS: Team = { id: 'rivals', name: 'The Rivals', short: 'Rivals', kind: 'rivals', flag: '🛡️', colours: ['#6B3FA0', '#FFFFFF'], pattern: 'plain', shorts: '#2E1A47' };

export const TEAMS: Team[] = [
  YOU,
  RIVALS,
  /* every World Cup winner, and Portugal and Australia */
  { id: 'brazil', name: 'Brazil', short: 'Brazil', kind: 'country', flag: '🇧🇷', colours: ['#FFD500', '#009B3A'], pattern: 'plain', shorts: '#1F3FA8', pt: 'do Brasil' },
  { id: 'argentina', name: 'Argentina', short: 'Argentina', kind: 'country', flag: '🇦🇷', colours: ['#75AADB', '#FFFFFF'], pattern: 'stripes', shorts: '#1B1B3A', pt: 'da Argentina' },
  { id: 'france', name: 'France', short: 'France', kind: 'country', flag: '🇫🇷', colours: ['#1F3A93', '#FFFFFF'], pattern: 'plain', shorts: '#FFFFFF', pt: 'da França' },
  { id: 'germany', name: 'Germany', short: 'Germany', kind: 'country', flag: '🇩🇪', colours: ['#FFFFFF', '#111111'], pattern: 'plain', shorts: '#111111', pt: 'da Alemanha' },
  { id: 'spain', name: 'Spain', short: 'Spain', kind: 'country', flag: '🇪🇸', colours: ['#C8102E', '#FFC400'], pattern: 'plain', shorts: '#1B2A5C', pt: 'da Espanha' },
  { id: 'italy', name: 'Italy', short: 'Italy', kind: 'country', flag: '🇮🇹', colours: ['#1F5FBF', '#FFFFFF'], pattern: 'plain', shorts: '#FFFFFF', pt: 'da Itália' },
  { id: 'england', name: 'England', short: 'England', kind: 'country', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', colours: ['#FFFFFF', '#1D2D5C'], pattern: 'plain', shorts: '#1D2D5C', pt: 'da Inglaterra' },
  { id: 'uruguay', name: 'Uruguay', short: 'Uruguay', kind: 'country', flag: '🇺🇾', colours: ['#6CACE4', '#FFFFFF'], pattern: 'plain', shorts: '#111111', pt: 'do Uruguai' },
  { id: 'portugal', name: 'Portugal', short: 'Portugal', kind: 'country', flag: '🇵🇹', colours: ['#C8102E', '#006600'], pattern: 'plain', shorts: '#006600', pt: 'de Portugal' },
  { id: 'australia', name: 'Australia', short: 'Australia', kind: 'country', flag: '🇦🇺', colours: ['#FFCD00', '#00843D'], pattern: 'plain', shorts: '#00843D', pt: 'da Austrália' },
  { id: 'palmeiras', name: 'Palmeiras', short: 'Palmeiras', kind: 'club', colours: ['#006437', '#FFFFFF'], pattern: 'plain', shorts: '#FFFFFF', pt: 'do Palmeiras' },
  { id: 'flamengo', name: 'Flamengo', short: 'Flamengo', kind: 'club', colours: ['#C8102E', '#111111'], pattern: 'hoops', shorts: '#FFFFFF', pt: 'do Flamengo' },
  { id: 'real-madrid', name: 'Real Madrid', short: 'Real Madrid', kind: 'club', colours: ['#FFFFFF', '#1B3A6B'], pattern: 'plain', shorts: '#FFFFFF', pt: 'do Real Madrid' },
  { id: 'barcelona', name: 'Barcelona', short: 'Barcelona', kind: 'club', colours: ['#A50044', '#004D98'], pattern: 'stripes', shorts: '#004D98', pt: 'do Barcelona' },
  { id: 'bayern', name: 'Bayern Munich', short: 'Bayern', kind: 'club', colours: ['#DC052D', '#FFFFFF'], pattern: 'plain', shorts: '#DC052D', pt: 'do Bayern' },
  { id: 'psg', name: 'Paris Saint-Germain', short: 'PSG', kind: 'club', colours: ['#0B2A5B', '#DA291C'], pattern: 'band', shorts: '#0B2A5B', pt: 'do PSG' },
  { id: 'man-united', name: 'Manchester United', short: 'Man United', kind: 'club', colours: ['#DA291C', '#FFFFFF'], pattern: 'plain', shorts: '#FFFFFF', pt: 'do Manchester United' },
  { id: 'man-city', name: 'Manchester City', short: 'Man City', kind: 'club', colours: ['#6CABDD', '#FFFFFF'], pattern: 'plain', shorts: '#FFFFFF', pt: 'do Manchester City' },
  { id: 'liverpool', name: 'Liverpool', short: 'Liverpool', kind: 'club', colours: ['#C8102E', '#FFFFFF'], pattern: 'plain', shorts: '#C8102E', pt: 'do Liverpool' },
  { id: 'chelsea', name: 'Chelsea', short: 'Chelsea', kind: 'club', colours: ['#034694', '#FFFFFF'], pattern: 'plain', shorts: '#034694', pt: 'do Chelsea' },
  { id: 'arsenal', name: 'Arsenal', short: 'Arsenal', kind: 'club', colours: ['#EF0107', '#FFFFFF'], pattern: 'sleeves', shorts: '#FFFFFF', pt: 'do Arsenal' },
  { id: 'juventus', name: 'Juventus', short: 'Juventus', kind: 'club', colours: ['#111111', '#FFFFFF'], pattern: 'stripes', shorts: '#FFFFFF', pt: 'da Juventus' },
];

export const teamById = (id: string | null | undefined): Team | undefined => TEAMS.find((t) => t.id === id);

/** a country or a club, rather than one of the made-up sides */
export const real = (t: Team): boolean => t.kind === 'country' || t.kind === 'club';

/** the side you play for, chosen in the settings */
export const ourTeam = (): Team => teamById(read<string>('team', YOU.id)) ?? YOU;
export const setOurTeam = (id: string): void => write('team', id);

/** the opponent chosen in the settings, or 'any' */
export const rivalChoice = (): string => read<string>('rival', 'any');
export const setRival = (id: string): void => write('rival', id);

/** who you play: the opponent chosen, unless that is your own side, or else
    any real team but yours and the one just played */
export function rivalFor(us: Team, last?: Team): Team {
  const chosen = teamById(rivalChoice());
  if (chosen && chosen !== us) return chosen;
  const others = TEAMS.filter((t) => real(t) && t !== us && t !== last);
  /* buttons whose faces would look alike on the table are no match */
  const apart = others.filter((t) => !clash(t, us));
  return pick(apart.length ? apart : others);
}

/** how far apart two colours look, roughly: 0 the same, about 765 black and white */
function gap(p: string, q: string): number {
  const rgb = (hex: string): number[] => { const n = parseInt(hex.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const [a, b] = [rgb(p), rgb(q)];
  return a.reduce((sum, v, i) => sum + Math.abs(v - b[i]), 0);
}

/** do two teams' buttons look too alike to tell apart (their faces, the first colour)? */
export const clash = (t: Team, u: Team): boolean => gap(t.colours[0], u.colours[0]) < 160;

/** a team's name as it is shown, flag first where there is one */
export const label = (team: Team, short = false): string =>
  `${team.flag ? `${team.flag} ` : ''}${short ? team.short : team.name}`;

const SVG = 'http://www.w3.org/2000/svg';
const SHIRT = 'M20 8 L27 5 Q32 11 37 5 L44 8 L59 19 L52 29 L46 25 L46 59 L18 59 L18 25 L12 29 L5 19 Z';
let clips = 0;

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/** the team's pattern, laid over a shape given as a clip path */
function cloth(team: Team, shape: string, box: { x: number; y: number; w: number; h: number }): SVGElement[] {
  const [main, second] = team.colours;
  const id = `pk-kit-${(clips += 1)}`;
  const clip = svg('clipPath', { id });
  clip.append(svg('path', { d: shape }));
  const g = svg('g', { 'clip-path': `url(#${id})` });
  const { x, y, w, h } = box;
  g.append(svg('rect', { x, y, width: w, height: h, fill: main }));
  if (team.pattern === 'stripes') {
    const step = w / 4;
    for (let sx = x + step / 2; sx < x + w; sx += step) g.append(svg('rect', { x: sx, y, width: step / 2, height: h, fill: second }));
  } else if (team.pattern === 'hoops') {
    const step = h / 4;
    for (let sy = y + step / 2; sy < y + h; sy += step) g.append(svg('rect', { x, y: sy, width: w, height: step / 2, fill: second }));
  } else if (team.pattern === 'sleeves') {
    g.append(svg('rect', { x, y, width: w * 0.28, height: h, fill: second }));
    g.append(svg('rect', { x: x + w * 0.72, y, width: w * 0.28, height: h, fill: second }));
  } else if (team.pattern === 'band') {
    g.append(svg('rect', { x: x + w * 0.4, y, width: w * 0.2, height: h, fill: '#FFFFFF' }));
    g.append(svg('rect', { x: x + w * 0.43, y, width: w * 0.14, height: h, fill: second }));
  }
  return [clip, g];
}

/** the team's shirt, drawn in its colours; decoration only, so hidden from screen readers */
export function kit(team: Team, size: number): SVGSVGElement {
  const root = svg('svg', { viewBox: '0 0 64 64', width: size, height: size, 'aria-hidden': 'true', class: 'pk-kit' });
  root.append(...cloth(team, SHIRT, { x: 0, y: 0, w: 64, h: 64 }));
  /* collar in the second colour, and a dark edge so a white shirt still
     stands out on the grass */
  root.append(svg('path', { d: 'M27 5 Q32 11 37 5', fill: 'none', stroke: team.colours[1], 'stroke-width': 3 }));
  root.append(svg('path', { d: SHIRT, fill: 'none', stroke: '#0B302F', 'stroke-width': 2, 'stroke-linejoin': 'round' }));
  /* high on the left of the chest, where a crest is worn; too small to make
     out below 32px */
  if (size >= 32) root.append(...badge(team, 40, 16.5, 6));
  return root;
}

const INK = '#0B302F';

/** the crest added for the team, cut to a circle on a thin white
    ring, as a badge is sewn on; nothing when there is none */
function badge(team: Team, cx: number, cy: number, r: number): SVGElement[] {
  const crest = crestOf(team.id);
  if (!crest) return [];
  const id = `pk-crest-${(clips += 1)}`;
  const clip = svg('clipPath', { id });
  clip.append(svg('circle', { cx, cy, r }));
  return [
    clip,
    svg('circle', { cx, cy, r: r + 0.9, fill: '#FFFFFF', stroke: INK, 'stroke-width': 0.8 }),
    svg('image', {
      href: crest, x: cx - r, y: cy - r, width: 2 * r, height: 2 * r,
      preserveAspectRatio: 'xMidYMid slice', 'clip-path': `url(#${id})`, class: 'pk-crest',
    }),
  ];
}
