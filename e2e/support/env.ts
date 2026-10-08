/**
 * Settings shared by the Playwright config, global setup and test helpers.
 * Every secret here is a throwaway value used only by end-to-end tests.
 */
export const E2E_PORT = Number(process.env.E2E_PORT ?? 3100);
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

export const E2E_DATABASE_URL =
	process.env.E2E_DATABASE_URL ??
	"postgresql://postgres:password@localhost:5432/csa_voting_e2e_test";

export const E2E_ENCRYPTION_KEY =
	"k1.aesgcm256.Tn5l3CXY94SU3jehm0toDSYnoqtVbKzR7VXbT9PPnFU=";
export const E2E_VOTE_HASH_SECRET =
	"e2e-vote-hash-secret-at-least-32-characters";

/** Environment for `next start`: real validation, encryption and cache */
export const appEnv = {
	DATABASE_URL: E2E_DATABASE_URL,
	PRISMA_FIELD_ENCRYPTION_KEY: E2E_ENCRYPTION_KEY,
	VOTE_HASH_SECRET: E2E_VOTE_HASH_SECRET,
	AUTH_SECRET: "e2e-auth-secret",
	AUTH_URL: E2E_BASE_URL,
	AUTH_TRUST_HOST: "true",
	NEXTAUTH_URL: E2E_BASE_URL,
	// Never contacted: tests sign in by creating database sessions
	AZURE_AD_CLIENT_ID: "e2e-client-id",
	AZURE_AD_CLIENT_SECRET: "e2e-client-secret",
	AZURE_AD_TENANT_ID: "e2e-tenant-id",
	UPSTASH_REDIS_REST_URL:
		process.env.E2E_REDIS_REST_URL ?? "http://localhost:8079",
	UPSTASH_REDIS_REST_TOKEN:
		process.env.E2E_REDIS_REST_TOKEN ?? "e2e-redis-token",
};
