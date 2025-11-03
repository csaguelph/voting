import { env } from "./src/env.js";

// Set NEXT_PUBLIC_GIT_COMMIT_SHA from VERCEL_GIT_COMMIT_SHA at build time
// This ensures Next.js embeds it in the client bundle
if (
	process.env.VERCEL_GIT_COMMIT_SHA &&
	!process.env.NEXT_PUBLIC_GIT_COMMIT_SHA
) {
	process.env.NEXT_PUBLIC_GIT_COMMIT_SHA = process.env.VERCEL_GIT_COMMIT_SHA;
}

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
	async headers() {
		const headers = [];

		// Only add Web-Build header if VERCEL_GIT_COMMIT_SHA is available
		if (process.env.VERCEL_GIT_COMMIT_SHA) {
			headers.push({
				source: "/:path*",
				headers: [
					{
						key: "Web-Build",
						value: process.env.VERCEL_GIT_COMMIT_SHA,
					},
				],
			});
		}

		return headers;
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
