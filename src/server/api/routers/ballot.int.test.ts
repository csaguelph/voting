import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { signedInAs } from "@/test/integration/caller";
import { createBallot, createElection } from "@/test/integration/fixtures";

const HOUR = 60 * 60 * 1000;

describe("ballot.deleteCandidate", () => {
	it("deletes a candidate before voting opens", async () => {
		const election = await createElection({
			startTime: new Date(Date.now() + HOUR),
			endTime: new Date(Date.now() + 2 * HOUR),
		});
		const ballot = await createBallot(election.id, {
			candidates: ["Ada", "Bob"],
		});
		const { caller } = await signedInAs("ADMIN");

		await caller.ballot.deleteCandidate({ id: ballot.candidates[0]?.id ?? "" });
		expect(await db.candidate.count({ where: { ballotId: ballot.id } })).toBe(
			1,
		);
	});

	it("refuses once voting has opened, even if no vote ranks the candidate", async () => {
		// A vote submitted concurrently could otherwise be stored ranking a
		// candidate that no longer exists. Withdraw candidates instead.
		const election = await createElection();
		const ballot = await createBallot(election.id, {
			candidates: ["Ada", "Bob"],
		});
		const { caller } = await signedInAs("ADMIN");

		const error = await caller.ballot
			.deleteCandidate({ id: ballot.candidates[0]?.id ?? "" })
			.catch((e: unknown) => e);
		expect(error).toBeInstanceOf(TRPCError);
		expect((error as TRPCError).code).toBe("BAD_REQUEST");
		expect((error as TRPCError).message).toMatch(/withdraw/i);
		expect(await db.candidate.count({ where: { ballotId: ballot.id } })).toBe(
			2,
		);
	});
});
