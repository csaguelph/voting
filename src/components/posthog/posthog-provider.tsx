"use client";

import { env } from "@/env";
import { useSession } from "next-auth/react";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
	const { data: session, status } = useSession();

	useEffect(() => {
		// Only initialize if env vars are provided
		if (!env.NEXT_PUBLIC_POSTHOG_KEY || !env.NEXT_PUBLIC_POSTHOG_HOST) {
			return;
		}

		posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
			api_host: "/ingest",
			ui_host: "https://us.posthog.com",
			person_profiles: "identified_only",
			capture_pageview: true, // Automatic pageview tracking
			capture_pageleave: true,
			disable_session_recording: true, // Don't record sessions for privacy
		});
	}, []);

	// Identify user when they sign in
	useEffect(() => {
		if (
			!env.NEXT_PUBLIC_POSTHOG_KEY ||
			!env.NEXT_PUBLIC_POSTHOG_HOST ||
			status === "loading"
		) {
			return;
		}

		if (session?.user) {
			posthog.identify(session.user.id, {
				email: session.user.email,
				name: session.user.name,
				role: session.user.role,
			});
		} else {
			// Reset user when they sign out
			posthog.reset();
		}
	}, [session, status]);

	// If PostHog is not configured, just render children without the provider
	if (!env.NEXT_PUBLIC_POSTHOG_KEY || !env.NEXT_PUBLIC_POSTHOG_HOST) {
		return <>{children}</>;
	}

	return <PHProvider client={posthog}>{children}</PHProvider>;
}
