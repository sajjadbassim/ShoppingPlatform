import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // التحديث يتم بعد موافقة المستخدم (انظر PWAPrompt)
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'منصة واسط التجارية',
        short_name: 'واسط',
        description: 'منصة واسط التجارية - تسوق إلكتروني متكامل',
        lang: 'ar',
        dir: 'rtl',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#4F46E5',
        background_color: '#FFFFFF',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // صفحات الإدارة والبائع والعمليات لا تُنزَّل مسبقاً لكل الزوار — تُحمَّل عند فتحها فقط
        globIgnores: ['**/assets/Admin*.js', '**/assets/Vendor*.js', '**/assets/Operations*.js'],
        // الـ bundle الرئيسي أكبر من الحد الافتراضي (2MB)
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: '/index.html',
        // لا نعيد index.html لطلبات الباك
        navigateFallbackDenylist: [/^\/api/, /^\/uploads/, /^\/hubs/, /^\/swagger/],
        cleanupOutdatedCaches: true,
        // معالج إشعارات الدفع (public/push-sw.js)
        importScripts: ['push-sw.js'],
        runtimeCaching: [
          {
            // صور المنتجات والمتاجر
            urlPattern: ({ url }) => url.pathname.startsWith('/uploads/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'uploads-images',
              expiration: { maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // بيانات عامة للعرض فقط عند انقطاع الاتصال (الشبكة أولاً)
            urlPattern: ({ url, request }) =>
              request.method === 'GET' &&
              /^\/api\/(products|categories|home|vendors)(\/|$|\?)/i.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-public',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 200, maxAgeSeconds: 24 * 60 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
      // مفعّل أثناء التطوير أيضاً لأن الهاتف يفتح الموقع من خادم التطوير عبر Tailscale،
      // وبدون manifest لا يُثبَّت كتطبيق حقيقي ويفتح كصفحة متصفح عادية
      devOptions: {
        enabled: true,
        // classic: الـ Service Worker من نوع module لا يسمح بـ importScripts (معالج الإشعارات)
        type: 'classic',
        navigateFallback: 'index.html',
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // المكتبات في ملفات مستقلة تبقى في ذاكرة المتصفح بين التحديثات
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query', 'axios', 'zustand'],
          signalr: ['@microsoft/signalr'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@styles': path.resolve(__dirname, './src/styles'),
      '@assets': path.resolve(__dirname, './src/assets'),
    },
  },
  server: {
    // IPv4 صراحةً لأن Tailscale يمرّر الطلبات إلى 127.0.0.1
    host: '127.0.0.1',
    port: 3000,
    open: true,
    // السماح بالوصول عبر عنوان Tailscale (*.ts.net)
    allowedHosts: ['.ts.net'],
    // تمرير طلبات الـ API والصور و SignalR إلى الباك، ليعمل الموقع كله من منفذ واحد
    proxy: {
      // xfwd: يمرّر عنوان الجهاز الحقيقي للخادم (حدود المحاولات لكل جهاز)
      '/api': { target: 'http://localhost:5010', xfwd: true },
      '/uploads': 'http://localhost:5010',
      '/hubs': { target: 'http://localhost:5010', ws: true, xfwd: true },
    },
  },
})
