import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    // Expose only this Vercel system value so preview builds can fail closed
    // when a staging API has not been configured.
    'import.meta.env.VERCEL_ENV': JSON.stringify(process.env.VERCEL_ENV || 'development')
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
