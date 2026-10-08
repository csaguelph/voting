import { describe, expect, it } from "vitest";
import { getAuditActor } from "./actor";

describe("getAuditActor", () => {
	it.each([
		[
			{ userEmail: "a@uoguelph.ca", userRole: "ADMIN" },
			"a@uoguelph.ca",
			"ADMIN",
		],
		[
			{ performedBy: "id", performedByEmail: "b@uoguelph.ca" },
			"b@uoguelph.ca",
			null,
		],
		[{ finalizedBy: "c@uoguelph.ca" }, "c@uoguelph.ca", null],
		[{ publishedBy: "d@uoguelph.ca" }, "d@uoguelph.ca", null],
		[{ unpublishedBy: "e@uoguelph.ca" }, "e@uoguelph.ca", null],
		[{ generatedBy: "f@uoguelph.ca" }, "f@uoguelph.ca", null],
		[{ exportedBy: "g@uoguelph.ca" }, "g@uoguelph.ca", null],
		[{ drawnBy: "h@uoguelph.ca" }, "h@uoguelph.ca", null],
	])("finds the actor in %j", (details, email, role) => {
		expect(getAuditActor(details)).toEqual({ email, role });
	});

	it.each([[{}], [null], [{ userEmail: "" }], [{ userEmail: 42 }]])(
		"returns no actor for %j",
		(details) => {
			expect(getAuditActor(details)).toEqual({ email: null, role: null });
		},
	);
});
