import { defineConfig, devices } from '@playwright/test';

// E2E tests run against the live production deployment by default.
// Override with: BASE_URL=http://localhost:3000 npx playwright test
const BASE_URL = process.env.BASE_URL ?? 'https://civiclens-jet.vercel.app';

// VM egress goes through an authenticated proxy whose password breaks Chromium's
// URL parsing. Use the local CONNECT forwarder (~/workspace/bin/egress-forwarder.py,
// must be running on 127.0.0.1:8888) which injects Proxy-Authorization upstream.
function egressProxy() {
  return { server: 'http://127.0.0.1:8888' };
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 1,
  timeout: 60_000,
  use: {
    baseURL: BASE_URL,
    proxy: egressProxy(),
    // Proxy MITMs TLS; the test browser must ignore cert errors.
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: undefined, // tests target a running deployment, not a local server
});
