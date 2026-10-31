import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test/browser",
  timeout: 30000,
  workers: 1,
  use: {
    channel: "chrome",
    headless: true,
    baseURL: "http://127.0.0.1:4173/crest-chord-builder/",
    viewport: { width: 1920, height: 1080 },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm start",
    url: "http://127.0.0.1:4173/crest-chord-builder/",
    reuseExistingServer: !process.env.CI,
  },
});
