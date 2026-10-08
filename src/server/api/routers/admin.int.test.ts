import { describe, expect, it } from "vitest";
import { hashStudentId } from "@/lib/voting/hash";
import { db } from "@/server/db";
import { signedInAs } from "@/test/integration/caller";
import { createElection } from "@/test/integration/fixtures";

const voters = [
	{
		studentId: "1234567",
		firstName: "Ada",
		lastName: "Lovelace",
		email: "ada@uoguelph.ca",
		college: "coe",
	},
	{
		studentId: "2345678",
		firstName: "Alan",
		lastName: "Turing",
		email: "alan@uoguelph.ca",
		college: "CCMPS",
	},
];

describe("admin.importVoters", () => {
	it("stores student IDs encrypted, with an HMAC lookup hash", async () => {
		const election = await createElection();
		const { caller } = await signedInAs("ADMIN");

		const result = await caller.admin.importVoters({
			electionId: election.id,
			voters,
		});
		expect(result.imported).toBe(2);

		const raw = await db.$queryRaw<
			{
				email: string;
				studentId: string;
				studentIdHash: string;
				college: string;
			}[]
		>`SELECT email, "studentId", "studentIdHash", college FROM eligible_voters ORDER BY email`;
		expect(raw.map((r) => r.email)).toEqual([
			"ada@uoguelph.ca",
			"alan@uoguelph.ca",
		]);
		for (const row of raw) {
			expect(row.studentId).toMatch(/^v1\.aesgcm256\./);
			expect(row.studentId).not.toContain("1234567");
		}
		expect(raw[0]?.studentIdHash).toBe(hashStudentId("1234567"));
		// College codes are canonicalised on import
		expect(raw[0]?.college).toBe("COE");

		// Reading through the encrypted client decrypts transparently
		const ada = await db.eligibleVoter.findFirst({
			where: { email: "ada@uoguelph.ca" },
		});
		expect(ada?.studentId).toBe("1234567");
	});

	it("skips voters already on the roll unless replacing", async () => {
		const election = await createElection();
		const { caller } = await signedInAs("ADMIN");
		await caller.admin.importVoters({ electionId: election.id, voters });

		const again = await caller.admin.importVoters({
			electionId: election.id,
			voters,
		});
		expect(again.imported).toBe(0);
		expect(await db.eligibleVoter.count()).toBe(2);

		const replaced = await caller.admin.importVoters({
			electionId: election.id,
			voters: voters.slice(0, 1),
			replaceExisting: true,
		});
		expect(replaced.imported).toBe(1);
		expect(await db.eligibleVoter.count()).toBe(1);
	});

	it("records the import in the audit log", async () => {
		const election = await createElection();
		const { caller, user } = await signedInAs("CRO");
		await caller.admin.importVoters({ electionId: election.id, voters });

		const logs = await db.auditLog.findMany({
			where: { electionId: election.id },
		});
		expect(logs).toHaveLength(1);
		expect(logs[0]?.action).toBe("VOTER_IMPORT");
		expect(logs[0]?.details).toMatchObject({
			performedBy: user.id,
			performedByEmail: user.email,
			voterCount: 2,
		});
	});
});
