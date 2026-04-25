import { Effect, type Option } from "effect";
import { ResolvePayloadTarget } from "../../app/shared/ResolvePayloadTarget.js";
import type { ResolvePayloadTargetError } from "../../app/shared/ResolvePayloadTargetError.js";
import type { PromptReadAbortedError } from "../../port/PromptError.js";
import { GuidedFlowCancelledError } from "../../shared/GuidedFlowCancelledError.js";

export type PayloadMutationBackTarget = "current-path" | "path";

export type PayloadMutationFlowStep<A> =
	| { readonly _tag: "done"; readonly value: A }
	| { readonly _tag: "back"; readonly target: PayloadMutationBackTarget }
	| { readonly _tag: "cancel" };

export const payloadMutationDone = <A>(
	value: A,
): PayloadMutationFlowStep<A> => ({
	_tag: "done",
	value,
});

export const payloadMutationBack = (
	target: PayloadMutationBackTarget,
): { readonly _tag: "back"; readonly target: PayloadMutationBackTarget } => ({
	_tag: "back",
	target,
});

export const payloadMutationCancel = (): { readonly _tag: "cancel" } => ({
	_tag: "cancel",
});

export const runResolvedPayloadMutationFlow = <A, E, R>(input: {
	readonly path: Option.Option<string>;
	readonly runAtPath: (
		resolvedPath: string,
	) => Effect.Effect<PayloadMutationFlowStep<A>, E, R>;
}): Effect.Effect<
	A,
	| E
	| GuidedFlowCancelledError
	| PromptReadAbortedError
	| ResolvePayloadTargetError,
	R | ResolvePayloadTarget
> => {
	const resolvePath = () =>
		ResolvePayloadTarget.resolveExistingPath(input.path);

	const runAtResolvedPath = (
		resolvedPath: string,
	): Effect.Effect<
		A,
		| E
		| GuidedFlowCancelledError
		| PromptReadAbortedError
		| ResolvePayloadTargetError,
		R | ResolvePayloadTarget
	> =>
		input.runAtPath(resolvedPath).pipe(
			Effect.flatMap((step) => {
				switch (step._tag) {
					case "done":
						return Effect.succeed(step.value);
					case "back":
						return step.target === "current-path"
							? runAtResolvedPath(resolvedPath)
							: resolvePath().pipe(Effect.flatMap(runAtResolvedPath));
					case "cancel":
						return Effect.fail(new GuidedFlowCancelledError());
					default: {
						const _exhaustive: never = step;
						return _exhaustive;
					}
				}
			}),
		);

	return resolvePath().pipe(Effect.flatMap(runAtResolvedPath));
};
