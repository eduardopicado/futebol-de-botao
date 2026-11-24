/* Game controllers: a DualSense, an 8BitDo, an Xbox pad, anything the iPad
 * pairs over Bluetooth. Safari shows them through the Gamepad API, in its
 * standard mapping, and only once a button has been pressed; they are read
 * sixty times a second while one is connected.
 *
 * Buttons are named by where they sit, not by what is printed on them: the
 * bottom face button is ✕ on a DualSense, A on an Xbox pad and B on an
 * 8BitDo, and it is `south` to all three.
 *
 * A screen with a table hands it the controller (board.ts, through usePad)
 * while there is something on it to flick or a goleiro to slide. Otherwise
 * the controller moves through the screen's buttons: the d-pad or the stick
 * from one to the next nearest that way, south presses it, east goes back.
 * Start (Options, +, ☰) always goes back.
 *
 * Sound still needs a tap on the screen: iOS lets it start only inside a
 * touch, and a controller's press is not one. */

export interface Point { x: number; y: number }

export const BUTTONS = {
  south: 0, east: 1, west: 2, north: 3, l1: 4, r1: 5, l2: 6, r2: 7,
  select: 8, start: 9, l3: 10, r3: 11, up: 12, down: 13, left: 14, right: 15,
} as const;
export type PadButton = keyof typeof BUTTONS;
const NAMES = Object.keys(BUTTONS) as PadButton[];

/** the d-pad held down repeats, after this long, this often */
const REPEAT_AFTER = 380;
const REPEAT_EVERY = 140;
/** a stick this little off the middle is the middle */
export const DEAD = 0.22;

export interface PadFrame {
  /** the left stick, and the right, past the dead zone: 0 to 1 each way, up
      negative (with two controllers, whichever is pushed further) */
  stick: Point;
  fine: Point;
  /** each controller's left stick on its own */
  sticks: Point[];
  /** seconds since the last frame */
  dt: number;
  /** now, in ms */
  now: number;
}

export interface PadHandler {
  /** does it want the controller now? If not, the screen's buttons get it */
  claims: () => boolean;
  /** a press while it claims; false leaves it to the screen's buttons */
  press: (b: PadButton) => boolean;
  frame: (f: PadFrame) => void;
  /** it claimed the controller and no longer does */
  release?: () => void;
  /** true: east never goes back on this screen (a match: east cancels an aim) */
  keepsBack?: () => boolean;
}

/** a stick read with a round dead zone, the rest stretched to 0 to 1 */
export function deadZone(x: number, y: number, dead = DEAD): Point {
  const m = Math.sqrt(x * x + y * y);
  if (m <= dead) return { x: 0, y: 0 };
  const k = Math.min(1, (m - dead) / (1 - dead)) / m;
  return { x: x * k, y: y * k };
}

export interface Sample { t: number; x: number; y: number }

/** where an aim was before the stick sprang back to the middle: let go, a
    stick flies home in a few frames, each reading well under the one before,
    so the aim is the reading just before that fall began. Easing it back
    slowly is a weaker aim, and kept. A reading under `ratio` of the one
    before it, read no more than `gap` ms apart (a busy device reads less
    often), is the spring; only the last `window` ms are looked at */
export function latch(samples: Sample[], ratio = 0.75, gap = 250, window = 400): Point | null {
  if (!samples.length) return null;
  let i = samples.length - 1;
  const end = samples[i]!.t;
  const size = (s: Sample): number => Math.sqrt(s.x * s.x + s.y * s.y);
  while (i > 0) {
    const [a, b] = [samples[i - 1]!, samples[i]!];
    if (end - a.t > window || b.t - a.t > gap || size(b) >= size(a) * ratio) break;
    i--;
  }
  const s = samples[i]!;
  return { x: s.x, y: s.y };
}

/** the nearest of `to` from `from` the way `dir` points (screen units, y
    down), or -1 for none that way: straight on counts more than off to the side */
