import { defineConfig } from "vitest/config";

// Dummy values so `@/env` validates without a real .env
const baseEnv = {
	NODE_ENV: "test" as const,
	AUTH_SECRET: "test-auth-secret",
	AZURE_AD_CLIENT_ID: "test",
	AZURE_AD_CLIENT_SECRET: "test",
	AZURE_AD_TENANT_ID: "test",
	DATABASE_URL: "postgresql://postgres:password@localhost:5432/unused",
	PRISMA_FIELD_ENCRYPTION_KEY: "test",
	VOTE_HASH_SECRET: "test-vote-hash-secret-at-least-32-chars",
	UPSTASH_REDIS_REST_URL: "http://localhost:8079",
	UPSTASH_REDIS_REST_TOKEN: "test",
};

// Integration tests run against a real Postgres. Point TEST_DATABASE_URL at a
// throwaway database; its name must end in "_test" (checked before any data
// is touched). Defaults to a database alongside the docker-compose one.
const testDatabaseUrl =
	process.env.TEST_DATABASE_URL ??
	"postgresql://postgres:password@localhost:5432/csa_voting_test";

export default defineConfig({
	resolve: {
		tsconfigPaths: true,
	},
	test: {
		projects: [
			{
				extends: true,
				test: {
					name: "unit",
					include: ["src/**/*.test.ts"],
					exclude: ["src/**/*.int.test.ts"],
					environment: "node",
					env: baseEnv,
				},
			},
			{
				extends: true,
				test: {
					name: "integration",
					include: ["src/**/*.int.test.ts"],
					environment: "node",
					env: {
						...baseEnv,
						DATABASE_URL: testDatabaseUrl,
						// Test-only key; never use it for real data
						PRISMA_FIELD_ENCRYPTION_KEY:
							"k1.aesgcm256.Tn5l3CXY94SU3jehm0toDSYnoqtVbKzR7VXbT9PPnFU=",
					},
					globalSetup: ["src/test/integration/global-setup.ts"],
					setupFiles: ["src/test/integration/setup.ts"],
					// One shared database, so test files must not run concurrently
					fileParallelism: false,
					testTimeout: 30_000,
					hookTimeout: 60_000,
				},
			},
		],
		coverage: {
			provider: "v8",
			include: ["src/lib/**/*.ts", "src/server/**/*.ts"],
			reporter: ["text", "html", "json-summary"],
		},
	},
});
