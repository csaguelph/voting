import { adminRouter } from "@/server/api/routers/admin";
import { electionRouter } from "@/server/api/routers/election";
import { healthRouter } from "@/server/api/routers/health";
import { voterRouter } from "@/server/api/routers/voter";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
	health: healthRouter,
	election: electionRouter,
	voter: voterRouter,
	admin: adminRouter,
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
