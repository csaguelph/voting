import { execFileSync } from "node:child_process";
import type { TestProject } from "vitest/node";
import { assertTestDatabase } from "./database-guard";

/** Create the test database if needed and apply all migrations, once per run */
export default function setup(project: TestProject) {
	const url = assertTestDatabase(project.config.env.DATABASE_URL);
	execFileSync("pnpm", ["prisma", "migrate", "deploy"], {
		env: { ...process.env, DATABASE_URL: url },
		stdio: "pipe",
	});
}
