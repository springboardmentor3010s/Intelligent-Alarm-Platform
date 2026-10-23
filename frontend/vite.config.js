import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:8000', changeOrigin: false, rewrite: (p) => p.replace(/^\/api/, '') } },
  },
  build: { chunkSizeWarningLimit: 900 },
  test: { environment: 'jsdom', setupFiles: ['./src/test-setup.js'], globals: true, testTimeout: 20000 },
})
