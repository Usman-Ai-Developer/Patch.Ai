def write_vite_config(frontend_dir):
    content = '''import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

console.log('[Vite] BACKEND_PORT:', process.env.BACKEND_PORT || 'not set, using 8000');

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${process.env.BACKEND_PORT || 8000}`,
        changeOrigin: true,
      },
    },
  },
})
'''
    (frontend_dir / "vite.config.js").write_text(content, encoding='utf-8')