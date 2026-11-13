/* The players: a number and a name for each button, and the goleiro's.
 *
 * Every real team comes with twelve: six of its men's squad as of October 2026 (the
 * national teams from their September/October call-ups, the clubs from their
 * 2026–27 squads, checked against the clubs' own pages and announcements
 * where they could be read): the goleiro, two at the back, two in midfield
 * and one up front, each with his squad number. Squads change; anyone can put their own
 * names and numbers on any team in the settings, kept on this device, and
 * those win. You and the Rivals come with numbers only.
 *
 * The other six of a real team's twelve are famous ones, the classics among
 * them (Pelé, Maradona, Zidane), each with the number he made famous, so a
 * shirt number can come twice. Six play: the first six, unless others are
 * picked in the settings (a goleiro and five outfield), kept on this device.
 *
 * Five a side, the buttons are the five outfield players in that order (as
 * match.ts lines them up: two at the back, two in midfield, the forward);
 * four a side, the second midfielder sits out. */

import { read, write } from '../lib/storage';
import type { Team } from './teams';

export interface Player { n: number; name: string }

/** each of the twelve: the six who play unless others are picked (the
    goleiro, two defenders, two midfielders and a forward), then the bench (a
    goleiro, a defender, two midfielders and two forwards) */
export const POSITIONS = ['Goleiro', 'Defender', 'Defender', 'Midfielder', 'Midfielder', 'Forward', 'Goleiro', 'Defender', 'Midfielder', 'Midfielder', 'Forward', 'Forward'] as const;
export type Position = (typeof POSITIONS)[number];
/** how many play: a goleiro and five outfield */
export const PLAY = 6;

const squad = (...players: [number, string][]): Player[] => players.map(([n, name]) => ({ n, name }));

