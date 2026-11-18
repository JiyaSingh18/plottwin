import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages serves the app from /plottwin/
export default defineConfig({
  base: process.env.VITE_BASE ?? '/plottwin/',
  plugins: [react(), tailwindcss()],
  build: { chunkSizeWarningLimit: 2500 },
})
