import { test as base, expect } from '@playwright/test'
import { startFixtureServer } from '../fixtures/server'

export const test = base.extend<{ fixturePort: number }>({
  fixturePort: async ({}, use) => {
    const server = await startFixtureServer(0)
    await use(server.port)
    await server.close()
  }
})

export { expect }
