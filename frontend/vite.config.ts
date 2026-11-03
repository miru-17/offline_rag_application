import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// The app always calls the API on its own address under /api, so the session
// cookie stays first-party. In development the Vite server forwards /api:
//   default                    -> https://localhost:8443/api (the Docker web server)
//   RAGENTIS_DEV_BACKEND=http://127.0.0.1:8000 -> a backend started with uvicorn
export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), '') }
  const backend = env.RAGENTIS_DEV_BACKEND
  const proxy = backend
    ? { target: backend, changeOrigin: true, rewrite: (path: string) => path.replace(/^\/api/, '') }
    : { target: 'https://localhost:8443', changeOrigin: true, secure: false }

  return {
    plugins: [react()],
    server: { proxy: { '/api': proxy } },
    preview: { proxy: { '/api': proxy } },
  }
})
