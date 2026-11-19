import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Skip the PWA machinery when running unit tests.
      disable: Boolean(process.env.VITEST),

      /**
       * "autoUpdate": when a new version is deployed, the app downloads it in the
       * background and switches to it on the next load. The match is saved in
       * localStorage on every tap, so that reload never loses a score.
       */
      registerType: 'autoUpdate',

      // Files from /public that the service worker should also keep for offline use.
      includeAssets: ['icon.svg', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'],

      // This becomes manifest.webmanifest, which is what makes "Add to Home Screen" work.
      manifest: {
        id: '/',
        name: 'Padel Scorer',
        short_name: 'Padel Scorer',
        description: 'Simple score keeping for padel. Big buttons, undo, and it works offline.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0d1117',
        theme_color: '#0d1117',
        categories: ['sports'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // Same artwork, drawn inside the safe zone so Android can crop it to a circle.
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },

      workbox: {
        // Cache every built file (code, styles, icons, the hero photo) so the app opens with no signal.
        globPatterns: ['**/*.{js,css,html,svg,png,webp,ico,webmanifest}'],
        // Note: .jpg is not in this list on purpose. The link-preview image (og-image.jpg) is only
        // for other people's chat apps, so there is no reason to store it on every phone.
        // It is a single-page app: any address should open index.html from the cache.
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
