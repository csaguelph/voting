import { env } from "./src/env.js";

/** @type {import("next").NextConfig} */
let config = {
	async rewrites() {
		return [
			{
				source: "/ingest/static/:path*",
				destination: "https://us-assets.i.posthog.com/static/:path*",
			},
			{
				source: "/ingest/:path*",
				destination: "https://us.i.posthog.com/:path*",
			},
		];
	},
	// This is required to support PostHog trailing slash API requests
	skipTrailingSlashRedirect: true,
};

// Only enable PostHog source maps if configured
if (
	env.POSTHOG_PERSONAL_KEY &&
	env.POSTHOG_PROJECT_ID &&
	env.NEXT_PUBLIC_POSTHOG_HOST
) {
	try {
		const { withPostHogConfig } = await import("@posthog/nextjs-config");
		config = withPostHogConfig(config, {
			personalApiKey: env.POSTHOG_PERSONAL_KEY,
			envId: env.POSTHOG_PROJECT_ID, // Your environment ID (project ID)
			host: env.NEXT_PUBLIC_POSTHOG_HOST,
		});
	} catch (error) {
		console.warn(
			"PostHog source maps could not be configured:",
			error instanceof Error ? error.message : error,
		);
	}
}

export default config;