export const SQUADS: Record<string, Player[]> = {
  brazil: squad([1, 'Hugo Souza'], [4, 'Marquinhos'], [3, 'Gabriel Magalhães'], [8, 'Bruno Guimarães'], [18, 'Douglas Luiz'], [7, 'Vinícius Júnior'],
    /* and the bench: famous ones, the classics among them */
    [1, 'Taffarel'], [2, 'Cafu'], [10, 'Pelé'], [10, 'Ronaldinho'], [9, 'Ronaldo'], [11, 'Romário']),
  argentina: squad([23, 'Emiliano Martínez'], [19, 'Nicolás Otamendi'], [3, 'Nicolás Tagliafico'], [7, 'Rodrigo De Paul'], [11, 'Giovani Lo Celso'], [10, 'Lionel Messi'],
    /* and the bench: famous ones, the classics among them */
    [12, 'Sergio Goycochea'], [4, 'Javier Zanetti'], [10, 'Diego Maradona'], [10, 'Juan Román Riquelme'], [9, 'Gabriel Batistuta'], [9, 'Julián Álvarez']),
  france: squad([16, 'Mike Maignan'], [5, 'Jules Koundé'], [17, 'Maxence Lacroix'], [14, 'Adrien Rabiot'], [6, 'Eduardo Camavinga'], [7, 'Ousmane Dembélé'],
    /* and the bench: famous ones, the classics among them */
    [16, 'Fabien Barthez'], [15, 'Lilian Thuram'], [10, 'Zinedine Zidane'], [10, 'Michel Platini'], [12, 'Thierry Henry'], [10, 'Kylian Mbappé']),
  germany: squad([1, 'Marc-André ter Stegen'], [4, 'Jonathan Tah'], [22, 'David Raum'], [6, 'Joshua Kimmich'], [17, 'Florian Wirtz'], [11, 'Nick Woltemade'],
    /* and the bench: famous ones, the classics among them */
    [1, 'Oliver Kahn'], [5, 'Franz Beckenbauer'], [10, 'Lothar Matthäus'], [8, 'Toni Kroos'], [13, 'Gerd Müller'], [11, 'Miroslav Klose']),
  spain: squad([23, 'Unai Simón'], [14, 'Aymeric Laporte'], [22, 'Marc Cucurella'], [16, 'Rodri'], [10, 'Dani Olmo'], [21, 'Mikel Oyarzabal'],
    /* and the bench: famous ones, the classics among them */
    [1, 'Iker Casillas'], [15, 'Sergio Ramos'], [8, 'Xavi'], [6, 'Andrés Iniesta'], [7, 'David Villa'], [9, 'Fernando Torres']),
  italy: squad([1, 'Gianluigi Donnarumma'], [22, 'Giovanni Di Lorenzo'], [6, 'Alessandro Bastoni'], [18, 'Nicolò Barella'], [16, 'Davide Frattesi'], [11, 'Gianluca Scamacca'],
    /* and the bench: famous ones, the classics among them */
    [1, 'Gianluigi Buffon'], [3, 'Paolo Maldini'], [21, 'Andrea Pirlo'], [10, 'Roberto Baggio'], [20, 'Paolo Rossi'], [10, 'Francesco Totti']),
  england: squad([1, 'Jordan Pickford'], [6, 'Marc Guéhi'], [2, 'Trent Alexander-Arnold'], [10, 'Jude Bellingham'], [8, 'Elliot Anderson'], [9, 'Harry Kane'],
    /* and the bench: famous ones, the classics among them */
    [1, 'Gordon Banks'], [6, 'Bobby Moore'], [9, 'Bobby Charlton'], [7, 'David Beckham'], [10, 'Gary Lineker'], [10, 'Wayne Rooney']),
  uruguay: squad([12, 'Santiago Mele'], [2, 'José María Giménez'], [4, 'Ronald Araújo'], [6, 'Rodrigo Bentancur'], [8, 'Federico Valverde'], [9, 'Darwin Núñez'],
    /* and the bench: famous ones, the classics among them */
    [1, 'Fernando Muslera'], [3, 'Diego Godín'], [10, 'Enzo Francescoli'], [5, 'Obdulio Varela'], [9, 'Luis Suárez'], [10, 'Diego Forlán']),
  portugal: squad([1, 'Diogo Costa'], [3, 'Rúben Dias'], [20, 'João Cancelo'], [10, 'Bernardo Silva'], [8, 'Bruno Fernandes'], [11, 'João Félix'],
    /* and the bench: famous ones, the classics among them */
    [1, 'Vítor Baía'], [3, 'Pepe'], [7, 'Luís Figo'], [10, 'Rui Costa'], [13, 'Eusébio'], [7, 'Cristiano Ronaldo']),
  australia: squad([18, 'Patrick Beach'], [16, 'Aziz Behich'], [2, 'Miloš Degenek'], [22, 'Jackson Irvine'], [8, 'Connor Metcalfe'], [17, 'Nestory Irankunda'],
    /* and the bench: famous ones, the classics among them */
    [1, 'Mark Schwarzer'], [2, 'Lucas Neill'], [4, 'Tim Cahill'], [10, 'Harry Kewell'], [9, 'Mark Viduka'], [7, 'Mathew Leckie']),
  palmeiras: squad([1, 'Carlos Miguel'], [15, 'Gustavo Gómez'], [22, 'Joaquín Piquerez'], [7, 'Felipe Anderson'], [8, 'Andreas Pereira'], [10, 'Paulinho'],
    /* and the bench: famous ones, the classics among them */
    [12, 'Marcos'], [3, 'Luís Pereira'], [10, 'Ademir da Guia'], [5, 'César Sampaio'], [9, 'Evair'], [7, 'Edmundo']),
  flamengo: squad([1, 'Agustín Rossi'], [4, 'Léo Pereira'], [26, 'Alex Sandro'], [10, 'Giorgian de Arrascaeta'], [11, 'Lucas Paquetá'], [9, 'Pedro'],
    /* and the bench: famous ones, the classics among them */
    [1, 'Júlio César'], [2, 'Leandro'], [10, 'Zico'], [6, 'Júnior'], [9, 'Gabriel Barbosa'], [10, 'Adriano']),
  'real-madrid': squad([1, 'Thibaut Courtois'], [3, 'Éder Militão'], [12, 'Trent Alexander-Arnold'], [5, 'Jude Bellingham'], [8, 'Federico Valverde'], [10, 'Kylian Mbappé'],
    /* and the bench: famous ones, the classics among them */
    [1, 'Iker Casillas'], [3, 'Roberto Carlos'], [5, 'Zinedine Zidane'], [10, 'Luka Modrić'], [9, 'Alfredo Di Stéfano'], [7, 'Cristiano Ronaldo']),
  barcelona: squad([1, 'Joan García'], [5, 'Pau Cubarsí'], [23, 'Jules Koundé'], [8, 'Pedri'], [21, 'Frenkie de Jong'], [10, 'Lamine Yamal'],
    /* and the bench: famous ones, the classics among them */
    [1, 'Víctor Valdés'], [5, 'Carles Puyol'], [6, 'Xavi'], [8, 'Andrés Iniesta'], [10, 'Lionel Messi'], [10, 'Ronaldinho']),
  bayern: squad([1, 'Manuel Neuer'], [3, 'Kim Min-jae'], [19, 'Alphonso Davies'], [6, 'Joshua Kimmich'], [10, 'Jamal Musiala'], [9, 'Harry Kane'],
    /* and the bench: famous ones, the classics among them */
    [1, 'Sepp Maier'], [5, 'Franz Beckenbauer'], [31, 'Bastian Schweinsteiger'], [10, 'Arjen Robben'], [9, 'Gerd Müller'], [9, 'Robert Lewandowski']),
  psg: squad([39, 'Matvey Safonov'], [2, 'Achraf Hakimi'], [5, 'Marquinhos'], [17, 'Vitinha'], [87, 'João Neves'], [10, 'Ousmane Dembélé'],
    /* and the bench: famous ones, the classics among them */
    [1, 'Gianluigi Buffon'], [2, 'Thiago Silva'], [10, 'Raí'], [21, 'Ronaldinho'], [18, 'Zlatan Ibrahimović'], [7, 'Kylian Mbappé']),
  'man-united': squad([1, 'Senne Lammens'], [4, 'Matthijs de Ligt'], [6, 'Lisandro Martínez'], [8, 'Bruno Fernandes'], [37, 'Kobbie Mainoo'], [10, 'Matheus Cunha'],
    /* and the bench: famous ones, the classics among them */
    [1, 'Peter Schmeichel'], [5, 'Rio Ferdinand'], [18, 'Paul Scholes'], [11, 'Ryan Giggs'], [7, 'Eric Cantona'], [7, 'Cristiano Ronaldo']),
  'man-city': squad([1, 'Gianluigi Donnarumma'], [3, 'Rúben Dias'], [6, 'Marc Guéhi'], [5, 'Elliot Anderson'], [47, 'Phil Foden'], [9, 'Erling Haaland'],
    /* and the bench: famous ones, the classics among them */
    [31, 'Ederson'], [4, 'Vincent Kompany'], [17, 'Kevin De Bruyne'], [21, 'David Silva'], [10, 'Sergio Agüero'], [7, 'Raheem Sterling']),
  liverpool: squad([1, 'Alisson Becker'], [4, 'Virgil van Dijk'], [30, 'Jeremie Frimpong'], [8, 'Dominik Szoboszlai'], [7, 'Florian Wirtz'], [9, 'Alexander Isak'],
    /* and the bench: famous ones, the classics among them */
    [1, 'Ray Clemence'], [23, 'Jamie Carragher'], [8, 'Steven Gerrard'], [7, 'Kenny Dalglish'], [11, 'Mohamed Salah'], [9, 'Ian Rush']),
  chelsea: squad([1, 'Robert Sánchez'], [24, 'Reece James'], [6, 'Levi Colwill'], [10, 'Cole Palmer'], [25, 'Moisés Caicedo'], [7, 'Pedro Neto'],
    /* and the bench: famous ones, the classics among them */
    [1, 'Petr Čech'], [26, 'John Terry'], [8, 'Frank Lampard'], [10, 'Eden Hazard'], [11, 'Didier Drogba'], [25, 'Gianfranco Zola']),
  arsenal: squad([1, 'David Raya'], [2, 'William Saliba'], [6, 'Gabriel Magalhães'], [8, 'Martin Ødegaard'], [41, 'Declan Rice'], [7, 'Bukayo Saka'],
    /* and the bench: famous ones, the classics among them */
    [1, 'David Seaman'], [6, 'Tony Adams'], [4, 'Patrick Vieira'], [10, 'Dennis Bergkamp'], [14, 'Thierry Henry'], [8, 'Ian Wright']),
  juventus: squad([1, 'Kamil Grabara'], [3, 'Bremer'], [20, 'Andrea Cambiaso'], [5, 'Manuel Locatelli'], [8, 'Teun Koopmeiners'], [10, 'Kenan Yıldız'],
    /* and the bench: famous ones, the classics among them */
    [1, 'Gianluigi Buffon'], [6, 'Gaetano Scirea'], [10, 'Michel Platini'], [21, 'Zinedine Zidane'], [10, 'Alessandro Del Piero'], [7, 'Cristiano Ronaldo']),
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

/** the team's twelve (a made-up side's six), as shipped, with what has been changed on this device on top */
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

/** one of a team's players changed on this device: its number, its name, or both */
export function setPlayer(team: Team, slot: number, change: Partial<Player>): void {
  const all = changes();
  const own = [...(all[team.id] ?? [])];
  own[slot] = { ...(own[slot] ?? {}), ...change };
  write(KEY, { ...all, [team.id]: own });
}

/** the team's names and numbers back as shipped */
export function resetSquad(team: Team): void {
  const { [team.id]: _gone, ...rest } = changes();
  write(KEY, rest);
}

/** has anything been changed on this team? */
export const changedSquad = (team: Team): boolean => (changes()[team.id] ?? []).some((c) => c);

const LINEUP = 'lineup';
const ORDER: Record<Position, number> = { Goleiro: 0, Defender: 1, Midfielder: 2, Forward: 3 };

/** the slots picked to play, as saved: any slots of the squad, each once */
export function picked(team: Team): number[] {
  const size = squadOf(team).length;
  const all = read<Record<string, unknown>>(LINEUP, {});
  const own = all && typeof all === 'object' && !Array.isArray(all) ? all[team.id] : undefined;
  if (!Array.isArray(own)) return Array.from({ length: Math.min(PLAY, size) }, (_, i) => i);
  return [...new Set(own.filter((k): k is number => Number.isInteger(k) && k >= 0 && k < size))];
}

/** pick a player to play, or take him off: a goleiro picked takes the other's
    place; an outfield player is picked only while fewer than five are. Says
    what happened, or why not */
export function togglePlayer(team: Team, slot: number): 'in' | 'out' | 'full' | 'keeper' {
  const now = picked(team);
  const keeper = POSITIONS[slot] === 'Goleiro';
  let next: number[];
  let done: 'in' | 'out' | 'full' | 'keeper';
  if (now.includes(slot)) {
    /* a team always has a goleiro: pick the other one instead */
    if (keeper) return 'keeper';
    next = now.filter((k) => k !== slot);
    done = 'out';
  } else if (keeper) {
    next = [...now.filter((k) => POSITIONS[k] !== 'Goleiro'), slot];
    done = 'in';
  } else {
    if (now.filter((k) => POSITIONS[k] !== 'Goleiro').length >= PLAY - 1) return 'full';
    next = [...now, slot];
    done = 'in';
  }
  const all = read<Record<string, unknown>>(LINEUP, {});
  write(LINEUP, { ...(all && typeof all === 'object' && !Array.isArray(all) ? all : {}), [team.id]: next });
  return done;
}

/** the six who play: the goleiro picked, then five outfield in line-up order
    (defenders, midfielders, the forwards); where fewer than five are picked,
    the rest from the squad's order, so a team always has six */
export function lineupOf(team: Team): Player[] {
  const squad = squadOf(team);
  if (squad.length <= PLAY) return squad;
  const chosen = picked(team);
  const keeper = chosen.find((k) => POSITIONS[k] === 'Goleiro') ?? 0;
  const outfield = chosen.filter((k) => POSITIONS[k] !== 'Goleiro').slice(0, PLAY - 1);
  for (let k = 0; outfield.length < PLAY - 1 && k < squad.length; k += 1) {
    if (POSITIONS[k] !== 'Goleiro' && !outfield.includes(k)) outfield.push(k);
  }
  outfield.sort((x, y) => ORDER[POSITIONS[x]] - ORDER[POSITIONS[y]] || x - y);
  return [keeper, ...outfield].map((k) => squad[k]);
}

/** the team back to its first six playing */
export function resetLineup(team: Team): void {
  const all = read<Record<string, unknown>>(LINEUP, {});
  if (!all || typeof all !== 'object' || Array.isArray(all)) return;
  const { [team.id]: _gone, ...rest } = all;
  write(LINEUP, rest);
}

/** the goleiro */
export const goleiroOf = (team: Team): Player => lineupOf(team)[0];

/** the buttons, in the order match.ts lines them up: five, or four (the fourth of the five sits out) */
export function buttonsOf(team: Team, size: number): Player[] {
  const [, d1, d2, m1, m2, f] = lineupOf(team);
  return size === 4 ? [d1, d2, m1, f] : [d1, d2, m1, m2, f].slice(0, size);
}

/** who takes a side's kick in a shootout: the forward first, then back through the team */
export const takerOf = (team: Team, kick: number): Player => {
  const [, d1, d2, m1, m2, f] = lineupOf(team);
  return [f, m2, m1, d2, d1][kick % 5];
};

/** a player as said and shown: "10 · Lionel Messi", or "Number 9" with no name */
export const playerLabel = (p: Player): string => (p.name ? `${p.n} · ${p.name}` : `Number ${p.n}`);
