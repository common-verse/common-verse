import { defineConfig, devices } from "@playwright/test";

const cmsPort = process.env.PLAYWRIGHT_CMS_PORT ?? "3001";
const webPort = process.env.PLAYWRIGHT_WEB_PORT ?? "4321";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${webPort}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.CI
    ? undefined
    : [
        {
          command: "node tests/fixtures/mock-cms.mjs",
          url: `http://127.0.0.1:${cmsPort}/health`,
          reuseExistingServer: false,
          env: {
            MOCK_CMS_PORT: cmsPort,
            MOCK_WEB_ORIGIN: `http://127.0.0.1:${webPort}`,
          },
        },
        {
          command:
            "pnpm --filter @poetry/web build && node tests/fixtures/serve-web.mjs",
          url: `http://127.0.0.1:${webPort}/`,
          reuseExistingServer: false,
          env: {
            // Build and runtime use different values to detect embedded secrets.
            PREVIEW_SECRET: "build-preview",
            PLAYWRIGHT_PREVIEW_SECRET: "test-preview",
            PUBLIC_CMS_URL: `http://127.0.0.1:${cmsPort}`,
            PUBLIC_SITE_URL: `http://127.0.0.1:${webPort}`,
            PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_playwright",
            HOST: "127.0.0.1",
            PORT: webPort,
          },
        },
      ],
});
