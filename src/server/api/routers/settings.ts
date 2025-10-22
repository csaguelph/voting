import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "@/server/api/trpc";

/**
 * Settings router
 * Handles global application settings
 */
export const settingsRouter = createTRPCRouter({
	/**
	 * Get global settings (creates default if doesn't exist)
	 */
	getGlobal: adminProcedure.query(async ({ ctx }) => {
		let settings = await ctx.db.globalSettings.findUnique({
			where: { id: "global" },
		});

		// Create default settings if they don't exist
		if (!settings) {
			settings = await ctx.db.globalSettings.create({
				data: {
					id: "global",
					executiveQuorum: 10,
					directorQuorum: 10,
					referendumQuorum: 20,
				},
			});
		}

		return settings;
	}),

	/**
	 * Update quorum settings
	 */
	updateQuorum: adminProcedure
		.input(
			z.object({
				executiveQuorum: z.number().min(1).max(100),
				directorQuorum: z.number().min(1).max(100),
				referendumQuorum: z.number().min(1).max(100),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Upsert the settings
			const settings = await ctx.db.globalSettings.upsert({
				where: { id: "global" },
				update: {
					executiveQuorum: input.executiveQuorum,
					directorQuorum: input.directorQuorum,
					referendumQuorum: input.referendumQuorum,
				},
				create: {
					id: "global",
					executiveQuorum: input.executiveQuorum,
					directorQuorum: input.directorQuorum,
					referendumQuorum: input.referendumQuorum,
				},
			});

			return settings;
		}),
});
