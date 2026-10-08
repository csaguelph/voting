import { execFileSync } from "node:child_process";
import { assertTestDatabase } from "../src/test/integration/database-guard";
import { E2E_DATABASE_URL } from "./support/env";

/**
 * Apply migrations and empty the end-to-end database once per run. Tests
 * create their own uniquely named data, so they never need to wipe it again.
 */
export default async function globalSetup() {
	const url = assertTestDatabase(E2E_DATABASE_URL);
	const env = { ...process.env, DATABASE_URL: url };
	execFileSync("pnpm", ["prisma", "migrate", "deploy"], { env, stdio: "pipe" });

	const { PrismaClient } = await import("@prisma/client");
	const db = new PrismaClient({ datasourceUrl: url });
	try {
		const tables = await db.$queryRaw<{ tablename: string }[]>`
			SELECT tablename FROM pg_tables
			WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
		`;
		const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
		await db.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
	} finally {
		await db.$disconnect();
	}
}
