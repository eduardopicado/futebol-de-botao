/* How long the game waits between things, in milliseconds, in one place.
 *
 * Every pause a player sits through is here, named for its moment, so the
 * pacing can be tuned as a whole: long enough to read the note and see what
 * happened, short enough that nobody waits for the game. The commentator
 * goes on speaking over the next turn; nothing waits for it to finish. An
 * animation keeps its own timing (a frame, a transition's length). */

export const PACE = {
  /** the turn passes: nothing can be flicked for a moment, so nobody flicks by mistake */
  handover: 600,
  /** "GOL!", before the kick-off (a replay holds it until it has played) */
  goal: 1800,
  /** a goal that does not count: not called, or not allowed */
  noGoal: 1500,
  foul: 1200,
  parked: 1500,
  /** the kick-off taken again */
  retake: 1100,
  /** the coin toss, on the table */
  toss: 1300,
  /** the computer: before it places its goleiro, before it moves, and its arrow shown before it flicks */
  cpuPlace: 300,
  cpuMove: 450,
  cpuAim: 600,
  /** each of the eight steps of the computer's goleiro sliding across to its place */
  slideStep: 50,
  /** a goal replayed: a moment on its last frame before the table is put back */
  afterReplay: 400,
  /** a penalty in a shootout, scored or not, before the next */
  kick: 1300,
  /** Treino: Show me, before it starts, each flick's arrow before it plays, and after each flick */
  showStart: 600,
  showAim: 1100,
  showNext: 500,
  /** Treino: a new set-up, after a goal, an own goal, or no touches left */
  newSetUp: 1500,
  /** Goleiro: before the computer shoots, its shot's arrow, a pass, and the result */
  shotReady: 400,
  shotAim: 550,
  pass: 600,
  result: 1300,
} as const;
