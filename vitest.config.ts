import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  plugins: [cloudflareTest(async () => ({
    wrangler: { configPath: './wrangler.jsonc' },
    miniflare: {
      d1Databases: { DB: 'digitalni-cjenik-nepar' },
      bindings: { TEST_MIGRATIONS: await readD1Migrations(path.resolve(process.cwd(), 'migrations')) },
    },
  }))],
  test: {
    // Each spec starts a workerd/D1 runtime. Bound parallelism on developer machines and CI.
    maxWorkers: 2,
    setupFiles: ['./test/apply-migrations.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
  },
})
