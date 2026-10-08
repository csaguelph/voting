import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { MAX_REPORTS_PER_VOTER, REPORTS_PAGE_SIZE } from "@/lib/reports";
import { db } from "@/server/db";
import { signedInAs } from "@/test/integration/caller";
import {
	createBallot,
	createElection,
	enrollVoter,
} from "@/test/integration/fixtures";

const EMAIL = "student@uoguelph.ca";

/** An open election with a referendum, and a student on the roll */
async function setup() {
	const election = await createElection();
	const ballot = await createBallot(election.id, { type: "REFERENDUM" });
	const voter = await enrollVoter(election.id, { email: EMAIL });
	const { caller } = await signedInAs("STUDENT", EMAIL);
	const { caller: cro, user: croUser } = await signedInAs("CRO");
	return { election, ballot, voter, caller, cro, croUser };
}

const fail = (promise: Promise<unknown>) =>
	promise.then(
		() => {
			throw new Error("expected the call to be rejected");
		},
		(e: unknown) => {
			expect(e).toBeInstanceOf(TRPCError);
			return e as TRPCError;
		},
	);

describe("report.file", () => {
	it("records the report with the voter's name and email for the CRO", async () => {
		const ctx = await setup();
		const result = await ctx.caller.report.file({
			electionId: ctx.election.id,
			source: "DASHBOARD",
			report: {
				reason: "ASKED_FOR_ACCESS",
				details: "  A volunteer outside the library asked for my phone.  ",
			},
		});

		expect(result.email).toBe(EMAIL);
		expect(
			await db.voterReport.findUniqueOrThrow({ where: { id: result.id } }),
		).toMatchObject({
			electionId: ctx.election.id,
			voterId: ctx.voter.id,
			voterName: "Test Voter",
			voterEmail: EMAIL,
			reason: "ASKED_FOR_ACCESS",
			details: "A volunteer outside the library asked for my phone.",
			source: "DASHBOARD",
			status: "OPEN",
		});
	});

	it("isn't written to the audit log, which admins can read", async () => {
		const ctx = await setup();
		await ctx.caller.report.file({
			electionId: ctx.election.id,
			source: "RECEIPT",
			report: { reason: "PRESSURED", details: "" },
		});
		expect(await db.auditLog.count()).toBe(0);
	});

	it("works after voting, e.g. when someone else voted for them", async () => {
		const ctx = await setup();
		await db.eligibleVoter.update({
			where: { id: ctx.voter.id },
			data: { hasVoted: true, votedAt: new Date() },
		});
		await ctx.caller.report.file({
			electionId: ctx.election.id,
			source: "ALREADY_VOTED",
			report: { reason: "SOMEONE_ELSE_VOTED", details: "" },
		});
		expect(await db.voterReport.count()).toBe(1);
	});

	it("needs details when the reason is 'something else'", async () => {
		const ctx = await setup();
		const error = await fail(
			ctx.caller.report.file({
				electionId: ctx.election.id,
				source: "DASHBOARD",
				report: { reason: "OTHER", details: "   " },
			}),
		);
		expect(error.code).toBe("BAD_REQUEST");
	});

	it("is refused for someone not on the election's voter roll", async () => {
		const ctx = await setup();
		const { caller } = await signedInAs("STUDENT", "other@uoguelph.ca");
		const error = await fail(
			caller.report.file({
				electionId: ctx.election.id,
				source: "DASHBOARD",
				report: { reason: "PRESSURED", details: "" },
			}),
		);
		expect(error.code).toBe("FORBIDDEN");
	});

	it("limits how many reports one voter can file", async () => {
		const ctx = await setup();
		const file = () =>
			ctx.caller.report.file({
				electionId: ctx.election.id,
				source: "DASHBOARD",
				report: { reason: "PRESSURED", details: "" },
			});
		for (let i = 0; i < MAX_REPORTS_PER_VOTER; i++) await file();
		const error = await fail(file());
		expect(error.code).toBe("TOO_MANY_REQUESTS");
		expect(await db.voterReport.count()).toBe(MAX_REPORTS_PER_VOTER);
	});

	it("can't be raced past the limit with parallel requests", async () => {
		const ctx = await setup();
		const file = () =>
			ctx.caller.report.file({
				electionId: ctx.election.id,
				source: "DASHBOARD",
				report: { reason: "PRESSURED", details: "" },
			});
		const results = await Promise.allSettled(
			Array.from({ length: MAX_REPORTS_PER_VOTER * 4 }, file),
		);
		expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(
			MAX_REPORTS_PER_VOTER,
		);
		for (const r of results) {
			if (r.status === "rejected") {
				expect((r.reason as TRPCError).code).toBe("TOO_MANY_REQUESTS");
			}
		}
		expect(await db.voterReport.count()).toBe(MAX_REPORTS_PER_VOTER);
	});

	it("keeps counting toward the limit after the voters list is re-imported", async () => {
		const ctx = await setup();
		const file = () =>
			ctx.caller.report.file({
				electionId: ctx.election.id,
				source: "DASHBOARD",
				report: { reason: "PRESSURED", details: "" },
			});
		for (let i = 0; i < MAX_REPORTS_PER_VOTER; i++) await file();
		await db.eligibleVoter.delete({ where: { id: ctx.voter.id } });
		await enrollVoter(ctx.election.id, { email: EMAIL });

		const error = await fail(file());
		expect(error.code).toBe("TOO_MANY_REQUESTS");
	});

	it("keeps the report if the voters list is re-imported", async () => {
		const ctx = await setup();
		await ctx.caller.report.file({
			electionId: ctx.election.id,
			source: "DASHBOARD",
			report: { reason: "PRESSURED", details: "" },
		});
		await db.eligibleVoter.delete({ where: { id: ctx.voter.id } });
		expect(await db.voterReport.findFirstOrThrow()).toMatchObject({
			voterId: null,
			voterEmail: EMAIL,
		});
	});
});

