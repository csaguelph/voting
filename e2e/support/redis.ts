import { appEnv } from "./env";

/** Run a Redis command through the same REST proxy the app uses */
export async function redis(...command: string[]): Promise<unknown> {
	const response = await fetch(appEnv.UPSTASH_REDIS_REST_URL, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${appEnv.UPSTASH_REDIS_REST_TOKEN}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(command),
	});
	const body = (await response.json()) as { result?: unknown; error?: string };
	if (!response.ok || body.error) {
		throw new Error(
			`Redis ${command[0]} failed: ${body.error ?? response.status}`,
		);
	}
	return body.result;
}
