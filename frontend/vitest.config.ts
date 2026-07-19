import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_BUILD_COMMIT__: JSON.stringify('test'),
    __APP_BUILD_TIME__: JSON.stringify('2026-01-01T00:00:00.000Z'),
  },
  test: {
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    restoreMocks: true,
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
})
