import { PrismaAdapter } from "@auth/prisma-adapter";
import type { DefaultSession, NextAuthConfig } from "next-auth";
import type { Adapter } from "next-auth/adapters";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

import { env } from "@/env";
import { db } from "@/server/db";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
	interface Session extends DefaultSession {
		user: {
			id: string;
			role: "STUDENT" | "ADMIN" | "CRO";
		} & DefaultSession["user"];
	}

	interface User {
		role: "STUDENT" | "ADMIN" | "CRO";
	}
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
	providers: [
		MicrosoftEntraID({
			clientId: env.AZURE_AD_CLIENT_ID,
			clientSecret: env.AZURE_AD_CLIENT_SECRET,
			issuer: `https://login.microsoftonline.com/${env.AZURE_AD_TENANT_ID}/v2.0`,
			authorization: {
				params: {
					scope: "openid profile email User.Read",
				},
			},
		}),
	],
	adapter: PrismaAdapter(db) as Adapter,
	callbacks: {
		session: ({ session, user }) => ({
			...session,
			user: {
				...session.user,
				id: user.id,
				role: user.role,
			},
		}),
	},
	pages: {
		signIn: "/auth/signin",
		error: "/auth/error",
	},
} satisfies NextAuthConfig;
