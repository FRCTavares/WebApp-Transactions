import path from 'node:path'
import { defineConfig, devices } from '@playwright/test'

const backendPort = process.env.E2E_BACKEND_PORT ?? '8000'
const frontendPort = process.env.E2E_FRONTEND_PORT ?? '4173'
const backendUrl = `http://127.0.0.1:${backendPort}`
const frontendUrl = `http://127.0.0.1:${frontendPort}`

try {
  process.loadEnvFile(path.join(import.meta.dirname, 'e2e/.env.e2e.local'))
} catch {
  // In CI, these are provided as real environment variables instead.
}

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: frontendUrl,
    storageState: './e2e/.auth/session.json',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'seed',
      testMatch: /seed\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, dependencies: ['seed'] },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] }, dependencies: ['seed'] },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, dependencies: ['seed'] },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, dependencies: ['seed'] },
    { name: 'mobile-webkit', use: { ...devices['iPhone 14'] }, dependencies: ['seed'] },
  ],
  webServer: [
    {
      command: `../backend/scripts/start_e2e_backend.sh ${backendPort}`,
      url: `${backendUrl}/api/health`,
      reuseExistingServer: false,
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${frontendPort}`,
      url: frontendUrl,
      reuseExistingServer: false,
      env: {
        NODE_ENV: 'development',
        VITE_API_BASE_URL: backendUrl,
        VITE_SUPABASE_AUTH_ENABLED: 'true',
        VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? '',
        VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ?? '',
      },
    },
  ],
})
