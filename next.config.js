// Set NEXT_PUBLIC_GIT_COMMIT_SHA from VERCEL_GIT_COMMIT_SHA at build time
// This ensures Next.js embeds it in the client bundle
if (
	process.env.VERCEL_GIT_COMMIT_SHA &&
	!process.env.NEXT_PUBLIC_GIT_COMMIT_SHA
) {
	process.env.NEXT_PUBLIC_GIT_COMMIT_SHA = process.env.VERCEL_GIT_COMMIT_SHA;
}

/** @type {import("next").NextConfig} */
const config = {
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
};

export default config;
