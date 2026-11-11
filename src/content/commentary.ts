/* What the football commentator shouts, in Portuguese and in English.
 *
 * Here rather than in src/games/narration.ts so that tools/make-audio.ts can
 * record every one of them: the game picks a line at random, and a line the
 * tool had never heard of would play in the device voice. */

/** a shot called: "Pro gol!" (for "para o gol", at the goal), what a
    player calls before shooting and the button says. It is shouted in
    Portuguese whichever commentator speaks: it is the call's own name, like
    Pronto */
export const PT_CALL = 'Pro gol!';

/** a save, in Portuguese */
export const PT_SAVES = ['Defendeu o goleiro!', 'Que defesa!', 'Pegou o goleiro!'];

/** a goal, in Portuguese: for a team said with its article ("do Brasil"), or for a made-up side */
export const ptGoals = (team?: string): string[] =>
  team ? [`Goooool ${team}!`, `É gol ${team}!`] : ['Goooool!', 'É gol!'];

/** a great goal (off the rim, or from far out: golaco() in match.ts), in Portuguese */
export const ptGolacos = (team?: string): string[] =>
  team ? [`Golaço ${team}!`, `Que golaço ${team}!`] : ['Golaço!', 'Que golaço!'];

/** a great goal, in English */
export const enGolaco = (team?: string): string => (team ? `What a goal from ${team}!` : 'What a goal!');

/** a chip over the crossbar, in Portuguese and in English */
export const PT_OVER = ['Por cima!', 'Isolou!', 'Por cima do gol!'];
export const EN_OVER = ['Over the bar!', 'Just over!', 'Over the top!'];
/** the ball stopped on the goal line, not in: the goleiro's */
export const PT_KEEPER_BALL = ['Bola do goleiro!', 'É do goleiro!', 'Em cima da linha!'];
export const EN_KEEPER_BALL = ["Keeper's ball!", 'On the line!', "It stays out!"];

/** a shot about to be taken (the goleiro placed, Pronto), in Portuguese and in English */
export const PT_SHOTS = ['Lá vem ele!', 'Vai chutar!', 'Ajeitou pro chute!'];
export const EN_SHOTS = ['Here he comes!', 'He lines it up!', 'Here comes the shot!'];

/** the ball left in their penalty area by a flick, in Portuguese and in English */
export const PT_DANGER = ['Perigo!', 'Olha o perigo!', 'Cuidado!'];
export const EN_DANGER = ['Danger!', 'Look out!', 'Dangerous!'];

/** a save, in English */
export const EN_SAVES = ['What a save!', 'Saved by the keeper!'];

/** a goal, in English: for a team by name, or for one of the made-up sides */
export const enGoal = (team?: string): string => (team ? `Goooal for ${team}!` : 'Goooal!');

/** the match won, in Portuguese */
export const PT_CHAMPIONS = ['É campeão!', 'É campeão! É campeão!'];

/** the match won, in English */
export const enChampion = (team?: string): string => (team ? `${team} are the champions!` : 'Champions!');

/** a shot off the post that stayed out, in Portuguese and in English */
export const PT_POSTS = ['Na trave!', 'No pau!', 'Bateu na trave!'];
export const EN_POSTS = ['Off the post!', 'Hit the post!'];

/** a shot that just missed, in Portuguese and in English */
export const PT_CLOSE = ['Quase!', 'Passou raspando!'];
export const EN_CLOSE = ['So close!', 'Just wide!'];

/** a goal into a side's own net, in Portuguese and in English */
export const PT_OWN_GOALS = ['Gol contra!'];
export const EN_OWN_GOALS = ['Own goal!'];
