import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
	calculateRankedChoice,
	describeRound,
	type RankedVote,
} from "./ranked-choice";

let nextVoteId = 0;
const ballots = (count: number, rankings: string[]): RankedVote[] =>
	Array.from({ length: count }, () => ({
		voteId: `v${nextVoteId++}`,
		rankings,
	}));

const counts = (map: Map<string, number>) => Object.fromEntries(map);

describe("calculateRankedChoice", () => {
	it("returns no winner when there are no votes", () => {
		const result = calculateRankedChoice([], ["a", "b"]);
		expect(result).toEqual({
			winner: null,
			rounds: [],
			finalCounts: new Map(),
			totalVotes: 0,
			isTie: false,
			tieBreaks: [],
		});
	});

	it("elects a first-round majority winner without eliminations", () => {
		const votes = [...ballots(3, ["a", "b"]), ...ballots(2, ["b", "a"])];
		const result = calculateRankedChoice(votes, ["a", "b"]);

		expect(result.winner).toBe("a");
		expect(result.isTie).toBe(false);
		expect(result.rounds).toHaveLength(1);
		expect(counts(result.finalCounts)).toEqual({ a: 3, b: 2 });
	});

	it("requires a strict majority, not a plurality", () => {
		// a has 4 of 9 (plurality, not majority); c is eliminated and transfers to b
		const votes = [
			...ballots(4, ["a"]),
			...ballots(3, ["b"]),
			...ballots(2, ["c", "b"]),
		];
		const result = calculateRankedChoice(votes, ["a", "b", "c"]);

		expect(result.winner).toBe("b");
		expect(result.rounds.map((r) => r.eliminated)).toEqual(["c", null]);
		expect(counts(result.finalCounts)).toEqual({ a: 4, b: 5 });
	});

	it("transfers votes through multiple elimination rounds", () => {
		// Round 1: d out (2 -> c). Round 2: c out (5 -> b). Round 3: b has 11 of 18
		const votes = [
			...ballots(7, ["a"]),
			...ballots(6, ["b"]),
			...ballots(3, ["c", "b"]),
			...ballots(2, ["d", "c", "b"]),
		];
		const result = calculateRankedChoice(votes, ["a", "b", "c", "d"]);

		expect(result.rounds.map((r) => r.eliminated)).toEqual(["d", "c", null]);
		expect(result.winner).toBe("b");
		expect(counts(result.finalCounts)).toEqual({ a: 7, b: 11 });
	});

	it("drops exhausted ballots from the majority threshold", () => {
		// The 2 ballots ranking only c are exhausted once c is eliminated,
		// so round 2 has 9 continuing ballots and a needs 5, not 6
		const votes = [
			...ballots(5, ["a"]),
			...ballots(4, ["b"]),
			...ballots(2, ["c"]),
		];
		const result = calculateRankedChoice(votes, ["a", "b", "c"]);

		expect(result.winner).toBe("a");
		const finalRound = result.rounds.at(-1);
		expect(finalRound?.totalVotes).toBe(9);
		// totalVotes on the result still counts every ballot cast
		expect(result.totalVotes).toBe(11);
	});

	it("treats withdrawn or disqualified candidates as already eliminated", () => {
		// x would win on first choices, but is ineligible; those votes go to b
		const votes = [
			...ballots(4, ["x", "b"]),
			...ballots(3, ["a"]),
			...ballots(2, ["b"]),
		];
		const result = calculateRankedChoice(votes, ["a", "b", "x"], ["x"]);

		expect(result.winner).toBe("b");
		expect(result.rounds[0]?.voteCounts.has("x")).toBe(false);
		expect(counts(result.finalCounts)).toEqual({ a: 3, b: 6 });
	});

	it("ignores rankings for candidates not on the ballot", () => {
		const votes = [...ballots(2, ["ghost", "a"]), ...ballots(1, ["b"])];
		const result = calculateRankedChoice(votes, ["a", "b"]);

		expect(result.winner).toBe("a");
		expect(counts(result.finalCounts)).toEqual({ a: 2, b: 1 });
	});

	// Ties for exclusion follow the Australian rule: look back at earlier
	// counts, and if they never separated the candidates, decide by lot
	describe("ties", () => {
		it("excludes the tied candidate who had fewer votes at the previous count", () => {
			// Round 2: b and c tie on 4, but at round 1 c had 3 to b's 4
			const votes = [
				...ballots(6, ["a"]),
				...ballots(4, ["b"]),
				...ballots(3, ["c"]),
				...ballots(1, ["d", "c"]),
			];
			const result = calculateRankedChoice(votes, ["a", "b", "c", "d"]);

			expect(result.rounds.map((r) => r.eliminated)).toEqual(["d", "c", null]);
			expect(result.tieBreaks).toEqual([
				{
					round: 2,
					candidateIds: ["b", "c"],
					excluded: "c",
					method: "PREVIOUS_COUNT",
					decidedByRound: 1,
				},
			]);
			expect(result.winner).toBe("a");
		});

		it("keeps looking back until one tied candidate had fewer than each of the others", () => {
			// Round 3: a, b and c tie on 5. Round 2 separated only c (a and b
			// tied on 4), so it doesn't decide; round 1 had a lowest on 3
			const votes = [
				...ballots(10, ["x"]),
				...ballots(3, ["a"]),
				...ballots(4, ["b"]),
				...ballots(5, ["c"]),
				...ballots(1, ["e", "a"]),
				...ballots(1, ["f", "a"]),
				...ballots(1, ["f", "b"]),
			];
			const result = calculateRankedChoice(votes, [
				"x",
				"a",
				"b",
				"c",
				"e",
				"f",
			]);

			expect(result.rounds.map((r) => r.eliminated).slice(0, 3)).toEqual([
				"e",
				"f",
				"a",
			]);
			expect(result.tieBreaks[0]).toMatchObject({
				round: 3,
				candidateIds: ["a", "b", "c"],
				excluded: "a",
				decidedByRound: 1,
			});
		});

		it("stops for a draw by lot when the candidates were tied at every count", () => {
			const votes = [
				...ballots(4, ["m"]),
				...ballots(2, ["a", "b"]),
				...ballots(2, ["b"]),
			];
			const result = calculateRankedChoice(votes, ["m", "a", "b"]);

			expect(result.winner).toBeNull();
			expect(result.isTie).toBe(true);
			expect(result.pendingLot).toEqual({ round: 1, candidateIds: ["a", "b"] });
			expect(result.rounds).toHaveLength(1);
			expect(result.rounds[0]?.eliminated).toBeNull();
		});

		it("applies the recorded draw and continues counting", () => {
			const votes = [
				...ballots(4, ["m"]),
				...ballots(2, ["a", "b"]),
				...ballots(2, ["b"]),
			];
			const result = calculateRankedChoice(
				votes,
				["m", "a", "b"],
				[],
				[{ round: 1, candidateIds: ["b", "a"], excludedCandidateId: "a" }],
			);

			expect(result.pendingLot).toBeUndefined();
			// a's ballots transfer to b, leaving m and b tied on 4; round 1 had
			// b on 2 to m's 4, so b is excluded without another draw
			expect(result.tieBreaks).toEqual([
				{ round: 1, candidateIds: ["a", "b"], excluded: "a", method: "LOT" },
				{
					round: 2,
					candidateIds: ["b", "m"],
					excluded: "b",
					method: "PREVIOUS_COUNT",
					decidedByRound: 1,
				},
			]);
			expect(result.winner).toBe("m");
		});

		it("decides an exact final-round tie the same way", () => {
			const votes = [...ballots(3, ["jane"]), ...ballots(3, ["john"])];
			const pending = calculateRankedChoice(votes, ["john", "jane"]);
			expect(pending.winner).toBeNull();
			expect(pending.pendingLot).toEqual({
				round: 1,
				candidateIds: ["jane", "john"],
			});

			const decided = calculateRankedChoice(
				votes,
				["john", "jane"],
				[],
				[
					{
						round: 1,
						candidateIds: ["jane", "john"],
						excludedCandidateId: "jane",
					},
				],
			);
			expect(decided.winner).toBe("john");
		});

		it.each([
			["a different round", { round: 2, candidateIds: ["jane", "john"] }],
			[
				"a different set of candidates",
				{ round: 1, candidateIds: ["jane", "x"] },
			],
		])("ignores a recorded draw for %s", (_label, decision) => {
			const votes = [...ballots(3, ["jane"]), ...ballots(3, ["john"])];
			const result = calculateRankedChoice(
				votes,
				["john", "jane"],
				[],
				[{ ...decision, excludedCandidateId: "jane" }],
			);
			expect(result.pendingLot).toEqual({
				round: 1,
				candidateIds: ["jane", "john"],
			});
		});

		it("treats candidates left with no votes at all as tied", () => {
			// Every ballot ranks only an ineligible candidate
			const result = calculateRankedChoice(
				ballots(3, ["x"]),
				["a", "b", "x"],
				["x"],
			);
			expect(result.pendingLot).toEqual({ round: 1, candidateIds: ["a", "b"] });
		});
	});

	describe("invariants", () => {
		const candidatePool = ["a", "b", "c", "d", "e"];
		const election = fc
			.subarray(candidatePool, { minLength: 2 })
			.chain((candidates) =>
				fc.record({
					candidates: fc.constant(candidates),
					ineligible: fc.subarray(candidates, {
						maxLength: candidates.length - 1,
					}),
					rankings: fc.array(
						fc.shuffledSubarray(candidates, { minLength: 1 }),
						{ minLength: 1, maxLength: 60 },
					),
				}),
			)
			.map(({ candidates, ineligible, rankings }) => ({
				candidates,
				ineligible,
				votes: rankings.map((r, i) => ({ voteId: `v${i}`, rankings: r })),
			}));

		it("counts every continuing ballot exactly once per round", () => {
			fc.assert(
				fc.property(election, ({ candidates, ineligible, votes }) => {
					const result = calculateRankedChoice(votes, candidates, ineligible);
					for (const round of result.rounds) {
						const sum = [...round.voteCounts.values()].reduce(
							(a, b) => a + b,
							0,
						);
						expect(sum).toBe(round.totalVotes);
						expect(round.totalVotes).toBeLessThanOrEqual(votes.length);
					}
				}),
			);
		});

		it("never gains ballots between rounds", () => {
			fc.assert(
				fc.property(election, ({ candidates, ineligible, votes }) => {
					const { rounds } = calculateRankedChoice(
						votes,
						candidates,
						ineligible,
					);
					for (let i = 1; i < rounds.length; i++) {
						expect(rounds[i]?.totalVotes).toBeLessThanOrEqual(
							rounds[i - 1]?.totalVotes ?? 0,
						);
					}
				}),
			);
		});

		it("eliminates each candidate at most once and never counts them again", () => {
			fc.assert(
				fc.property(election, ({ candidates, ineligible, votes }) => {
					const { rounds } = calculateRankedChoice(
						votes,
						candidates,
						ineligible,
					);
					const eliminated = new Set<string>();
					for (const round of rounds) {
						for (const id of eliminated) {
							expect(round.voteCounts.has(id)).toBe(false);
						}
						if (round.eliminated) {
							expect(eliminated.has(round.eliminated)).toBe(false);
							eliminated.add(round.eliminated);
						}
					}
				}),
			);
		});

		it("elects an eligible candidate, or stops for a draw between tied candidates", () => {
			fc.assert(
				fc.property(election, ({ candidates, ineligible, votes }) => {
					const { winner, pendingLot, rounds } = calculateRankedChoice(
						votes,
						candidates,
						ineligible,
					);
					if (pendingLot) {
						expect(winner).toBeNull();
						expect(pendingLot.candidateIds.length).toBeGreaterThan(1);
						// The tied candidates are exactly those with the fewest votes
						const counts = rounds.at(-1)?.voteCounts ?? new Map();
						const fewest = Math.min(...counts.values());
						expect(pendingLot.candidateIds).toEqual(
							[...counts]
								.filter(([, n]) => n === fewest)
								.map(([id]) => id)
								.sort(),
						);
					} else {
						expect(candidates).toContain(winner);
						expect(ineligible).not.toContain(winner);
					}
				}),
			);
		});

		it("completes once every required draw has been recorded", () => {
			fc.assert(
				fc.property(election, ({ candidates, ineligible, votes }) => {
					const decisions: Parameters<typeof calculateRankedChoice>[3] = [];
					let result = calculateRankedChoice(votes, candidates, ineligible);
					for (let i = 0; result.pendingLot && i < candidates.length; i++) {
						const { round, candidateIds } = result.pendingLot;
						decisions.push({
							round,
							candidateIds,
							excludedCandidateId: candidateIds[0] ?? "",
						});
						result = calculateRankedChoice(
							votes,
							candidates,
							ineligible,
							decisions,
						);
					}
					expect(result.pendingLot).toBeUndefined();
					expect(candidates).toContain(result.winner);
					expect(
						result.tieBreaks.filter((t) => t.method === "LOT"),
					).toHaveLength(decisions.length);
				}),
			);
		});

		it("elects with a majority of continuing ballots, or as the last candidate left", () => {
			fc.assert(
				fc.property(election, ({ candidates, ineligible, votes }) => {
					const result = calculateRankedChoice(votes, candidates, ineligible);
					const final = result.rounds.at(-1);
					if (!final || !result.winner) return;
					const winnerVotes = final.voteCounts.get(result.winner) ?? 0;
					const isMajority = winnerVotes * 2 > final.totalVotes;
					const isLastStanding = final.voteCounts.size === 1;
					expect(isMajority || isLastStanding).toBe(true);
				}),
			);
		});

		it("does not depend on the order ballots are counted in", () => {
			fc.assert(
				fc.property(
					election.chain((e) =>
						fc.record({
							e: fc.constant(e),
							shuffled: fc.shuffledSubarray(e.votes, {
								minLength: e.votes.length,
							}),
						}),
					),
					({ e, shuffled }) => {
						const a = calculateRankedChoice(
							e.votes,
							e.candidates,
							e.ineligible,
						);
						const b = calculateRankedChoice(
							shuffled,
							e.candidates,
							e.ineligible,
						);
						expect(b.winner).toBe(a.winner);
						expect(b.rounds.map((r) => r.eliminated)).toEqual(
							a.rounds.map((r) => r.eliminated),
						);
					},
				),
			);
		});
	});
});

describe("describeRound", () => {
	const names = new Map([
		["a", "Alice"],
		["b", "Bob"],
	]);

	it("describes an elimination round", () => {
		const text = describeRound(
			{
				round: 1,
				eliminated: "b",
				voteCounts: new Map([
					["a", 3],
					["b", 1],
				]),
				totalVotes: 4,
			},
			names,
		);
		expect(text).toBe("Round 1: Alice: 3, Bob: 1. Eliminated: Bob");
	});

	it("describes the final round and falls back for unknown candidates", () => {
		const text = describeRound(
			{
				round: 2,
				eliminated: null,
				voteCounts: new Map([
					["a", 4],
					["zz", 0],
				]),
				totalVotes: 4,
			},
			names,
		);
		expect(text).toBe("Round 2 (Final): Alice: 4, Unknown: 0");
	});
});
