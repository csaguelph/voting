import { defineConfig, devices } from "@playwright/test";
import { appEnv, E2E_BASE_URL, E2E_PORT } from "./e2e/support/env";

/**
 * End-to-end tests run against the production build (`pnpm build` first).
 * They need the e2e database and the Redis REST proxy from docker-compose:
 * docker compose --profile e2e up -d
 */
export default defineConfig({
	testDir: "./e2e",
	globalSetup: "./e2e/global-setup.ts",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: process.env.CI ? 2 : undefined,
	reporter: process.env.CI
		? [["github"], ["html", { open: "never" }]]
		: [["list"], ["html", { open: "never" }]],
	use: {
		baseURL: E2E_BASE_URL,
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		locale: "en-CA",
		timezoneId: "America/Toronto",
	},
	projects: [
		{ name: "chromium", use: { ...devices["Desktop Chrome"] } },
		{
			// Most students vote on their phones
			name: "mobile",
			testMatch: /student-voting\.spec\.ts/,
			use: {
				...devices["Desktop Chrome"],
				viewport: { width: 390, height: 844 },
				deviceScaleFactor: 3,
				isMobile: true,
				hasTouch: true,
			},
		},
	],
	webServer: {
		command: `pnpm start --port ${E2E_PORT}`,
		url: E2E_BASE_URL,
		reuseExistingServer: !process.env.CI,
		timeout: 60_000,
		env: appEnv,
	},
});
