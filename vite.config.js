import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Ferretería POS',
        short_name: 'FerrePOS',
        description: 'Sistema de punto de venta para ferretería',
        theme_color: '#1e40af',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        start_url: '/pos',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Never cache GAS API calls — always network-only
            urlPattern: /^https:\/\/script\.google\.com\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
});
