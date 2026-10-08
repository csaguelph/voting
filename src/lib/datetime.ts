/**
 * App-wide datetime handling in America/Toronto.
 * All user-entered times are interpreted as Toronto time; all stored values are UTC.
 * Use these helpers so display and input are consistent regardless of server/browser TZ.
 */

export const APP_TIMEZONE = "America/Toronto" as const;

const TZ_OPTS: Intl.DateTimeFormatOptions = {
	timeZone: APP_TIMEZONE,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit",
	hour12: false,
};

/**
 * Format a Date (UTC) for display in the app timezone (America/Toronto).
 * Use for any user-visible datetime (e.g. election start/end, deadlines).
 */
export function formatInAppTz(
	date: Date,
	options?: Intl.DateTimeFormatOptions,
): string {
	const opts = { ...TZ_OPTS, ...options };
	return new Date(date).toLocaleString("en-CA", opts);
}

/**
 * Format a Date for display as date only in the app timezone.
 */
export function formatDateInAppTz(
	date: Date,
	options?: Intl.DateTimeFormatOptions,
): string {
	return new Date(date).toLocaleDateString("en-CA", {
		timeZone: APP_TIMEZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		...options,
	});
}

/**
 * Format a Date for display as time only in the app timezone.
 */
export function formatTimeInAppTz(date: Date): string {
	return new Date(date).toLocaleTimeString("en-CA", {
		timeZone: APP_TIMEZONE,
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
}

/**
 * Return offset in minutes to add to Toronto local time to get UTC, as of the
 * given instant (240 during EDT, 300 during EST).
 */
function getOffsetMinutesAt(instantMs: number): number {
	const formatter = new Intl.DateTimeFormat("en-CA", {
		timeZone: APP_TIMEZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	});
	const parts = formatter.formatToParts(new Date(instantMs));
	const part = (type: Intl.DateTimeFormatPartTypes) =>
		Number(parts.find((p) => p.type === type)?.value ?? 0);
	const torontoWallClockMs = Date.UTC(
		part("year"),
		part("month") - 1,
		part("day"),
		part("hour"),
		part("minute"),
	);
	return Math.round((instantMs - torontoWallClockMs) / 60000);
}

/**
 * Parse a date string (YYYY-MM-DD) and time string (HH:mm) as local time in
 * America/Toronto and return a Date (UTC). Use when the user enters a date/time
 * that should be interpreted as Toronto (e.g. election start/end in the form).
 */
export function parseLocalDateTimeInAppTz(
	dateStr: string,
	timeStr: string,
): Date {
	const dateParts = dateStr.split("-").map(Number);
	const y = dateParts[0] ?? 0;
	const m = (dateParts[1] ?? 1) - 1;
	const d = dateParts[2] ?? 1;
	const timeParts = timeStr.split(":").map(Number);
	const hr = timeParts[0] ?? 0;
	const min = timeParts[1] ?? 0;
	const wallClockMs = Date.UTC(y, m, d, hr, min, 0);
	// Two passes: the offset depends on the instant, which depends on the
	// offset. This handles times on daylight saving transition days.
	const firstGuessMs = wallClockMs + getOffsetMinutesAt(wallClockMs) * 60000;
	return new Date(wallClockMs + getOffsetMinutesAt(firstGuessMs) * 60000);
}

/**
 * Format a Date for use as value in <input type="date"> (YYYY-MM-DD) in app TZ.
 */
export function formatDateForInput(date: Date): string {
	const formatter = new Intl.DateTimeFormat("en-CA", {
		timeZone: APP_TIMEZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
	const fmtParts = formatter.formatToParts(new Date(date));
	const y = fmtParts.find((p) => p.type === "year")?.value ?? "";
	const m = fmtParts.find((p) => p.type === "month")?.value ?? "";
	const d = fmtParts.find((p) => p.type === "day")?.value ?? "";
	return `${y}-${m}-${d}`;
}

/**
 * Format a Date for use as value in <input type="time"> (HH:mm) in app TZ.
 */
export function formatTimeForInput(date: Date): string {
	return formatTimeInAppTz(new Date(date));
}

/**
 * Format a Date for use as value in <input type="datetime-local"> (YYYY-MM-DDTHH:mm) in app TZ.
 */
export function formatDateTimeLocalForInput(date: Date): string {
	const d = new Date(date);
	const datePart = formatDateForInput(d);
	const timePart = formatTimeForInput(d);
	return `${datePart}T${timePart}`;
}

/**
 * Parse a datetime-local value (YYYY-MM-DDTHH:mm) as America/Toronto and return a Date (UTC).
 * Use when the user picks a datetime in a datetime-local input that represents Toronto time.
 */
export function parseDateTimeLocalInAppTz(value: string): Date {
	const [dateStr, timeStr] = value.split("T");
	if (!dateStr || !timeStr) {
		return new Date(value);
	}
	return parseLocalDateTimeInAppTz(dateStr, timeStr.slice(0, 5));
}
