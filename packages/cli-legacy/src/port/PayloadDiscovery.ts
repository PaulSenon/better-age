import { Effect } from "effect";
import type { PayloadDiscoveryError } from "./PayloadDiscoveryError.js";

type PayloadDiscoveryShape = {
	readonly discoverFromCwd: Effect.Effect<
		ReadonlyArray<string>,
		PayloadDiscoveryError
	>;
};

const missingPayloadDiscovery = {
	discoverFromCwd: Effect.dieMessage(
		"PayloadDiscovery implementation not provided",
	) as Effect.Effect<ReadonlyArray<string>, PayloadDiscoveryError>,
} satisfies PayloadDiscoveryShape;

export class PayloadDiscovery extends Effect.Service<PayloadDiscovery>()(
	"PayloadDiscovery",
	{
		accessors: true,
		succeed: missingPayloadDiscovery,
	},
) {}
