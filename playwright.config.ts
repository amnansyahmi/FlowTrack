import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:3100",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    launchOptions: process.env.FLOWTRACK_BROWSER_PATH
      ? {
          executablePath: process.env.FLOWTRACK_BROWSER_PATH,
          args: [
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--use-gl=angle",
            "--use-angle=swiftshader",
          ],
        }
      : {},
  },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 3100 --strictPort",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 30000,
  },
  reporter: "list",
});
