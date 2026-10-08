import {
	defaultShouldDehydrateQuery,
	QueryClient,
} from "@tanstack/react-query";
import SuperJSON from "superjson";

const MAX_RETRIES = 3;

/**
 * Retry failed queries, except refusals (not found, not allowed, not
 * published yet) that would only fail again and delay the error message.
 */
export function shouldRetryQuery(failureCount: number, error: unknown) {
	const status = (error as { data?: { httpStatus?: unknown } } | null)?.data
		?.httpStatus;
	const isRefusal =
		typeof status === "number" &&
		status >= 400 &&
		status < 500 &&
		status !== 408 &&
		status !== 429;
	return !isRefusal && failureCount < MAX_RETRIES;
}

export const createQueryClient = () =>
	new QueryClient({
		defaultOptions: {
			queries: {
				// With SSR, we usually want to set some default staleTime
				// above 0 to avoid refetching immediately on the client
				staleTime: 30 * 1000,
				retry: shouldRetryQuery,
			},
			dehydrate: {
				serializeData: SuperJSON.serialize,
				shouldDehydrateQuery: (query) =>
					defaultShouldDehydrateQuery(query) ||
					query.state.status === "pending",
			},
			hydrate: {
				deserializeData: SuperJSON.deserialize,
			},
		},
	});
