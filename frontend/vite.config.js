import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,

    https: {
      key: fs.readFileSync(path.resolve(__dirname, 'localhost-1-key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, 'localhost-1.pem')),
    },

    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'https://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
