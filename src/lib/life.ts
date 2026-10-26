/* A game's lifetime, so nothing it scheduled outlives it.
 *
 * Most games move on with a timer: a right answer, a pause to enjoy it, then
 * the next word is shown and spoken. Leave the game inside that pause and a
 * bare setTimeout still fires, so the next word was being said over the home
 * screen, a win fanfare played to nobody, and a microphone could open after
 * the game that asked for it had gone.
 *
 * So each game takes one of these when it mounts, schedules through it, and
 * ends it when it unmounts. Anything async checks `alive()` when it wakes. */

export interface Life {
  /** setTimeout that is cancelled when the game ends; returns a way to
      cancel just this one sooner */
  later: (fn: () => void, ms: number) => () => void;
  /** cancel everything scheduled so far, but keep living (a new round) */
  clear: () => void;
  /** false once the game has been left */
  alive: () => boolean;
  /** the game is gone: cancel everything, for good */
  end: () => void;
}

export function lifetime(): Life {
  const timers = new Set<number>();
  let alive = true;
  const clear = (): void => {
    for (const t of timers) window.clearTimeout(t);
    timers.clear();
  };
  return {
    later: (fn, ms) => {
      if (!alive) return () => undefined;
      const t = window.setTimeout(() => { timers.delete(t); if (alive) fn(); }, ms);
      timers.add(t);
      return () => { window.clearTimeout(t); timers.delete(t); };
    },
    clear,
    alive: () => alive,
    end: () => { alive = false; clear(); },
  };
}
