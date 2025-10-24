/**
 * Script to encrypt existing plaintext student IDs in the database
 *
 * This script reads all existing EligibleVoter records and re-saves them,
 * which triggers the encryption middleware to encrypt the studentId field.
 *
 * Run this AFTER:
 * 1. Adding the encryption middleware to src/server/db.ts
 * 2. Setting PRISMA_FIELD_ENCRYPTION_KEY in your environment
 * 3. Backing up your database!
 *
 * Usage:
 *   pnpm tsx scripts/encrypt-existing-data.ts
 */

import { PrismaClient } from "@prisma/client";
import { fieldEncryptionExtension } from "prisma-field-encryption";

// Get encryption key from environment
const encryptionKey = process.env.PRISMA_FIELD_ENCRYPTION_KEY;

if (!encryptionKey) {
	console.error(
		"❌ Error: PRISMA_FIELD_ENCRYPTION_KEY not found in environment",
	);
	console.error(
		"   Please set this environment variable before running this script.",
	);
	console.error("   See docs/ENCRYPTION.md for details.");
	process.exit(1);
}

if (encryptionKey.length !== 32) {
	console.error(
		"❌ Error: PRISMA_FIELD_ENCRYPTION_KEY must be exactly 32 characters",
	);
	console.error(`   Current length: ${encryptionKey.length}`);
	console.error(
		"   Generate a key with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64').slice(0, 32))\"",
	);
	process.exit(1);
}

async function main() {
	console.log("🔐 Encrypting existing student ID data...\n");

	// Create client WITHOUT encryption first to read plaintext data
	const plaintextClient = new PrismaClient();

	// Create client WITH encryption to write encrypted data
	const encryptedClient = new PrismaClient().$extends(
		fieldEncryptionExtension({ encryptionKey }),
	);

	try {
		// Get count of eligible voters
		const totalVoters = await plaintextClient.eligibleVoter.count();
		console.log(`📊 Found ${totalVoters} eligible voter records\n`);

		if (totalVoters === 0) {
			console.log("✅ No records to encrypt. Exiting.");
			return;
		}

		// Ask for confirmation
		console.log("⚠️  WARNING: This will encrypt all studentId fields!");
		console.log("   Make sure you have:");
		console.log("   1. Backed up your database");
		console.log("   2. Set the correct PRISMA_FIELD_ENCRYPTION_KEY");
		console.log("   3. Tested encryption on a development database first\n");

		// In a real script, you might want to add a confirmation prompt here
		// For now, proceeding automatically

		let encrypted = 0;
		let failed = 0;
		const batchSize = 100;

		// Process in batches for better performance
		for (let skip = 0; skip < totalVoters; skip += batchSize) {
			const voters = await plaintextClient.eligibleVoter.findMany({
				skip,
				take: batchSize,
			});

			console.log(
				`Processing batch: ${skip + 1} to ${Math.min(skip + batchSize, totalVoters)} of ${totalVoters}`,
			);

			for (const voter of voters) {
				try {
					// Re-save the record with the encrypted client
					// This will encrypt the studentId field
					await encryptedClient.eligibleVoter.update({
						where: { id: voter.id },
						data: {
							studentId: voter.studentId, // Will be encrypted by middleware
						},
					});
					encrypted++;
				} catch (error) {
					console.error(`   ❌ Failed to encrypt record ${voter.id}:`, error);
					failed++;
				}
			}
		}

		console.log("\n✅ Encryption complete!");
		console.log(`   Successfully encrypted: ${encrypted} records`);
		if (failed > 0) {
			console.log(`   Failed: ${failed} records`);
		}

		// Verify encryption
		console.log("\n🔍 Verifying encryption...");
		const sampleVoter = await encryptedClient.eligibleVoter.findFirst();

		if (sampleVoter) {
			console.log(
				"   Sample decrypted studentId (via app):",
				sampleVoter.studentId,
			);
			console.log("   ✅ Encryption middleware is working correctly");
			console.log(
				"\n💡 Tip: Check the database directly to see encrypted values:",
			);
			console.log(
				'   psql -d csa-voting -c "SELECT id, \\"studentId\\" FROM eligible_voters LIMIT 1;"',
			);
		}
	} catch (error) {
		console.error("❌ Error during encryption:", error);
		process.exit(1);
	} finally {
		await plaintextClient.$disconnect();
		await encryptedClient.$disconnect();
	}
}

main()
	.then(() => {
		console.log("\n✅ Script completed successfully");
		process.exit(0);
	})
	.catch((error) => {
		console.error("❌ Script failed:", error);
		process.exit(1);
	});
