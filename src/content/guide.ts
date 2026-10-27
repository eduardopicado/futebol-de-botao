/* How to play: the steps of the guide, each a few words and a little match
 * played on the real table to show them.
 *
 * Every demo is a set-up and the flicks played from it, through the rules
 * (match.ts) and the physics, so what it shows is what a match does. Each
 * says what the rules make of its flicks, and the unit test holds it to
 * that: the foul shown is a foul, the goal shown counts. The words follow
 * the rule chosen in the settings: three touches or one, and no parking the
 * ball at 1 Toque. */

import type { Point } from './botao';
import { call, flick, newMatch, pronto, type Event, type Match, type Play, type Rule, type Side } from './match';

export type StepId = 'flick' | 'touches' | 'call' | 'goleiro' | 'foul' | 'parked' | 'kickoff';

export interface Demo {
  /** the table at the start */
  start: Match;
  /** "A gol!" is called first, and the other side's goleiro slides across to here and says Pronto */
  pronto?: number;
  flicks: { button: number; vx: number; vy: number }[];
  /** what the rules make of each flick */
  expect: Event['kind'][];
}

export interface Step {
  id: StepId;
  title: string;
  /** what to do, as said aloud too: no pictures in it */
  words: string;
  demo: Demo;
}

/** buttons a side in the demos */
const SIZE = 4;

/** a turn in a match under way, side a to play, with everything where it is put */
function at(rule: Rule, over: Partial<Match> & { ball: Point; a: Point[]; b: Point[] }): Match {
  return { ...newMatch(3, 'a', SIZE, rule), phase: 'play', touches: 0, used: [], attack: false, ...over };
}

/** their buttons, at the top, out of the way */
const AWAY = (): Point[] => [{ x: 10, y: 12 }, { x: 54, y: 12 }, { x: 14, y: 32 }, { x: 50, y: 32 }];

/** the steps, for the rule a match is played to and the goals that win it */
export function guideSteps(rule: Rule, goals: number): Step[] {
  const one = rule === '1';
  const steps: Step[] = [
    {
      id: 'flick',
      title: 'Flick',
      words: 'Put a finger on one of your buttons, pull back, and let go. The further you pull, the harder it goes.',
      demo: {
        start: at(rule, { ball: { x: 32, y: 54 }, a: [{ x: 20, y: 86 }, { x: 44, y: 86 }, { x: 32, y: 74 }, { x: 32, y: 62 }], b: AWAY() }),
        flicks: [{ button: 3, vx: 0, vy: -30 }],
        expect: [one ? 'turn' : 'on'],
      },
    },
    {
      id: 'touches',
      title: one ? 'One touch' : 'Three touches',
      words: one
        ? 'A turn is one flick. Then it is the other side\'s turn.'
        : 'A turn is up to three flicks, with any of your buttons, the same one again too. Then it is the other side\'s turn, sooner if a flick misses the ball or the ball last touched one of theirs.',
      demo: {
        start: at(rule, { ball: { x: 32, y: 66 }, a: [{ x: 20, y: 86 }, { x: 44, y: 86 }, { x: 22, y: 70 }, { x: 32, y: 74 }], b: AWAY() }),
        flicks: one
          ? [{ button: 3, vx: 0, vy: -20 }]
          : [{ button: 3, vx: 0, vy: -20 }, { button: 3, vx: 7.6, vy: -39.3 }, { button: 2, vx: 17, vy: -62.7 }],
        expect: one ? ['turn'] : ['on', 'on', 'turn'],
      },
    },
    {
      id: 'call',
      title: 'A gol!',
      words: 'To shoot, tap A gol! first, in a turn that starts with the ball in their half. A goal that was not called does not count.',
      demo: {
        start: at(rule, {
          ball: { x: 32, y: 30 }, attack: true,
          a: [{ x: 20, y: 86 }, { x: 44, y: 86 }, { x: 32, y: 66 }, { x: 32, y: 42 }],
          b: [{ x: 8, y: 10 }, { x: 56, y: 10 }, { x: 8, y: 30 }, { x: 56, y: 34 }],
        }),
        pronto: 23,
        flicks: [{ button: 3, vx: -15.8, vy: -63.1 }],
        expect: ['goal'],
      },
    },
    {
      id: 'goleiro',
      title: 'Your goleiro',
      words: one
        ? 'When they call A gol!, move your goleiro anywhere in its small area and tap Pronto. Then they shoot. On your own turn you may move it too.'
        : 'When they call A gol!, slide your goleiro along its line with a finger and tap Pronto. Then they shoot.',
      demo: {
        start: at(rule, {
          turn: 'b', ball: { x: 26, y: 74 }, attack: true, keepers: { a: 44, b: 32 },
          a: [{ x: 8, y: 88 }, { x: 56, y: 88 }, { x: 8, y: 60 }, { x: 56, y: 60 }],
          b: [{ x: 10, y: 12 }, { x: 54, y: 12 }, { x: 32, y: 30 }, { x: 22.4, y: 62 }],
        }),
        pronto: 32,
        flicks: [{ button: 3, vx: 19.5, vy: 56.7 }],
        expect: ['turn'],
      },
    },
    {
      id: 'foul',
      title: 'Fouls',
      words: 'If your button hits one of theirs before it touches the ball, it is a foul: a free kick to them from there, or a penalty if it was in your own penalty area.',
      demo: {
        start: at(rule, {
          ball: { x: 46, y: 50 },
          a: [{ x: 20, y: 86 }, { x: 44, y: 86 }, { x: 32, y: 74 }, { x: 22, y: 62 }],
          b: [{ x: 10, y: 12 }, { x: 54, y: 12 }, { x: 22, y: 46 }, { x: 50, y: 30 }],
        }),
        flicks: [{ button: 3, vx: 0, vy: -60 }],
        expect: ['foul'],
      },
    },
  ];
  if (one) {
    steps.push({
      id: 'parked',
      title: 'No parking',
      words: 'With the ball between two of your buttons, your flick has to free it. Leave it there, or box it in with three, and it is a free kick to them.',
      demo: {
        start: at(rule, { ball: { x: 32, y: 60 }, a: [{ x: 20, y: 86 }, { x: 44, y: 86 }, { x: 24, y: 60 }, { x: 40, y: 60 }], b: AWAY() }),
        flicks: [{ button: 0, vx: 0, vy: -40 }],
        expect: ['parked'],
      },
    });
  }
  steps.push({
    id: 'kickoff',
    title: 'Kick-off',
    words: `A match starts from the middle: two flicks by different buttons, and the ball has to leave the circle. After a goal, the side that let it in kicks off. First to ${goals} goals wins!`,
    demo: {
      start: newMatch(goals, 'a', SIZE, rule),
      flicks: [{ button: 3, vx: 0, vy: -15 }, { button: 2, vx: -29.9, vy: -18.1 }],
      expect: ['on', 'turn'],
    },
  });
  return steps;
}

