import { beforeAll, describe, expect, it, vi } from "vitest";
import {
	ABSTAIN,
	ballot,
	candidate,
	NO,
	ranked,
	votes,
	YES,
} from "@/test/results-fixtures";
import {
	calculateBallotResults,
	calculateElectionResults,
	calculateReferendumResults,
	getResultsSummary,
} from "./calculator";

beforeAll(() => {
	// Multi-seat calculation logs debug output
	vi.spyOn(console, "log").mockImplementation(() => {});
});

const byId = <T extends { candidateId: string }>(list: T[] | undefined) =>
	Object.fromEntries((list ?? []).map((c) => [c.candidateId, c]));

describe("calculateBallotResults: single candidate (YES/NO)", () => {
	it("elects the candidate when YES beats NO, ignoring abstentions", () => {
		const result = calculateBallotResults(
			ballot({
				candidates: [candidate("c1", { name: "Ada" })],
				votes: [...votes(3, YES), ...votes(1, NO), ...votes(2, ABSTAIN)],
			}),
		);

		expect(result.totalVotes).toBe(6);
		expect(result.totalCountedVotes).toBe(4);
		expect(result.candidates).toEqual([
			expect.objectContaining({
				name: "Ada",
				votes: 3,
				percentage: 75,
				isWinner: true,
				isTied: false,
			}),
		]);
	});

	it.each([
		["NO wins", 1, 3, { isWinner: false, isTied: false }],
		["a YES/NO tie", 2, 2, { isWinner: false, isTied: true }],
		["no votes", 0, 0, { isWinner: false, isTied: false, percentage: 0 }],
	])("does not elect on %s", (_label, yes, no, expected) => {
		const result = calculateBallotResults(
			ballot({
				candidates: [candidate("c1")],
				votes: [...votes(yes, YES), ...votes(no, NO)],
			}),
		);
		expect(result.candidates?.[0]).toMatchObject(expected);
	});

	it("never elects a withdrawn or disqualified sole candidate", () => {
		const result = calculateBallotResults(
			ballot({
				candidates: [
					candidate("c1", { status: "DISQUALIFIED", statusReason: "Late" }),
				],
				votes: votes(5, YES),
			}),
		);
		expect(result.candidates?.[0]).toMatchObject({
			votes: 0,
			percentage: 0,
			isWinner: false,
			status: "DISQUALIFIED",
			statusReason: "Late",
		});
	});
});

describe("calculateBallotResults: ranked, single seat", () => {
	const candidates = ["a", "b", "c"].map((id) => candidate(id));

	it("runs instant runoff and reports first- and final-round votes", () => {
		const result = calculateBallotResults(
			ballot({
				candidates,
				votes: [
					...votes(4, ranked("a")),
					...votes(3, ranked("b")),
					...votes(2, ranked("c", "b")),
				],
			}),
		);
		const c = byId(result.candidates);

		expect(c.b).toMatchObject({ votes: 3, finalRoundVotes: 5, isWinner: true });
		expect(c.a).toMatchObject({
			votes: 4,
			finalRoundVotes: 4,
			isWinner: false,
		});
		expect(c.c).toMatchObject({ votes: 2, finalRoundVotes: 0 });
		// Sorted by final-round votes
		expect(result.candidates?.map((x) => x.candidateId)).toEqual([
			"b",
			"a",
			"c",
		]);
		expect(result.rankedChoiceDetails?.description).toEqual([
			"Round 1: a: 4, b: 3, c: 2. Eliminated: c",
			"Round 2 (Final): a: 4, b: 5",
		]);
	});

	it("bases percentages on all ballots cast, including abstentions", () => {
		const result = calculateBallotResults(
			ballot({
				candidates,
				votes: [...votes(3, ranked("a")), ...votes(1, ABSTAIN)],
			}),
		);
		expect(byId(result.candidates).a?.percentage).toBe(75);
		expect(result.totalVotes).toBe(4);
		expect(result.totalCountedVotes).toBe(3);
	});

	it("transfers votes from a withdrawn candidate and excludes them from counted votes", () => {
		const result = calculateBallotResults(
			ballot({
				candidates: [
					candidate("a"),
					candidate("b"),
					candidate("w", { status: "WITHDRAWN" }),
				],
				votes: [
					...votes(4, ranked("w", "b")),
					...votes(3, ranked("a")),
					...votes(2, ranked("b")),
				],
			}),
		);
		const c = byId(result.candidates);

		expect(c.b).toMatchObject({ votes: 6, isWinner: true });
		expect(c.w).toMatchObject({
			votes: 0,
			isWinner: false,
			status: "WITHDRAWN",
		});
		expect(result.totalCountedVotes).toBe(9);
	});
});

