import { describe, expect, it } from "vitest";
import { isPayloadCandidateName } from "./nodeCli.js";

describe("node CLI payload discovery", () => {
	it("matches default and named encrypted env payloads", () => {
		expect(isPayloadCandidateName(".env.enc")).toBe(true);
		expect(isPayloadCandidateName(".env.local.enc")).toBe(true);
		expect(isPayloadCandidateName(".env.production.enc")).toBe(true);
		expect(isPayloadCandidateName(".env")).toBe(false);
		expect(isPayloadCandidateName("env.local.enc")).toBe(false);
	});
});
