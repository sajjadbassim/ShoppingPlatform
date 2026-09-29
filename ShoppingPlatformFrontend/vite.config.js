import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
      '/api': 'http://localhost:5010',
      '/uploads': 'http://localhost:5010',
      '/hubs': { target: 'http://localhost:5010', ws: true },
    },
  },
})
