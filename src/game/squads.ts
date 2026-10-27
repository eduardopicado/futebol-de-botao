/* The players: a number and a name for each button, and the goleiro's.
 *
 * Every real team comes with six of its men's squad as of October 2026 (the
 * national teams from their September/October call-ups, the clubs from their
 * 2026–27 squads, checked against the clubs' own pages and announcements
 * where they could be read): the goleiro, two at the back, two in midfield
 * and one up front, each with his squad number. Squads change; anyone can put their own
 * names and numbers on any team in the settings, kept on this device, and
 * those win. You and the Rivals come with numbers only.
 *
 * Five a side, the buttons are the five outfield players in that order (as
 * match.ts lines them up: two at the back, two in midfield, the forward);
 * four a side, the second midfielder sits out. */

import { read, write } from '../lib/storage';
import type { Team } from './teams';

export interface Player { n: number; name: string }

/** the goleiro, two defenders, two midfielders and a forward */
export const POSITIONS = ['Goleiro', 'Defender', 'Defender', 'Midfielder', 'Midfielder', 'Forward'] as const;

const squad = (...players: [number, string][]): Player[] => players.map(([n, name]) => ({ n, name }));

export const SQUADS: Record<string, Player[]> = {
  brazil: squad([1, 'Hugo Souza'], [4, 'Marquinhos'], [3, 'Gabriel Magalhães'], [8, 'Bruno Guimarães'], [18, 'Douglas Luiz'], [7, 'Vinícius Júnior']),
  argentina: squad([23, 'Emiliano Martínez'], [19, 'Nicolás Otamendi'], [3, 'Nicolás Tagliafico'], [7, 'Rodrigo De Paul'], [11, 'Giovani Lo Celso'], [10, 'Lionel Messi']),
  france: squad([16, 'Mike Maignan'], [5, 'Jules Koundé'], [17, 'Maxence Lacroix'], [14, 'Adrien Rabiot'], [6, 'Eduardo Camavinga'], [7, 'Ousmane Dembélé']),
  germany: squad([1, 'Marc-André ter Stegen'], [4, 'Jonathan Tah'], [22, 'David Raum'], [6, 'Joshua Kimmich'], [17, 'Florian Wirtz'], [11, 'Nick Woltemade']),
  spain: squad([23, 'Unai Simón'], [14, 'Aymeric Laporte'], [22, 'Marc Cucurella'], [16, 'Rodri'], [10, 'Dani Olmo'], [21, 'Mikel Oyarzabal']),
  italy: squad([1, 'Gianluigi Donnarumma'], [22, 'Giovanni Di Lorenzo'], [6, 'Alessandro Bastoni'], [18, 'Nicolò Barella'], [16, 'Davide Frattesi'], [11, 'Gianluca Scamacca']),
  england: squad([1, 'Jordan Pickford'], [6, 'Marc Guéhi'], [2, 'Trent Alexander-Arnold'], [10, 'Jude Bellingham'], [8, 'Elliot Anderson'], [9, 'Harry Kane']),
  uruguay: squad([12, 'Santiago Mele'], [2, 'José María Giménez'], [4, 'Ronald Araújo'], [6, 'Rodrigo Bentancur'], [8, 'Federico Valverde'], [9, 'Darwin Núñez']),
  portugal: squad([1, 'Diogo Costa'], [3, 'Rúben Dias'], [20, 'João Cancelo'], [10, 'Bernardo Silva'], [8, 'Bruno Fernandes'], [11, 'João Félix']),
  australia: squad([18, 'Patrick Beach'], [16, 'Aziz Behich'], [2, 'Miloš Degenek'], [22, 'Jackson Irvine'], [8, 'Connor Metcalfe'], [17, 'Nestory Irankunda']),
  palmeiras: squad([1, 'Carlos Miguel'], [15, 'Gustavo Gómez'], [22, 'Joaquín Piquerez'], [7, 'Felipe Anderson'], [8, 'Andreas Pereira'], [10, 'Paulinho']),
  flamengo: squad([1, 'Agustín Rossi'], [4, 'Léo Pereira'], [26, 'Alex Sandro'], [10, 'Giorgian de Arrascaeta'], [11, 'Lucas Paquetá'], [9, 'Pedro']),
  'real-madrid': squad([1, 'Thibaut Courtois'], [3, 'Éder Militão'], [12, 'Trent Alexander-Arnold'], [5, 'Jude Bellingham'], [8, 'Federico Valverde'], [10, 'Kylian Mbappé']),
  barcelona: squad([1, 'Joan García'], [5, 'Pau Cubarsí'], [23, 'Jules Koundé'], [8, 'Pedri'], [21, 'Frenkie de Jong'], [10, 'Lamine Yamal']),
  bayern: squad([1, 'Manuel Neuer'], [3, 'Kim Min-jae'], [19, 'Alphonso Davies'], [6, 'Joshua Kimmich'], [10, 'Jamal Musiala'], [9, 'Harry Kane']),
  psg: squad([39, 'Matvey Safonov'], [2, 'Achraf Hakimi'], [5, 'Marquinhos'], [17, 'Vitinha'], [87, 'João Neves'], [10, 'Ousmane Dembélé']),
  'man-united': squad([1, 'Senne Lammens'], [4, 'Matthijs de Ligt'], [6, 'Lisandro Martínez'], [8, 'Bruno Fernandes'], [37, 'Kobbie Mainoo'], [10, 'Matheus Cunha']),
  'man-city': squad([1, 'Gianluigi Donnarumma'], [3, 'Rúben Dias'], [6, 'Marc Guéhi'], [5, 'Elliot Anderson'], [47, 'Phil Foden'], [9, 'Erling Haaland']),
  liverpool: squad([1, 'Alisson Becker'], [4, 'Virgil van Dijk'], [30, 'Jeremie Frimpong'], [8, 'Dominik Szoboszlai'], [7, 'Florian Wirtz'], [9, 'Alexander Isak']),
  chelsea: squad([1, 'Robert Sánchez'], [24, 'Reece James'], [6, 'Levi Colwill'], [10, 'Cole Palmer'], [25, 'Moisés Caicedo'], [7, 'Pedro Neto']),
  arsenal: squad([1, 'David Raya'], [2, 'William Saliba'], [6, 'Gabriel Magalhães'], [8, 'Martin Ødegaard'], [41, 'Declan Rice'], [7, 'Bukayo Saka']),
  juventus: squad([1, 'Kamil Grabara'], [3, 'Bremer'], [20, 'Andrea Cambiaso'], [5, 'Manuel Locatelli'], [8, 'Teun Koopmeiners'], [10, 'Kenan Yıldız']),
};

