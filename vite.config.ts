import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/classpilot/' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: [],
      manifest: {
        name: 'ClassPilot 班级座位助手',
        short_name: 'ClassPilot',
        description: '离线优先的班级座位管理工具',
        theme_color: '#285378',
        background_color: '#f3f6fa',
        display: 'standalone',
        lang: 'zh-CN',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,ico}'],
      },
    }),
  ],
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
})
