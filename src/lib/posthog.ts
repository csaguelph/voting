import { PostHog } from "posthog-node";

let posthogClient: PostHog | null = null;

// NOTE: This is a Node.js client for sending events from the server side to PostHog.
// Only initializes if PostHog env vars are configured.
export function getPostHogClient(): PostHog | null {
	// If PostHog is not configured, return null
	if (
		!process.env.NEXT_PUBLIC_POSTHOG_KEY ||
		!process.env.NEXT_PUBLIC_POSTHOG_HOST
	) {
		return null;
	}

	// Create singleton instance
	if (!posthogClient) {
		posthogClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
			host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
			flushAt: 1,
			flushInterval: 0,
		});
	}

	return posthogClient;
}

// Helper function to safely capture events
export function captureServerEvent(
	distinctId: string,
	event: string,
	properties?: Record<string, unknown>,
) {
	const client = getPostHogClient();
	if (client) {
		client.capture({
			distinctId,
			event,
			properties,
		});
	}
}

// Ensure client is shut down properly
export async function shutdownPostHog() {
	if (posthogClient) {
		await posthogClient.shutdown();
	}
}
