import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/unit/**/*.test.ts'],
    exclude: ['test/e2e/**', 'node_modules/**', 'out/**']
  }
})
