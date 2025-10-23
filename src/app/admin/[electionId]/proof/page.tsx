import { requireCRO } from "@/lib/auth/permissions";

import { ProofPageClient } from "./proof-client";

export default async function ProofPage({
	params,
}: {
	params: Promise<{ electionId: string }>;
}) {
	// Require CRO access for proof generation
	await requireCRO();

	const { electionId } = await params;

	return <ProofPageClient electionId={electionId} />;
}