/** a made-up side's numbers, and no names until someone gives them */
const NUMBERS_ONLY: Player[] = squad([1, ''], [2, ''], [3, ''], [5, ''], [8, ''], [9, '']);

const KEY = 'players';
type Changes = Record<string, (Partial<Player> | null)[]>;

const changes = (): Changes => {
  const saved = read<Changes>(KEY, {});
  return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
};

/** a number a shirt can carry */
const shirt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 99;

/** the team's six, as shipped, with what has been changed on this device on top */
export function squadOf(team: Team): Player[] {
  const own = changes()[team.id] ?? [];
  return (SQUADS[team.id] ?? NUMBERS_ONLY).map((p, i) => {
    const c = own[i];
    return {
      n: c && shirt(c.n) ? c.n : p.n,
      name: c && typeof c.name === 'string' ? c.name.trim().slice(0, 30) : p.name,
    };
  });
}

/** one of a team's six changed on this device: its number, its name, or both */
export function setPlayer(team: Team, slot: number, change: Partial<Player>): void {
  const all = changes();
  const own = [...(all[team.id] ?? [])];
  own[slot] = { ...(own[slot] ?? {}), ...change };
  write(KEY, { ...all, [team.id]: own });
}

/** the team back to its six as shipped */
export function resetSquad(team: Team): void {
  const { [team.id]: _gone, ...rest } = changes();
  write(KEY, rest);
}

/** has anything been changed on this team? */
export const changedSquad = (team: Team): boolean => (changes()[team.id] ?? []).some((c) => c);

/** the goleiro */
export const goleiroOf = (team: Team): Player => squadOf(team)[0];

/** the buttons, in the order match.ts lines them up: five, or four (the second midfielder sits out) */
export function buttonsOf(team: Team, size: number): Player[] {
  const [, d1, d2, m1, m2, f] = squadOf(team);
  return size === 4 ? [d1, d2, m1, f] : [d1, d2, m1, m2, f].slice(0, size);
}

/** who takes a side's kick in a shootout: the forward first, then back through the team */
export const takerOf = (team: Team, kick: number): Player => {
  const [, d1, d2, m1, m2, f] = squadOf(team);
  return [f, m2, m1, d2, d1][kick % 5];
};

/** a player as said and shown: "10 · Lionel Messi", or "Number 9" with no name */
export const playerLabel = (p: Player): string => (p.name ? `${p.n} · ${p.name}` : `Number ${p.n}`);
