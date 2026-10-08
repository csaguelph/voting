import superjson from "superjson";
import { afterAll, beforeEach, vi } from "vitest";
import { db } from "@/server/db";
import { assertTestDatabase } from "./database-guard";

// NextAuth initialises Next.js internals on import; tests build their own
// session context instead (see ./caller.ts)
vi.mock("@/server/auth", () => ({ auth: vi.fn(async () => null) }));

// In-memory stand-in for the Upstash results cache. Values go through
// superjson like the real cache, so Dates and Maps round-trip the same way.
vi.mock("@/lib/results/results-cache", () => {
	const store = new Map<string, string>();
	return {
		getCachedElectionResults: vi.fn(async (electionId: string) => {
			const raw = store.get(electionId);
			return raw == null ? null : superjson.parse(raw);
		}),
		setCachedElectionResults: vi.fn(
			async (electionId: string, value: unknown) => {
				store.set(electionId, superjson.stringify(value));
			},
		),
		invalidateElectionResults: vi.fn(async (electionId: string) => {
			store.delete(electionId);
		}),
		invalidateAllElectionResults: vi.fn(async () => {
			store.clear();
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
