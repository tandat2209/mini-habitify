import { defineConfig, devices } from "@playwright/test";
const port = process.env.PLAYWRIGHT_PORT ?? "3000";
const origin = `http://localhost:${port}`;
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  use: { baseURL: origin, trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "iphone-webkit",
      testMatch: "pwa.spec.ts",
      use: { ...devices["iPhone 13"] },
    },
  ],
  webServer: {
    command: process.env.PLAYWRIGHT_USE_PRODUCTION
      ? `npm run start -- --port ${port}`
      : `npm run dev -- --port ${port}`,
    url: origin,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