/** a demo played through the rules: the match before each flick, and what the flick did */
export function played(d: Demo): { before: Match; play: Play }[] {
  let m = d.pronto === undefined ? d.start : pronto(call(d.start), d.pronto);
  return d.flicks.map((f) => {
    const before = m;
    const play = flick(m, f.button, f.vx, f.vy);
    m = play.next;
    return { before, play };
  });
}

/** what a flick led to, in a few words for the note, as the side at the bottom (a) sees it */
export function told(play: Pick<Play, 'event' | 'bumps'>, rule: Rule): string {
  const e = play.event;
  const to = (s: Side): string => (s === 'a' ? 'you' : 'them');
  const turn = (s: Side): string => (s === 'a' ? 'your turn now.' : 'their turn now.');
  const Turn = (s: Side): string => (s === 'a' ? 'Your turn now.' : 'Their turn now.');
  switch (e.kind) {
    case 'goal': case 'champion': return e.own ? 'Own goal!' : 'GOL!';
    case 'foul': return `Foul! A ${e.penalty ? 'penalty' : 'free kick'} to ${to(e.side)}.`;
    case 'parked': return `Parked! A free kick to ${to(e.side)}.`;
    case 'uncalled': return 'Not called: no goal.';
    case 'retake': return 'Still in the circle: again.';
    case 'on': return `${e.left} ${e.left === 1 ? 'touch' : 'touches'} left.`;
    case 'turn': {
      if (e.why === 'theirs') {
        /* the goleiro's touch is a save; one of the buttons', a block */
        const last = [...play.bumps].reverse().find((b) => b.what === 'block' || b.what === 'keeper');
        return `${last?.what === 'keeper' ? 'Saved!' : 'Blocked!'} ${Turn(e.side)}`;
      }
      if (e.why === 'still') return `Missed the ball: ${turn(e.side)}`;
      if (e.why === 'kickoff') return `Out of the circle. ${Turn(e.side)}`;
      if (e.why === 'penalty') return `Penalty taken. ${Turn(e.side)}`;
      return `${rule === '1' ? 'One flick' : 'No touches left'}: ${turn(e.side)}`;
    }
  }
}