describe("calculateBallotResults: ranked ties", () => {
	const candidates = ["a", "b", "m"].map((id) => candidate(id));
	const tied = () =>
		ballot({
			candidates,
			votes: [
				...votes(4, ranked("m")),
				...votes(2, ranked("a", "b")),
				...votes(2, ranked("b")),
			],
		});

	it("reports a tie to be decided by lot, with no winner yet", () => {
		const result = calculateBallotResults(tied());
		const c = byId(result.candidates);

		expect(result.candidates?.some((x) => x.isWinner)).toBe(false);
		expect([c.a?.isTied, c.b?.isTied, c.m?.isTied]).toEqual([
			true,
			true,
			false,
		]);
		expect(result.pendingTieBreak).toEqual({
			kind: "EXCLUSION",
			round: 1,
			candidateIds: ["a", "b"],
			select: 1,
		});
		expect(result.rankedChoiceDetails?.description).toEqual([
			"Round 1: a: 2, b: 2, m: 4. Tied for exclusion: a, b, to be decided by lot",
		]);
	});

	it("counts on from a recorded draw and explains each tie-break", () => {
		const result = calculateBallotResults({
			...tied(),
			tieBreakDraws: [
				{
					kind: "EXCLUSION",
					round: 1,
					candidateIds: ["a", "b"],
					selectedCandidateIds: ["a"],
				},
			],
		});

		expect(byId(result.candidates).m?.isWinner).toBe(true);
		expect(result.pendingTieBreak).toBeUndefined();
		expect(result.tieBreaks?.map((t) => t.method)).toEqual([
			"LOT",
			"PREVIOUS_COUNT",
		]);
		expect(result.rankedChoiceDetails?.description).toEqual([
			"Round 1: a: 2, b: 2, m: 4. Eliminated: a (tied with b; decided by lot)",
			"Round 2: b: 4, m: 4. Eliminated: b (tied with m; fewer votes in round 1)",
			"Round 3 (Final): m: 4",
		]);
	});
});

