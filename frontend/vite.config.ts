import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

function getBuildCommit(): string {
  // Prefer the hosting platform's own git info over running git locally,
  // since a production build environment may not have full git history.
  const vercelSha = process.env.VERCEL_GIT_COMMIT_SHA
  const renderSha = process.env.RENDER_GIT_COMMIT

  if (vercelSha) {
    return vercelSha.slice(0, 7)
  }

  if (renderSha) {
    return renderSha.slice(0, 7)
  }

  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'unknown'
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_BUILD_COMMIT__: JSON.stringify(getBuildCommit()),
    __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
})
