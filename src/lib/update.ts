/* A new version, said out loud.
 *
 * Added to the home screen, the iPad keeps running the version it has until
 * the app is closed and opened again, sometimes twice. So the offline worker
 * looks for a new version when the app opens, when it comes back to the
 * front, and every hour, and when there is one a button says so; a tap
 * swaps it in and reloads. Nothing is swapped mid-game without the tap. */

import { registerSW } from 'virtual:pwa-register';
import { el } from './dom';

const HOUR = 60 * 60 * 1000;

export function watchForUpdates(): void {
  try {
    const update = registerSW({
      onNeedRefresh() {
        if (document.querySelector('.update')) return;
        const button = el('button', { class: 'btn update', type: 'button', text: '✨ New version! Tap to update' });
        button.addEventListener('click', () => { button.disabled = true; void update(true); });
        document.body.append(button);
      },
      onRegisteredSW(_url, registration) {
        if (!registration) return;
        const check = (): void => { registration.update().catch(() => undefined); };
        window.setInterval(check, HOUR);
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
      },
    });
  } catch {
    /* no offline worker here: the app still works, it just does not update itself */
  }
}