describe("calculateBallotResults: ranked, multi-seat (Borda count)", () => {
	const candidates = ["a", "b", "c", "d"].map((id) => candidate(id));

	it("awards N points for a 1st choice, N-1 for 2nd, and elects the top scorers", () => {
		const result = calculateBallotResults(
			ballot({
				seatsAvailable: 2,
				candidates,
				votes: [
					...votes(3, ranked("a", "b", "c")),
					...votes(2, ranked("c", "b")),
					...votes(1, ranked("d")),
				],
			}),
		);
		const c = byId(result.candidates);

		// a: 3x4=12; b: 3x3 + 2x3 = 15; c: 3x2 + 2x4 = 14; d: 4
		expect([c.a?.score, c.b?.score, c.c?.score, c.d?.score]).toEqual([
			12, 15, 14, 4,
		]);
		expect(
			result.candidates?.filter((x) => x.isWinner).map((x) => x.name),
		).toEqual(["b", "c"]);
		// Percentage is share of all points awarded
		expect(c.b?.percentage).toBeCloseTo((15 / 45) * 100);
	});

	it("excludes ineligible candidates from scoring and from winning", () => {
		const result = calculateBallotResults(
			ballot({
				seatsAvailable: 2,
				candidates: [
					candidate("a"),
					candidate("b"),
					candidate("c"),
					candidate("x", { status: "DISQUALIFIED" }),
				],
				votes: votes(5, ranked("x", "a", "b", "c")),
			}),
		);
		const c = byId(result.candidates);

		// With x removed, a is first of 3 eligible: 3 points per ballot
		expect(c.a?.score).toBe(15);
		expect(c.x?.isWinner).toBe(false);
		expect(
			result.candidates?.filter((x) => x.isWinner).map((x) => x.name),
		).toEqual(["a", "b"]);
	});

	it("decides a score tie at the last seat by first choices", () => {
		// b and c both score 6: b from 2 first choices, c from 3 second choices
		const result = calculateBallotResults(
			ballot({
				seatsAvailable: 2,
				candidates: ["a", "b", "c"].map((id) => candidate(id)),
				votes: [...votes(3, ranked("a", "c")), ...votes(2, ranked("b"))],
			}),
		);
		const c = byId(result.candidates);
		expect([c.a?.score, c.b?.score, c.c?.score]).toEqual([9, 6, 6]);
		expect(c.b).toMatchObject({ isWinner: true, isTied: false });
		expect(c.c).toMatchObject({ isWinner: false, isTied: false });
		expect(result.pendingTieBreak).toBeUndefined();
		expect(result.tieBreaks).toEqual([
			expect.objectContaining({
				kind: "SEAT",
				candidateIds: ["b", "c"],
				selectedCandidateIds: ["b"],
				method: "FIRST_CHOICES",
			}),
		]);
	});

	describe("when candidates are level on score and first choices", () => {
		const tiedForLastSeat = () =>
			ballot({
				id: "multi",
				seatsAvailable: 2,
				candidates: ["a", "b", "c"].map((id) => candidate(id)),
				votes: [
					...votes(2, ranked("a")),
					...votes(1, ranked("b")),
					...votes(1, ranked("c")),
				],
			});

		it("waits for the CRO to draw lots for the seat", () => {
			const result = calculateBallotResults(tiedForLastSeat());
			const c = byId(result.candidates);
			expect(c.a).toMatchObject({ isWinner: true, isTied: false });
			expect(c.b).toMatchObject({ isWinner: false, isTied: true });
			expect(c.c).toMatchObject({ isWinner: false, isTied: true });
			expect(result.pendingTieBreak).toEqual({
				kind: "SEAT",
				round: 0,
				candidateIds: ["b", "c"],
				select: 1,
			});
		});

		it("seats the candidate chosen by the recorded draw", () => {
			const result = calculateBallotResults({
				...tiedForLastSeat(),
				tieBreakDraws: [
					{
						kind: "SEAT",
						round: 0,
						candidateIds: ["c", "b"],
						selectedCandidateIds: ["c"],
					},
				],
			});
			const c = byId(result.candidates);
			expect(c.c).toMatchObject({ isWinner: true, isTied: false });
			expect(c.b).toMatchObject({ isWinner: false, isTied: false });
			expect(result.pendingTieBreak).toBeUndefined();
			expect(result.tieBreaks).toEqual([
				{
					kind: "SEAT",
					round: 0,
					candidateIds: ["b", "c"],
					selectedCandidateIds: ["c"],
					method: "LOT",
				},
			]);
		});
	});

	it("elects every eligible candidate when there are more seats than candidates", () => {
		const result = calculateBallotResults(
			ballot({
				seatsAvailable: 5,
				candidates: ["a", "b"].map((id) => candidate(id)),
				votes: votes(1, ranked("a")),
			}),
		);
		expect(result.candidates?.every((c) => c.isWinner)).toBe(true);
	});
});

describe("calculateReferendumResults", () => {
	it.each([
		["passes on a YES majority", 6, 4, { passed: true, isTied: false }],
		["fails on a NO majority", 4, 6, { passed: false, isTied: false }],
		["fails on a tie", 5, 5, { passed: false, isTied: true }],
		["fails with no votes", 0, 0, { passed: false, isTied: false }],
	])("%s", (_label, yes, no, expected) => {
		const result = calculateReferendumResults(
			ballot({
				type: "REFERENDUM",
				votes: [...votes(yes, YES), ...votes(no, NO), ...votes(3, ABSTAIN)],
			}),
		);
		expect(result.referendum).toMatchObject({ yes, no, ...expected });
		expect(result.totalVotes).toBe(yes + no + 3);
		expect(result.totalCountedVotes).toBe(yes + no);
	});

	it("computes percentages of YES+NO, rounded to 2 decimals", () => {
		const result = calculateReferendumResults(
			ballot({
				type: "REFERENDUM",
				votes: [...votes(2, YES), ...votes(1, NO), ...votes(10, ABSTAIN)],
			}),
		);
		expect(result.referendum).toMatchObject({
			yesPercentage: 66.67,
			noPercentage: 33.33,
		});
	});
});

