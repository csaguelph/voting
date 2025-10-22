import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

/**
 * Health check router
 * Provides basic system health and status endpoints
 */
export const healthRouter = createTRPCRouter({
	/**
	 * Simple health check endpoint
	 */
	ping: publicProcedure.query(() => {
		return {
			status: "ok",
			timestamp: new Date().toISOString(),
		};
	}),

	/**
	 * Echo endpoint for testing
	 */
	echo: publicProcedure
		.input(z.object({ message: z.string() }))
		.query(({ input }) => {
			return {
				message: input.message,
				timestamp: new Date().toISOString(),
			};
		}),
});
