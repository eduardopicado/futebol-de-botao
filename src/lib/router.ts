/* A hash router, so the app is one static file set that works from any path —
 * GitHub Pages, Netlify, a folder — with no server rewrite rules. */

import { cancelSpeech } from './speech';
import { hushSfx } from './sfx';

/** puts a screen into the page, and returns how to take it down again */
export type Mount = (root: HTMLElement) => (() => void) | void;

export type Route = {
  path: string;
  /** what the browser tab, the app switcher and a screen reader call it */
  title?: string;
} & (
  /** a screen that is part of the main bundle: the home screen */
  | { mount: Mount }
  /** a screen whose code is fetched the first time it is opened */
  | { load: () => Promise<{ mount: Mount }> }
);

const APP = 'Futebol de Botão';

let routes: Route[] = [];
let unmount: (() => void) | void;
let host: HTMLElement;
/** counts every navigation, so a game that finishes loading after he has
    already gone somewhere else is not put on screen */
let visit = 0;

const pathOf = (): string => (location.hash.replace(/^#\/?/, '') || 'home');

/** take the screen that is up down, and everything it started with it */
function leave(): void {
  try {
    unmount?.();
  } catch {
    /* a game that fails to clean up must not stop the next one opening */
  }
  unmount = undefined;
  /* a word being said as he leaves stops with the game that said it, and
     so does a crowd or a fanfare */
  cancelSpeech();
  hushSfx();
  host.replaceChildren();
  /* a win's confetti should not rain on the next game */
  for (const layer of document.querySelectorAll('.confetti')) layer.remove();
  host.scrollTop = 0;
  window.scrollTo(0, 0);
}

/**
 * What he sees when a screen will not open — a game that throws as it
 * starts, or one whose file could not be fetched — instead of a blank page
 * with no way back. The error still goes to the console, so a test or a
 * grown-up looking at the console sees it.
 */
function broken(path: string, error: unknown): void {
  console.error(`Could not open #/${path}:`, error);
  host.replaceChildren();
  const box = document.createElement('div');
  box.className = 'wrap route-error';
  const title = document.createElement('h1');
  title.textContent = 'Oops!';
  const what = document.createElement('p');
  what.className = 'tag';
  what.textContent = 'That game would not open. Try another one, and tell a grown-up.';
  const back = document.createElement('button');
  back.className = 'btn';
  back.type = 'button';
  back.textContent = 'Back to the games';
  back.addEventListener('click', () => go('home'));
  box.append(title, what, back);
  host.append(box);
}

async function render(): Promise<void> {
  const me = ++visit;
  const path = pathOf();
  const route = routes.find((r) => r.path === path) ?? routes[0];
  leave();
  document.body.dataset.route = route.path;
  document.title = route.title ? `${route.title} · ${APP}` : APP;
  let mount: Mount;
  try {
    mount = 'mount' in route ? route.mount : (await route.load()).mount;
  } catch (error) {
    if (me === visit) broken(route.path, error);
    return;
  }
  /* he went somewhere else while it was loading */
  if (me !== visit) return;
  try {
    unmount = mount(host);
  } catch (error) {
    broken(route.path, error);
  }
}

export function startRouter(root: HTMLElement, list: Route[]): void {
  host = root;
  routes = list;
  window.addEventListener('hashchange', () => { void render(); });
  void render();
}

export const go = (path: string): void => { location.hash = '#/' + path; };
