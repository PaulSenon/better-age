import { Option } from "effect";
import { describe, expect, it } from "vitest";
import { getPayloadReadPreflight } from "./PayloadReadPolicy.js";

describe("PayloadReadPolicy", () => {
	it("refuses tty stdout by default", () => {
		expect(
			getPayloadReadPreflight({
				forceTty: false,
				needsUpdate: {
					isRequired: false,
					reason: Option.none(),
				},
				stdoutIsTty: true,
			}),
		).toEqual({
			_tag: "tty-refused",
		});
	});

	it("allows force-tty when no update is required", () => {
		expect(
			getPayloadReadPreflight({
				forceTty: true,
				needsUpdate: {
					isRequired: false,
					reason: Option.none(),
				},
				stdoutIsTty: true,
			}),
		).toEqual({
			_tag: "ok",
		});
	});

	it("allows non-tty stdout when no update is required", () => {
		expect(
			getPayloadReadPreflight({
				forceTty: false,
				needsUpdate: {
					isRequired: false,
					reason: Option.none(),
				},
				stdoutIsTty: false,
			}),
		).toEqual({
			_tag: "ok",
		});
	});

	it("requires update before read", () => {
		expect(
			getPayloadReadPreflight({
				forceTty: false,
				needsUpdate: {
					isRequired: true,
					reason: Option.some("self key is stale"),
				},
				stdoutIsTty: false,
			}),
		).toEqual({
			_tag: "update-required",
			reason: Option.some("self key is stale"),
		});
	});

	it("does not let force-tty bypass update-required", () => {
		expect(
			getPayloadReadPreflight({
				forceTty: true,
				needsUpdate: {
					isRequired: true,
					reason: Option.some("self key is stale"),
				},
				stdoutIsTty: true,
			}),
		).toEqual({
			_tag: "update-required",
			reason: Option.some("self key is stale"),
		});
	});
});
