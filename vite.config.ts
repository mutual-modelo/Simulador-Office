import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      {
        name: 'dedupe-static-manifest-for-vite-pwa',
        transformIndexHtml: {
          order: 'pre',
          handler(html) {
            return html.replace(/<link\s+rel=["']manifest["'][^>]*>\s*/gi, '');
          },
        },
      },
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: false,
        manifestFilename: 'manifest.webmanifest',
        includeAssets: [
          'logo-icono.png',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: './index.html',
          name: 'Mutual Modelo — Ecosistema AMMER',
          short_name: 'AMMER Mutual',
          description:
            'Plataforma oficial de Mutual Modelo de Entre Ríos: Simulador de Ayudas Económicas, Auditoría IA, Firmas AMMER y Padrón Digital.',
          start_url: './index.html',
          scope: './',
          display: 'standalone',
          display_override: ['standalone', 'minimal-ui'],
          orientation: 'any',
          lang: 'es-AR',
          theme_color: '#0f2744',
          background_color: '#0f2744',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
