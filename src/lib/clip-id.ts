/* The name of the audio clip for a spoken string.
 *
 * Shared by the generator in tools/ and the app at runtime, so a clip written
 * on a laptop is the one the iPad looks for. If these two ever disagreed the
 * app would silently fall back to the robot voice for everything, which is
 * exactly the kind of failure nobody notices — hence one function, used twice.
 *
 * FNV-1a, because it needs to be identical in Node and the browser with no
 * dependency and no crypto API. Collisions do not matter much here: the worst
 * case is one word playing another word's clip, and 32 bits across ~1,500
 * strings makes that unlikely enough that the content test can simply check
 * there are none. */

/** what we speak, reduced to what we key on: case and edge whitespace go */
export const speakable = (text: string): string => text.toLowerCase().trim();

export function clipId(text: string): string {
  const s = speakable(text);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    /* the FNV prime, via shifts so it stays in 32 bits in both runtimes */
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
