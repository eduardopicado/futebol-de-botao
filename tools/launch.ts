/* The launch images: what an iPad or iPhone shows between the tap on the
 * app's icon and the start screen.
 *
 * iOS only uses one made for the device's exact screen and the way it is
 * held, so there is one for each, portrait and landscape. Each is the start
 * screen itself with nothing to tap on it (the title, the tagline, the board
 * and the desk), so when the app has loaded only the buttons appear.
 * `npm run make:launch` renders them all from the built app into
 * public/launch/; the build puts a link to each in index.html. They are not
 * in the offline cache: iOS fetches the two for its own screen once, when the
 * app is added to the Home Screen. */

export interface Device {
  /** the screen in CSS points, held upright, and how many pixels a point is */
  w: number;
  h: number;
  dpr: number;
  /** the space iOS keeps clear at the top (status bar, notch) and at each
      side held sideways, as env(safe-area-inset-*): near enough, since a few
      points out only moves the title by as much */
  top: number;
  side: number;
  /** what has this screen, for whoever reads the list */
  is: string;
}

export const DEVICES: readonly Device[] = [
  /* iPads: the status bar, held either way */
  { w: 744, h: 1133, dpr: 2, top: 24, side: 0, is: 'iPad mini 6th and 7th' },
  { w: 810, h: 1080, dpr: 2, top: 20, side: 0, is: 'iPad 7th to 9th' },
  { w: 820, h: 1180, dpr: 2, top: 24, side: 0, is: 'iPad 10th and 11th, iPad Air 11"' },
  { w: 834, h: 1112, dpr: 2, top: 20, side: 0, is: 'iPad Air 3rd, iPad Pro 10.5"' },
  { w: 834, h: 1194, dpr: 2, top: 24, side: 0, is: 'iPad Pro 11" 1st to 4th' },
  { w: 834, h: 1210, dpr: 2, top: 24, side: 0, is: 'iPad Pro 11" M4 and M5' },
  { w: 1024, h: 1366, dpr: 2, top: 24, side: 0, is: 'iPad Pro 12.9", iPad Air 13"' },
  { w: 1032, h: 1376, dpr: 2, top: 24, side: 0, is: 'iPad Pro 13" M4 and M5' },
  /* iPhones: the status bar or the notch upright, the notch at a side held sideways */
  { w: 375, h: 667, dpr: 2, top: 20, side: 0, is: 'iPhone SE 2nd and 3rd, 8' },
  { w: 360, h: 780, dpr: 3, top: 50, side: 50, is: 'iPhone 12 and 13 mini' },
  { w: 375, h: 812, dpr: 3, top: 44, side: 44, is: 'iPhone X, XS, 11 Pro' },
  { w: 390, h: 844, dpr: 3, top: 47, side: 47, is: 'iPhone 12 to 14, 16e' },
  { w: 393, h: 852, dpr: 3, top: 59, side: 59, is: 'iPhone 14 Pro, 15, 15 Pro, 16' },
  { w: 402, h: 874, dpr: 3, top: 62, side: 62, is: 'iPhone 16 Pro, 17, 17 Pro' },
  { w: 414, h: 896, dpr: 2, top: 48, side: 48, is: 'iPhone XR, 11' },
  { w: 414, h: 896, dpr: 3, top: 44, side: 44, is: 'iPhone XS Max, 11 Pro Max' },
  { w: 420, h: 912, dpr: 3, top: 62, side: 62, is: 'iPhone Air' },
  { w: 428, h: 926, dpr: 3, top: 47, side: 47, is: 'iPhone 12 and 13 Pro Max, 14 Plus' },
  { w: 430, h: 932, dpr: 3, top: 59, side: 59, is: 'iPhone 14 Pro Max, 15 Plus and Pro Max, 16 Plus' },
  { w: 440, h: 956, dpr: 3, top: 62, side: 62, is: 'iPhone 16 Pro Max, 17 Pro Max' },
];

export type Orientation = 'portrait' | 'landscape';
export const ORIENTATIONS: readonly Orientation[] = ['portrait', 'landscape'];

/** the image's name in public/launch/ */
export const launchFile = (d: Device, o: Orientation): string => `launch/${d.w}x${d.h}@${d.dpr}-${o}.jpg`;

/** the screen as the image is made for it: held this way, in points and in pixels */
export function screenOf(d: Device, o: Orientation): { width: number; height: number; pixels: [number, number] } {
  const [width, height] = o === 'portrait' ? [d.w, d.h] : [d.h, d.w];
  return { width, height, pixels: [width * d.dpr, height * d.dpr] };
}

/** iOS keeps device-width and device-height upright whichever way the device is held */
export const mediaOf = (d: Device, o: Orientation): string =>
  `screen and (device-width: ${d.w}px) and (device-height: ${d.h}px) and (-webkit-device-pixel-ratio: ${d.dpr}) and (orientation: ${o})`;

/** the links for index.html, one per image */
export const launchLinks = (): string =>
  DEVICES.flatMap((d) => ORIENTATIONS.map((o) => `<link rel="apple-touch-startup-image" media="${mediaOf(d, o)}" href="./${launchFile(d, o)}">`)).join('\n  ');

/** where make:launch keeps what each image shows, for the launch test to compare */
export const DRAWN = 'tools/launch-drawn.json';

/**
 * What the start screen draws, and where: every visible thing on the board,
 * the desk and the title, as its box to the pixel, its words, its colours
 * and font, and the pictures it shows. Run in the page (so it uses nothing
 * from outside it). Unlike the pixels, which differ a little from one build
 * of Chromium to the next, this is the same wherever it is rendered, and it
 * changes when the screen does: a word, a colour, a picture, a move.
 */
export function drawn(): string[] {
  const out: string[] = [];
  const name = (url: string): string => url.replace(/^url\(["']?|["']?\)$/g, '').replace(/^.*\//, '');
  for (const e of document.querySelectorAll('.scene, .scene *, .app, .app *')) {
    const s = getComputedStyle(e);
    const box = e.getBoundingClientRect();
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0 || box.width === 0 || box.height === 0) continue;
    const words = [...e.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent?.trim()).filter(Boolean).join(' ');
    const pictures = [s.backgroundImage, e.getAttribute('href') ?? '', e.getAttribute('src') ?? '']
      .filter((p) => p && p !== 'none').map(name).join(' ');
    /* the words with their colour and font; a background only where there is one */
    const background = s.backgroundColor === 'rgba(0, 0, 0, 0)' ? '' : s.backgroundColor;
    out.push([
      `${e.tagName.toLowerCase()}${e.getAttribute('class') ? `.${e.getAttribute('class')!.trim().split(/\s+/).join('.')}` : ''}`,
      [box.x, box.y, box.width, box.height].map(Math.round).join(','),
      words ? `"${words}" ${s.color} ${s.fontFamily.split(',')[0]} ${s.fontWeight} ${s.fontSize}` : '',
      background, pictures,
    ].filter(Boolean).join(' | '));
  }
  return out;
}

/** the start screen made into a launch image: nothing to tap, and the space iOS keeps clear */
export function launchStyle(d: Device, o: Orientation): string {
  /* an iPad keeps its status bar held sideways; an iPhone hides it, and its notch goes to the side */
  const iPad = d.w >= 744;
  const [top, side] = o === 'portrait' ? [d.top, 0] : [iPad ? d.top : 0, d.side];
  return `.modes, .settings-btn, .home-how, .update { visibility: hidden !important; }
    .app { padding-top: ${top + 12}px !important; padding-left: calc(${side}px + var(--gutter)) !important; padding-right: calc(${side}px + var(--gutter)) !important; }`;
}
