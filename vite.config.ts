import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// Tauri sets TAURI_ENV_PLATFORM for its pre-build command, including on GitHub Actions.
// Pages alone needs the repository subpath; desktop bundles must always use root-relative assets.
const isTauriBuild = Boolean(process.env.TAURI_ENV_PLATFORM)
const basePath = process.env.GITHUB_ACTIONS && !isTauriBuild ? '/classpilot/' : '/'
const pwaPlugins = isTauriBuild ? [] : [VitePWA({
  registerType: 'autoUpdate',
  injectRegister: 'auto',
  includeAssets: ['favicon.svg', 'icons/*.png'],
  manifest: {
    id: './',
    name: 'ClassPilot 班级座位助手',
    short_name: 'ClassPilot',
    description: '离线优先的班级座位管理工具',
    theme_color: '#285378',
    background_color: '#f3f6fa',
    display: 'standalone',
    lang: 'zh-CN',
    start_url: './',
    scope: './',
    icons: [
      { src: 'icons/192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icons/512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'icons/512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    cleanupOutdatedCaches: true,
    clientsClaim: true,
    skipWaiting: true,
    globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico,webmanifest}'],
    navigateFallbackDenylist: [/^\/api\//],
  },
})]

export default defineConfig({
  base: basePath,
  define: { __CLASSPILOT_TAURI__: JSON.stringify(isTauriBuild) },
  plugins: [
    react(),
    ...pwaPlugins,
  ],
  test: {
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'tests/unit/**/*.{test,spec}.{ts,tsx}',
      'tests/contracts/**/*.{test,spec}.{ts,tsx}',
    ],
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
})
