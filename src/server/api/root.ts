import { adminRouter } from "@/server/api/routers/admin";
import { auditRouter } from "@/server/api/routers/audit";
import { ballotRouter } from "@/server/api/routers/ballot";
import { electionRouter } from "@/server/api/routers/election";
import { proofRouter } from "@/server/api/routers/proof";
import { resultsRouter } from "@/server/api/routers/results";
import { settingsRouter } from "@/server/api/routers/settings";
import { verifyRouter } from "@/server/api/routers/verify";
import { voteRouter } from "@/server/api/routers/vote";
import { voterRouter } from "@/server/api/routers/voter";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
	election: electionRouter,
	voter: voterRouter,
	admin: adminRouter,
	ballot: ballotRouter,
	vote: voteRouter,
	verify: verifyRouter,
	settings: settingsRouter,
	results: resultsRouter,
	audit: auditRouter,
	proof: proofRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.health.ping();
 */
export const createCaller = createCallerFactory(appRouter);
