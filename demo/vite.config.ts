import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The demo imports the library from source (`../../src/...`), which lives
// outside this directory — allow the dev server to serve the repo root.
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: ['..'],
    },
  },
})
