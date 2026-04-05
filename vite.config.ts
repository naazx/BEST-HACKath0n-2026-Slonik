import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      // Це виправить твою помилку 404
      '/api': {
        target: 'http://localhost:5064',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  resolve: {
    alias: {
      // Vite розуміє такий запис без модуля 'path'
      '@': '/src',
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
})