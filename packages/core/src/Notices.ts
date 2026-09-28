// Side-channel warnings Core raises while still succeeding (e.g. it repaired
// loose file permissions). The CLI provides a renderer; default is silent.
import { Context, Effect } from "effect";

export type Notice =
	| { readonly code: "LOCAL_PERMISSIONS_REPAIRED"; readonly path: string }
	| { readonly code: "RETIRED_KEY_UNREADABLE"; readonly fingerprint: string };

export const Notices = Context.Reference<{
	readonly report: (notice: Notice) => Effect.Effect<void>;
}>("@better-age/core/Notices", {
	defaultValue: () => ({ report: () => Effect.void }),
});

export const report = Effect.fnUntraced(function* (notice: Notice) {
	const notices = yield* Notices;
	yield* notices.report(notice);
});