describe("vote.castVotes with a report", () => {
	it("files the report with the ballot", async () => {
		const ctx = await setup();
		const result = await ctx.caller.vote.castVotes({
			electionId: ctx.election.id,
			votes: [{ ballotId: ctx.ballot.id, voteData: { type: "YES" } }],
			report: { reason: "PRESSURED", details: "My roommate was watching." },
		});

		expect(result.reported).toBe(true);
		expect(await db.voterReport.findFirstOrThrow()).toMatchObject({
			voterId: ctx.voter.id,
			reason: "PRESSURED",
			details: "My roommate was watching.",
			source: "SUBMISSION",
		});
		expect(await db.auditLog.findMany({ select: { action: true } })).toEqual([
			{ action: "votes.cast" },
		]);
	});

	it("files nothing when the ballot is refused", async () => {
		const ctx = await setup();
		const vote = () =>
			ctx.caller.vote.castVotes({
				electionId: ctx.election.id,
				votes: [{ ballotId: ctx.ballot.id, voteData: { type: "YES" } }],
				report: { reason: "PRESSURED", details: "" },
			});
		await vote();
		await fail(vote());
		expect(await db.voterReport.count()).toBe(1);
	});

	it("doesn't file one unless asked", async () => {
		const ctx = await setup();
		const result = await ctx.caller.vote.castVotes({
			electionId: ctx.election.id,
			votes: [{ ballotId: ctx.ballot.id, voteData: { type: "YES" } }],
		});
		expect(result.reported).toBe(false);
		expect(await db.voterReport.count()).toBe(0);
	});
});

describe("CRO review", () => {
	async function withReport() {
		const ctx = await setup();
		const { id } = await ctx.caller.report.file({
			electionId: ctx.election.id,
			source: "RECEIPT",
			report: { reason: "SOMEONE_ELSE_VOTED", details: "" },
		});
		return { ...ctx, reportId: id };
	}

	it("lists reports by status, with the open count", async () => {
		const ctx = await withReport();
		const open = await ctx.cro.report.list({ status: "OPEN" });
		expect(open.openCount).toBe(1);
		expect(open.reports).toMatchObject([
			{
				id: ctx.reportId,
				election: { id: ctx.election.id, name: ctx.election.name },
			},
		]);
		expect((await ctx.cro.report.list({ status: "RESOLVED" })).reports).toEqual(
			[],
		);
	});

	it("resolves and reopens a report, audit-logging who did it", async () => {
		const ctx = await withReport();
		const resolved = await ctx.cro.report.setStatus({
			id: ctx.reportId,
			status: "RESOLVED",
		});
		expect(resolved).toMatchObject({
			status: "RESOLVED",
			resolvedById: ctx.croUser.id,
			resolvedByEmail: ctx.croUser.email,
		});
		expect(resolved.resolvedAt).not.toBeNull();

		const reopened = await ctx.cro.report.setStatus({
			id: ctx.reportId,
			status: "OPEN",
		});
		expect(reopened).toMatchObject({
			status: "OPEN",
			resolvedAt: null,
			resolvedById: null,
		});

		const logs = await db.auditLog.findMany({ orderBy: { timestamp: "asc" } });
		expect(logs.map((l) => [l.action, l.details])).toMatchObject([
			["report.resolved", { reportId: ctx.reportId, userId: ctx.croUser.id }],
			["report.reopened", { reportId: ctx.reportId, userId: ctx.croUser.id }],
		]);
	});

	it("pages through reports, newest first", async () => {
		const ctx = await setup();
		const start = Date.now();
		await db.voterReport.createMany({
			data: Array.from({ length: REPORTS_PAGE_SIZE + 5 }, (_, i) => ({
				electionId: ctx.election.id,
				voterName: `Voter ${i}`,
				voterEmail: `voter-${i}@uoguelph.ca`,
				reason: "PRESSURED" as const,
				details: "",
				source: "DASHBOARD" as const,
				createdAt: new Date(start + i * 1000),
			})),
		});

		const first = await ctx.cro.report.list({});
		const second = await ctx.cro.report.list({ page: 1 });
		expect(first.total).toBe(REPORTS_PAGE_SIZE + 5);
		expect(first.reports).toHaveLength(REPORTS_PAGE_SIZE);
		expect(second.reports).toHaveLength(5);
		expect(first.reports[0]?.voterName).toBe(`Voter ${REPORTS_PAGE_SIZE + 4}`);
		expect(second.reports.at(-1)?.voterName).toBe("Voter 0");
		const ids = [...first.reports, ...second.reports].map((r) => r.id);
		expect(new Set(ids).size).toBe(REPORTS_PAGE_SIZE + 5);
	});

	it("can't update a report that doesn't exist", async () => {
		const ctx = await setup();
		const error = await fail(
			ctx.cro.report.setStatus({ id: "no-such-report", status: "RESOLVED" }),
		);
		expect(error.code).toBe("NOT_FOUND");
	});
});
