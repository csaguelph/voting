/**
 * Integration tests wipe every table between tests. Refuse to run unless the
 * target database is clearly a throwaway one, so a misconfigured
 * DATABASE_URL can never point the suite at real election data.
 */
export function assertTestDatabase(url: string | undefined): string {
	if (!url) {
		throw new Error("DATABASE_URL is not set for integration tests");
	}
	const name = new URL(url).pathname.replace(/^\//, "");
	if (!name.endsWith("_test")) {
		throw new Error(
			`Refusing to run integration tests against database "${name}": its name must end in "_test"`,
		);
	}
	return url;
}
