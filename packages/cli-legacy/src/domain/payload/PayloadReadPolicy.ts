import type { PayloadNeedsUpdate } from "./PayloadNeedsUpdate.js";

export type PayloadReadPreflightResult =
	| {
			readonly _tag: "ok";
	  }
	| {
			readonly _tag: "tty-refused";
	  }
	| {
			readonly _tag: "update-required";
			readonly reason: PayloadNeedsUpdate["reason"];
	  };

export const getPayloadReadPreflight = (input: {
	readonly forceTty: boolean;
	readonly needsUpdate: PayloadNeedsUpdate;
	readonly stdoutIsTty: boolean;
}): PayloadReadPreflightResult => {
	if (input.stdoutIsTty && !input.forceTty) {
		return {
			_tag: "tty-refused",
		};
	}

	if (input.needsUpdate.isRequired) {
		return {
			_tag: "update-required",
			reason: input.needsUpdate.reason,
		};
	}

	return {
		_tag: "ok",
	};
};
