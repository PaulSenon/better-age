// Use cases about public identities: sharing ours, importing and forgetting
// other people's.
import { Effect } from "effect";
import {
	decodeIdentityString,
	encodeIdentityString,
	type PublicIdentity,
} from "./artifacts/PublicIdentity.js";
import {
	forgetKnownIdentity,
	importKnownIdentity,
	selfPublicIdentity,
	toKnownIdentity,
} from "./domain/Identity.js";
import type { IdentityStringInvalid } from "./Errors.js";
import { requireHome } from "./Home.js";
import { HomeStore } from "./services/HomeStore.js";

export const exportIdentityString = Effect.map(requireHome, (home) =>
	encodeIdentityString(selfPublicIdentity(home)),
);

export const parseIdentityString = (
	identityString: string,
): Effect.Effect<PublicIdentity, IdentityStringInvalid> =>
	Effect.fromResult(decodeIdentityString(identityString));

export const knownIdentities = Effect.map(requireHome, (home) =>
	home.knownIdentities.map(toKnownIdentity),
);

export const importIdentity = Effect.fn("Identities.importIdentity")(
	function* (input: {
		readonly identityString: string;
		readonly localAlias?: string | null | undefined;
		readonly trustKeyUpdate?: boolean | undefined;
	}) {
		const home = yield* requireHome;
		const incoming = yield* parseIdentityString(input.identityString);
		const imported = yield* Effect.fromResult(
			importKnownIdentity(home, incoming, input),
		);

		yield* (yield* HomeStore).save(imported.home);

		return { identity: imported.identity, outcome: imported.outcome };
	},
);

export const forgetIdentity = Effect.fn("Identities.forgetIdentity")(function* (
	ownerId: string,
) {
	const home = yield* requireHome;

	yield* (yield* HomeStore).save(
		yield* Effect.fromResult(forgetKnownIdentity(home, ownerId)),
	);
});
