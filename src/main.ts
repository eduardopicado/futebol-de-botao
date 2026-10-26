import './styles/app.css';

import { startRouter, type Route } from './lib/router';
import { unlockSpeech, watchVoices } from './lib/speech';
import { loadClips, unlockClips } from './lib/audio';
import { setSfxEnabled, unlockSfx, wakeSfx } from './lib/sfx';
import { watchForUpdates } from './lib/update';
import { soundsOn } from './game/choices';
import * as home from './game/home';
import { mountScene } from './game/scene';

const routes: Route[] = [
  { path: 'home', mount: home.mount },
  { path: 'treino', title: 'Treino', load: () => import('./game/treino') },
  { path: 'goleiro', title: 'Treino: goleiro', load: () => import('./game/goleiro') },
  { path: 'partida', title: 'Partida', load: () => import('./game/partida') },
  { path: 'computador', title: 'Partida', load: () => import('./game/partida').then((g) => ({ mount: g.mountComputer })) },
  /* picking the teams before a match */
  { path: 'teams-1', title: '1 player', load: () => import('./game/pick').then((g) => ({ mount: g.mountOne })) },
  { path: 'teams-2', title: '2 players', load: () => import('./game/pick').then((g) => ({ mount: g.mountTwo })) },
  { path: 'settings', title: 'Settings', load: () => import('./game/settings') },
];

/* iOS keeps speech and audio locked until they are started inside a real
   gesture, so the very first tap anywhere unlocks the device voice and the
   sound effects. */
function unlockOnFirstTap(): void {
  const once = () => {
    unlockSpeech();
    unlockSfx();
    document.removeEventListener('pointerdown', once);
    document.removeEventListener('keydown', once);
  };
  document.addEventListener('pointerdown', once);
  document.addEventListener('keydown', once);
  /* Safari may count a touch as a tap only when the finger lifts, so the
     recordings and the sound effects are woken then too, and on every tap:
     iOS silences sound again whenever the iPad sleeps or the app is left
     and reopened. Both are cheap to ask */
  for (const type of ['pointerdown', 'pointerup', 'keydown']) document.addEventListener(type, unlockClips);
  document.addEventListener('pointerdown', wakeSfx);
  document.addEventListener('pointerup', wakeSfx);
}

setSfxEnabled(soundsOn());
watchVoices();
/* recorded lines if this build shipped any; harmless and silent if not */
void loadClips();
unlockOnFirstTap();
watchForUpdates();

mountScene();

const app = document.querySelector<HTMLElement>('main#app');
if (app) startRouter(app, routes);
