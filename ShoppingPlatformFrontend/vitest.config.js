import { defineConfig } from 'vitest/config'
import path from 'path'

// إعداد منفصل عن vite.config.js حتى لا تعمل إضافة PWA أثناء الاختبارات
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: { environment: 'node', include: ['src/**/*.test.{js,jsx}'] },
})
