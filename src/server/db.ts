import { PrismaClient } from "@prisma/client";
import { fieldEncryptionExtension } from "prisma-field-encryption";

import { env } from "@/env";

// Create base client
const createBaseClient = () =>
	new PrismaClient({
		log:
			env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
	});

// Type for the extended client (maintains base client compatibility)
type ExtendedPrismaClient = ReturnType<typeof createBaseClient>;

const createPrismaClient = (): ExtendedPrismaClient => {
	const client = createBaseClient();

	// Add field encryption middleware only if encryption key is provided
	// This allows CI/build environments to work without a real encryption key
	if (env.PRISMA_FIELD_ENCRYPTION_KEY) {
		// Extension doesn't change the public API, only adds transparent encryption
		return client.$extends(
			fieldEncryptionExtension({
				encryptionKey: env.PRISMA_FIELD_ENCRYPTION_KEY,
			}),
		) as ExtendedPrismaClient;
	}

	// In CI/build without encryption key, log warning and return unencrypted client
	if (process.env.SKIP_ENV_VALIDATION) {
		console.warn(
			"⚠️  WARNING: Running without field encryption (SKIP_ENV_VALIDATION is set)",
		);
	}

	return client;
};

const globalForPrisma = globalThis as unknown as {
	prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;
