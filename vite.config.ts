/* vitest's defineConfig is vite's with the `test` block typed as well */
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';
import { launchLinks } from './tools/launch.ts';

/**
 * The rule "nothing leaves the device" made a promise the browser keeps.
 *
 * The tests already fail on any request to another origin, but only for what
 * they exercise; this tells the browser itself to refuse one, whatever the
 * code does. Everything — scripts, styles, fonts, pictures, sound — comes from
 * the app's own origin. The exceptions are deliberate: recorded takes play
 * from blob: URLs (Be the Commentator), and styles set from script count as
 * inline. Added at build only, since the dev server injects inline scripts
 * of its own.
 */
const POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "media-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

const contentSecurityPolicy = {
  name: 'content-security-policy',
  apply: 'build' as const,
  transformIndexHtml: (html: string): string =>
    html.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n  <meta http-equiv="Content-Security-Policy" content="${POLICY}">`),
};

/** the launch images (tools/launch.ts), linked from index.html for iOS to find */
const launchImages = {
  name: 'launch-images',
  transformIndexHtml: (html: string): string => html.replace('<!-- launch images -->', launchLinks()),
};

export default defineConfig({
  /* relative, so the same build works from a domain root, a GitHub Pages
     project path or a folder on a USB stick */
  base: './',
  plugins: [
    contentSecurityPolicy,
    launchImages,
    VitePWA({
      /* the iPad keeps the old version until the app is reopened, sometimes
         twice, so a new one says so and waits for a tap (src/lib/update.ts) */
      registerType: 'prompt',
      includeAssets: ['icons/favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Futebol de Botão',
        short_name: 'Botão',
        description: 'Brazilian table football: flick your buttons, three touches to score. No accounts, no tracking, works offline.',
        lang: 'en-AU',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0E3A32',
        theme_color: '#0E3A32',
        categories: ['games', 'kids'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        /* everything the app is, including the fonts — it has to work in the
           car with no signal, and it never asks the network for anything else */
        globPatterns: ['**/*.{js,css,html,woff2,png,webp,svg,webmanifest,json,mp3}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  test: { include: ['tests/**/*.spec.ts'], environment: 'node' },
});