export function towards(from: Point, dir: Point, to: (Point | null)[]): number {
  let best = -1;
  let score = Infinity;
  to.forEach((p, i) => {
    if (!p) return;
    const [dx, dy] = [p.x - from.x, p.y - from.y];
    const along = dx * dir.x + dy * dir.y;
    if (along <= 1) return;
    const across = Math.abs(dx * dir.y - dy * dir.x);
    const s = along + across * 2.5;
    if (s < score) { score = s; best = i; }
  });
  return best;
}

/* ── the controllers, read ─────────────────────────────────────────────── */

const handlers: { h: PadHandler; alive: () => boolean; claimed: boolean }[] = [];
let used = false;

/** a screen's table takes the controller while it claims it, until `alive` is false */
export function usePad(h: PadHandler, alive: () => boolean): void {
  handlers.push({ h, alive, claimed: false });
}

/** has a controller been used since the last touch? (only then is a button shown picked) */
export function padInUse(): boolean {
  return used;
}

const DIRS: Partial<Record<PadButton, Point>> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

/** what the controller can press on the screen: what is shown and enabled,
    but the ← (east or Start goes back) */
function pressable(): HTMLElement[] {
  const all = Array.from(document.querySelectorAll<HTMLElement>('button, a[href], input:not([type=hidden]), select, [tabindex]:not([tabindex="-1"])'));
  return all.filter((e) => !(e as HTMLButtonElement).disabled && e.getClientRects().length > 0 && !isBack(e) && getComputedStyle(e).visibility !== 'hidden');
}
const isBack = (e: Element): boolean => e.classList.contains('icon-btn') && e.textContent?.trim() === '←';
const middle = (e: Element): Point => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };

/** the button the controller last moved to: south presses only that one,
    never one that kept the focus after a tap */
let mine: HTMLElement | null = null;
const focus = (e: HTMLElement): void => { e.focus(); mine = e; };

/** the screen's buttons: the next one the way the d-pad points */
function moveFocus(dir: Point): void {
  const list = pressable();
  if (!list.length) return;
  const now = document.activeElement as HTMLElement | null;
  if (!now || now !== mine || !list.includes(now)) { focus(list[0]!); return; }
  const i = towards(middle(now), dir, list.map((e) => (e === now ? null : middle(e))));
  if (i >= 0) focus(list[i]!);
}

/** L1: the screen's buttons in turn, round and back to the first */
export function cycleFocus(): void {
  const list = pressable().filter((e) => !e.closest('.bt-table'));
  if (!list.length) return;
  const i = mine && mine === document.activeElement ? list.indexOf(mine) : -1;
  focus(list[(i + 1) % list.length]!);
}

/** the shown, enabled button that matches, pressed; false if there is none */
export function pressShown(selector: string): boolean {
  const b = Array.from(document.querySelectorAll<HTMLButtonElement>(selector)).find((e) => !e.disabled && e.getClientRects().length > 0);
  if (!b) return false;
  b.click();
  return true;
}

/** south on the button the controller moved to presses it */
export function pressFocused(): boolean {
  const now = document.activeElement as HTMLElement | null;
  if (!now || now !== mine || !pressable().includes(now)) return false;
  now.click();
  return true;
}

/** the screen's ←, pressed */
function back(): void {
  const b = Array.from(document.querySelectorAll<HTMLButtonElement>('button.icon-btn')).find((e) => isBack(e) && !e.disabled && e.getClientRects().length > 0);
  b?.click();
}

function live(): typeof handlers {
  for (let i = handlers.length - 1; i >= 0; i--) if (!handlers[i]!.alive()) handlers.splice(i, 1);
  return handlers;
}

/** the screens' tables asked again whether they want the controller (the
    first press is what puts it in use) */
function claimNow(): typeof handlers {
  const hs = live();
  for (const x of hs) {
    const claims = x.h.claims();
    if (x.claimed && !claims) x.h.release?.();
    x.claimed = claims;
  }
  return hs;
}

