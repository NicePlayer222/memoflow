import { defineConfig } from '@playwright/test'

const baseURL = 'http://127.0.0.1:4179'

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL,
    channel: process.platform === 'win32' ? 'msedge' : undefined,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
  webServer: [{
    command: 'npm run preview -- --host 127.0.0.1 --port 4179 --strictPort',
    url: baseURL,
    reuseExistingServer: false,
  }, {
    // Both read-only previews serve the same dist on separate loopback ports.
    command: 'npm run preview -- --host 127.0.0.1 --port 4180 --strictPort --base /projects/memoflow/ --bypass-lock',
    url: 'http://127.0.0.1:4180/projects/memoflow/',
    reuseExistingServer: false,
  }],
})
