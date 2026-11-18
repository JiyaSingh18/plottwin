import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages serves the app from /plottwin/, Vercel serves it from the root.
const base = process.env.VITE_BASE ?? (process.env.VERCEL ? '/' : '/plottwin/')

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  build: { chunkSizeWarningLimit: 2500 },
})
