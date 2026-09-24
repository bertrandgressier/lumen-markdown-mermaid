import { defineConfig } from 'vitest/config'

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    globals: true,
    include: ['tests/**/*.test.{ts,tsx}'],
  },
})