describe("calculateElectionResults", () => {
	const election = {
		id: "e1",
		name: "2026 General Election",
		isFinalized: true,
		isPublished: false,
	};
	const quorum = {
		executiveQuorum: 10,
		directorQuorum: 15,
		referendumQuorum: 20,
	};

	it("applies quorum per ballot type against overall or college turnout", () => {
		const results = calculateElectionResults(
			election,
			[
				ballot({
					id: "exec",
					type: "EXECUTIVE",
					candidates: [candidate("c1")],
				}),
				ballot({
					id: "dir",
					type: "DIRECTOR",
					college: "coe",
					candidates: [candidate("c2")],
				}),
				ballot({ id: "ref", type: "REFERENDUM" }),
			],
			1000,
			150,
			quorum,
			new Map([["COE", 200]]),
			new Map([["COE", 29]]),
		);
		const b = Object.fromEntries(results.ballots.map((x) => [x.ballotId, x]));

		expect(b.exec).toMatchObject({
			eligibleVoters: 1000,
			participatedCount: 150,
			quorumPercentage: 10,
			quorumThreshold: 100,
			hasReachedQuorum: true,
		});
		// College lookups are canonicalised ("coe" -> "COE"); 29 < 15% of 200
		expect(b.dir).toMatchObject({
			eligibleVoters: 200,
			participatedCount: 29,
			quorumThreshold: 30,
			hasReachedQuorum: false,
		});
		expect(b.ref).toMatchObject({
			quorumThreshold: 200,
			hasReachedQuorum: false,
		});
		expect(results.turnoutPercentage).toBe(15);
	});

	it("rounds quorum thresholds up", () => {
		const results = calculateElectionResults(
			election,
			[ballot({ candidates: [candidate("c1")] })],
			7,
			1,
			quorum,
		);
		// 10% of 7 = 0.7, so one voter is required
		expect(results.ballots[0]).toMatchObject({
			quorumThreshold: 1,
			hasReachedQuorum: true,
		});
	});

	it("never reaches quorum when no one is eligible", () => {
		const results = calculateElectionResults(
			election,
			[
				ballot({
					type: "DIRECTOR",
					college: "OAC",
					candidates: [candidate("c1")],
				}),
			],
			100,
			50,
			quorum,
			new Map(),
			new Map(),
		);
		expect(results.ballots[0]).toMatchObject({
			eligibleVoters: 0,
			quorumThreshold: 0,
			hasReachedQuorum: false,
		});
		expect(calculateElectionResults(election, [], 0, 0).turnoutPercentage).toBe(
			0,
		);
	});

	it("defaults to 10% executive/director and 20% referendum quorum", () => {
		const results = calculateElectionResults(
			election,
			[
				ballot({ type: "EXECUTIVE", candidates: [candidate("c1")] }),
				ballot({ type: "REFERENDUM" }),
			],
			100,
			0,
		);
		expect(results.ballots.map((b) => b.quorumPercentage)).toEqual([10, 20]);
	});

	it("lists withdrawn and disqualified candidates for the public results", () => {
		const results = calculateElectionResults(
			election,
			[
				ballot({
					id: "exec",
					title: "President",
					candidates: [
						candidate("a", { name: "Ada" }),
						candidate("w", {
							name: "Will",
							status: "WITHDRAWN",
							statusReason: "Personal",
						}),
						candidate("d", { name: "Dee", status: "DISQUALIFIED" }),
					],
					votes: votes(3, ranked("a")),
				}),
			],
			10,
			3,
		);
		// Listed in results-table order (ties broken by name)
		expect(results.withdrawalsAndDisqualifications).toEqual([
			{
				ballotId: "exec",
				ballotTitle: "President",
				candidateId: "d",
				candidateName: "Dee",
				status: "DISQUALIFIED",
				statusReason: null,
			},
			{
				ballotId: "exec",
				ballotTitle: "President",
				candidateId: "w",
				candidateName: "Will",
				status: "WITHDRAWN",
				statusReason: "Personal",
			},
		]);
	});
});

describe("getResultsSummary", () => {
	it("counts ballots, ties and referendum outcomes", () => {
		const results = calculateElectionResults(
			{ id: "e1", name: "E", isFinalized: false, isPublished: false },
			[
				ballot({ type: "REFERENDUM", votes: votes(2, YES) }),
				ballot({ type: "REFERENDUM", votes: votes(2, NO) }),
				ballot({
					candidates: [candidate("c1")],
					votes: [...votes(1, YES), ...votes(1, NO)],
				}),
			],
			10,
			4,
		);
		expect(getResultsSummary(results)).toEqual({
			totalBallots: 3,
			ballotsWithTies: 1,
			referendumsCount: 2,
			referendumsPassed: 1,
			turnout: { voted: 4, eligible: 10, percentage: 40 },
		});
	});
});
