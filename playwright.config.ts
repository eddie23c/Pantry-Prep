import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against the production build, on a phone-sized Chromium.
// Set PW_CHROMIUM to use an already-installed browser instead of Playwright's download.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: "http://localhost:4173/",
    trace: "off",
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  projects: [{ name: "phone", use: { ...devices["Pixel 7"], locale: "en-GB", timezoneId: "Europe/London" } }],
  webServer: {
    // Built with a pretend scan worker address; the tests answer its requests themselves.
    command: "VITE_SCAN_URL=https://scan.test npm run build && npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
