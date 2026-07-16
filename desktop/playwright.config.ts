import { defineConfig } from 'playwright/test'

export default defineConfig({
  testDir: './test/e2e',
  timeout: 20_000,
  workers: 1,
  fullyParallel: false,
  reporter: 'list',
  use: {
    trace: 'on-first-retry'
  }
})
