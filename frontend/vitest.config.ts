import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const nodeMajorVersion = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10)

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_BUILD_COMMIT__: JSON.stringify('test'),
    __APP_BUILD_TIME__: JSON.stringify('2026-01-01T00:00:00.000Z'),
  },
  test: {
    execArgv: nodeMajorVersion >= 25 ? ['--no-experimental-webstorage'] : [],
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    restoreMocks: true,
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
})
