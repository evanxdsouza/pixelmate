import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt'],
      manifest: {
        name: 'PixelMate',
        short_name: 'PixelMate',
        description: 'AI agent that works in your browser and local files',
        theme_color: '#4f46e5',
        background_color: '#0f0f14',
        // ChromeOS: prefer Window Controls Overlay for a native-feeling title bar
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
        // Support all orientations (laptop, tablet, convertible modes)
        orientation: 'any',
        // Re-use the existing window instead of opening a new tab on re-launch
        launch_handler: { client_mode: 'navigate-existing' },
        categories: ['productivity', 'utilities'],
        // Shelf / launcher right-click shortcuts (ChromeOS)
        shortcuts: [
          {
            name: 'New Chat',
            short_name: 'New Chat',
            description: 'Start a new AI chat session',
            url: '/?action=new-chat',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Open Files',
            short_name: 'Files',
            description: 'Browse workspace files',
            url: '/?view=files',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }],
          },
        ],
        // Allow the Files app to open .txt and .md files with PixelMate
        file_handlers: [
          {
            action: '/',
            accept: {
              'text/plain': ['.txt'],
              'text/markdown': ['.md'],
            },
          },
        ],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    port: 3000,
    headers: {
      // Prevent MIME-type sniffing
      'X-Content-Type-Options': 'nosniff',
      // Disallow framing by any origin (clickjacking)
      'X-Frame-Options': 'DENY',
      // Only send origin in Referer header (privacy)
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      // Restrict powerful browser features
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
      // Content-Security-Policy: allow only same-origin scripts/styles;
      // chrome-extension: needed for the PWA to communicate with the extension.
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'wasm-unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",   // unsafe-inline needed for Vite HMR + inline styles
        "img-src 'self' data: blob:",
        "connect-src 'self' chrome-extension: wss:",
        "worker-src 'self' blob:",
        "frame-ancestors 'none'",
      ].join('; '),
    },
  },
});
