/* Team crests, added by a grown-up from the iPad's own pictures.
 *
 * The app never ships a club's crest: it is the club's trademark, so clubs
 * come as their colours (src/games/teams.ts). A grown-up can put one on this
 * iPad for the family's own use. The picture is cut to the biggest square in
 * its middle, made small, and kept in localStorage with the other settings,
 * so nothing leaves the device. A game shows it cut to a circle, like the
 * sticker on a real botão. */

import { read, write } from './storage';

const KEY = 'crests';
/** pixels across: sharp on a button on an iPad screen, and small to keep */
export const CREST_SIZE = 128;

/** the biggest square in the middle of a picture this size */
export function squareCrop(width: number, height: number): { sx: number; sy: number; side: number } {
  const side = Math.min(width, height);
  return { sx: (width - side) / 2, sy: (height - side) / 2, side };
}

/** a picture the app made itself, and nothing else: it is put into the page */
const isCrest = (v: unknown): v is string => typeof v === 'string' && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(v);

/** every crest kept, leaving out anything saved that is not one */
function all(): Record<string, string> {
  const saved = read<Record<string, unknown>>(KEY, {});
  return Object.fromEntries(Object.entries(saved).filter((e): e is [string, string] => isCrest(e[1])));
}

/** the crest a grown-up added for this team, or null */
export const crestOf = (team: string): string | null => all()[team] ?? null;

/** keep a crest for this team; false when it is not a crest or this device
    would not keep it (a full or blocked localStorage) */
export function setCrest(team: string, crest: string): boolean {
  if (!isCrest(crest)) return false;
  write(KEY, { ...all(), [team]: crest });
  return crestOf(team) === crest;
}

export function clearCrest(team: string): void {
  write(KEY, Object.fromEntries(Object.entries(all()).filter(([id]) => id !== team)));
}

/** a picture chosen from the iPad, as a crest: the middle square, CREST_SIZE
    across, as a PNG so a logo keeps its see-through background */
export async function crestFromFile(file: Blob): Promise<string> {
  const picture = await decode(file);
  const { sx, sy, side } = squareCrop(picture.width, picture.height);
  const canvas = document.createElement('canvas');
  canvas.width = CREST_SIZE;
  canvas.height = CREST_SIZE;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('This device cannot draw the picture.');
  g.imageSmoothingQuality = 'high';
  g.drawImage(picture, sx, sy, side, side, 0, 0, CREST_SIZE, CREST_SIZE);
  return canvas.toDataURL('image/png');
}

/** the picture's pixels: createImageBitmap where there is one, an image element otherwise */
async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file); } catch { /* the old way below */ }
  }
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const img = new Image();
  img.src = url;
  await img.decode();
  return img;
}
