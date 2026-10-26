/* What the football commentator shouts, in Portuguese and in English.
 *
 * Here rather than in src/games/narration.ts so that tools/make-audio.ts can
 * record every one of them: the game picks a line at random, and a line the
 * tool had never heard of would play in the device voice. */

/** a save, in Portuguese */
export const PT_SAVES = ['Defendeu o goleiro!', 'Que defesa!', 'Pegou o goleiro!'];

/** a goal, in Portuguese: for a team said with its article ("do Brasil"), or for his own */
export const ptGoals = (team?: string): string[] =>
  team ? [`Goooool ${team}!`, `É gol ${team}!`, `Golaço ${team}!`] : ['Goooool!', 'Golaço!', 'É gol!'];

/** a save, in English */
export const EN_SAVES = ['What a save!', 'Saved by the keeper!'];

/** a goal, in English: for a team by name, or for his own */
export const enGoal = (team?: string): string => (team ? `Goooal for ${team}!` : 'Goooal!');