function press(b: PadButton): void {
  used = true;
  document.body.classList.add('pad-on');
  if (b === 'start') { back(); return; }
  const hs = claimNow();
  const top = hs.find((x) => x.claimed);
  if (top && top.h.press(b)) return;
  const dir = DIRS[b];
  if (dir) { moveFocus(dir); return; }
  if (b === 'south') { pressFocused(); return; }
  if (b === 'l1') { cycleFocus(); return; }
  if (b === 'east' && !hs.some((x) => x.h.keepsBack?.())) back();
}

/* ── the loop ──────────────────────────────────────────────────────────── */

interface Held { down: boolean; since: number; next: number }
const held = new Map<string, Held>();
let last = 0;
let running = false;
/** the stick standing in for the d-pad on the screen's buttons: which way it was last */
let stickWas: PadButton | null = null;

function readPads(): Gamepad[] {
  try {
    return Array.from(navigator.getGamepads?.() ?? []).filter((p): p is Gamepad => !!p && p.connected !== false);
  } catch {
    return [];
  }
}

/** read this often, in ms: the table's own frames (board.ts plays a flick
    on a 16 ms timer too). Not requestAnimationFrame, which a browser may run
    far less often than it draws: headless WebKit ran one frame in half a
    second, and a press came and went between two */
const EVERY = 16;

function tick(): void {
  const now = performance.now();
  const pads = readPads();
  if (!pads.length) { running = false; return; }
  const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
  last = now;
  let stick: Point = { x: 0, y: 0 };
  let fine: Point = { x: 0, y: 0 };
  const sticks: Point[] = [];
  const big = (p: Point): number => p.x * p.x + p.y * p.y;
  pads.forEach((pad, n) => {
    NAMES.forEach((name) => {
      const k = `${n}:${name}`;
      const down = !!pad.buttons[BUTTONS[name]]?.pressed;
      const was = held.get(k) ?? { down: false, since: 0, next: 0 };
      if (down && !was.down) { held.set(k, { down, since: now, next: now + REPEAT_AFTER }); press(name); return; }
      if (down && DIRS[name] && now >= was.next) { was.next = now + REPEAT_EVERY; press(name); }
      if (!down && was.down) held.set(k, { down, since: now, next: 0 });
    });
    const s = deadZone(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
    const f = deadZone(pad.axes[2] ?? 0, pad.axes[3] ?? 0);
    sticks.push(s);
    if (big(s) > big(stick)) stick = s;
    if (big(f) > big(fine)) fine = f;
  });
  if (big(stick) > 0 || big(fine) > 0) { used = true; document.body.classList.add('pad-on'); }
  const top = claimNow().find((x) => x.claimed);
  if (top) { stickWas = null; top.h.frame({ stick, fine, sticks, dt, now }); }
  else {
    /* no table wants it: the stick pushed well over moves through the buttons, as the d-pad does */
    const way: PadButton | null = big(stick) < 0.36 ? null : Math.abs(stick.x) > Math.abs(stick.y) ? (stick.x > 0 ? 'right' : 'left') : (stick.y > 0 ? 'down' : 'up');
    if (way && way !== stickWas) press(way);
    stickWas = way;
  }
  window.setTimeout(tick, EVERY);
}

function run(): void {
  if (running) return;
  running = true;
  last = 0;
  window.setTimeout(tick, 0);
}

/** start listening for controllers (once, as the app starts) */
export function startPads(): void {
  try {
    window.addEventListener('gamepadconnected', run);
    /* a touch takes over from the controller: nothing shown picked, no focus ring */
    document.addEventListener('pointerdown', () => { used = false; mine = null; document.body.classList.remove('pad-on'); }, true);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && readPads().length) run(); });
    if (readPads().length) run();
  } catch {
    /* no Gamepad API: touch only */
  }
}
