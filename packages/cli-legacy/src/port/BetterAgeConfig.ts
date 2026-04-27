import { Effect } from "effect";

const missingBetterAgeConfig = {
	homeRootDirectory: "",
};

export class BetterAgeConfig extends Effect.Service<BetterAgeConfig>()(
	"BetterAgeConfig",
	{
		accessors: true,
		succeed: missingBetterAgeConfig,
	},
) {}
