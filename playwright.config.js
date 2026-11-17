import { defineConfig } from "@playwright/test";

const port = process.env.PORT || 4173;
const baseURL = `http://127.0.0.1:${port}/crest-chord-builder/`;

export default defineConfig({
  testDir: "./test/browser",
  timeout: 30000,
  workers: 1,
  use: {
    channel: "chrome",
    headless: true,
    baseURL,
    viewport: { width: 1920, height: 1080 },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm start",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
