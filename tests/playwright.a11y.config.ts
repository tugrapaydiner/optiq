import { resolve } from "node:path";

import { defineConfig, devices } from "@playwright/test";

const projectRoot = process.cwd();
const baseURL = "http://127.0.0.1:3100";

export default defineConfig({
  testDir: resolve(projectRoot, "tests/e2e"),
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  preserveOutput: "always",
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  workers: 4,
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm start --hostname 127.0.0.1 --port 3100",
    cwd: projectRoot,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
