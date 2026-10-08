import { defineConfig } from "vitest/config";

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
					environment: "node",
					// Dummy values so `@/env` validates without a real .env
					env: {
						NODE_ENV: "test",
						AUTH_SECRET: "test-auth-secret",
						AZURE_AD_CLIENT_ID: "test",
						AZURE_AD_CLIENT_SECRET: "test",
						AZURE_AD_TENANT_ID: "test",
						DATABASE_URL: "postgresql://postgres:password@localhost:5432/test",
						PRISMA_FIELD_ENCRYPTION_KEY: "test",
						VOTE_HASH_SECRET: "test-vote-hash-secret-at-least-32-chars",
						UPSTASH_REDIS_REST_URL: "http://localhost:8079",
						UPSTASH_REDIS_REST_TOKEN: "test",
					},
				},
			},
		],
		coverage: {
			provider: "v8",
			include: ["src/lib/**/*.ts"],
			reporter: ["text", "html", "json-summary"],
		},
	},
});
