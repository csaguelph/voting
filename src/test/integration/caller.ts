import type { UserRole } from "@prisma/client";
import { createCaller } from "@/server/api/root";
import { db } from "@/server/db";

let userCount = 0;

export async function createUser(
	role: UserRole,
	email = `${role.toLowerCase()}-${++userCount}@uoguelph.ca`,
) {
	return db.user.create({ data: { email, name: `Test ${role}`, role } });
}

type SessionUser = Awaited<ReturnType<typeof createUser>>;

/** A tRPC caller with the given user's session, or anonymous for null */
export function callerFor(user: SessionUser | null) {
	return createCaller({
		db,
		headers: new Headers(),
		session: user
			? {
					user: {
						id: user.id,
						email: user.email,
						name: user.name,
						role: user.role,
					},
					expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
				}
			: null,
	});
}

/** Create a user with the given role and return a caller signed in as them */
export async function signedInAs(role: UserRole, email?: string) {
	const user = await createUser(role, email);
	return { user, caller: callerFor(user) };
}

export const anonymous = () => callerFor(null);
