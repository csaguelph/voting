import superjson from "superjson";
import { afterAll, beforeEach, vi } from "vitest";
import { db } from "@/server/db";
import { assertTestDatabase } from "./database-guard";

// NextAuth initialises Next.js internals on import; tests build their own
// session context instead (see ./caller.ts)
vi.mock("@/server/auth", () => ({ auth: vi.fn(async () => null) }));

// In-memory stand-in for the Upstash results cache, with the same versioning
// as the real module (unit-tested against a fake Redis in
// results-cache.test.ts). Values go through superjson like the real cache.
vi.mock("@/lib/results/results-cache", () => {
	const entries = new Map<string, string>();
	const versions = new Map<string, number>();
	const versionOf = (electionId: string) =>
		`${versions.get("*") ?? 0}.${versions.get(electionId) ?? 0}`;
	const bump = (key: string) => versions.set(key, (versions.get(key) ?? 0) + 1);
	return {
		getCachedElectionResults: vi.fn(async (electionId: string) => {
			const version = versionOf(electionId);
			const raw = entries.get(`${electionId}:${version}`);
			return { value: raw == null ? null : superjson.parse(raw), version };
		}),
		setCachedElectionResults: vi.fn(
			async (electionId: string, version: string, value: unknown) => {
				entries.set(`${electionId}:${version}`, superjson.stringify(value));
			},
		),
		invalidateElectionResults: vi.fn(async (electionId: string) => {
			bump(electionId);
		}),
		invalidateAllElectionResults: vi.fn(async () => {
			bump("*");
		}),
	};
});

// The tRPC timing middleware logs every call
vi.spyOn(console, "log").mockImplementation(() => {});

assertTestDatabase(process.env.DATABASE_URL);

beforeEach(async () => {
	const tables = await db.$queryRaw<{ tablename: string }[]>`
		SELECT tablename FROM pg_tables
		WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
	`;
	const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
	await db.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
	vi.clearAllMocks();
});

afterAll(async () => {
	await db.$disconnect();
});
