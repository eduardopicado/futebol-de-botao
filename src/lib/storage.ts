/* localStorage, assuming it will fail.
 *
 * Private windows, blocked site data and iOS quota errors all throw, and the
 * app has to work anyway — a child who cannot save a setting should still be
 * able to play. Every read falls back, every write is allowed to fail.
 *
 * What comes back is also only what it says it is. A saved value outlives the
 * code that wrote it, and can be half-written or hand-edited; a `null` where
 * a game expected its saved object made it throw as it opened. So a read
 * returns the fallback unless the saved value is the same kind of thing: an
 * object for an object, a list for a list, a number for a number. A game
 * still checks the fields it uses. */

const PREFIX = 'fdb:';

/** is this the same kind of value as the fallback? A null fallback takes anything */
function sameKind(value: unknown, fallback: unknown): boolean {
  if (fallback === null || fallback === undefined) return true;
  if (Array.isArray(fallback)) return Array.isArray(value);
  if (typeof fallback === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  return typeof value === typeof fallback;
}

export function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    const value: unknown = JSON.parse(raw);
    return sameKind(value, fallback) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

export function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* nothing saved, nothing broken */
  }
}
