import { Effect, Option } from "effect";
import { resolveGrantIdentityRef } from "../../domain/identity/ResolveIdentityRef.js";
import { HomeRepository } from "../../port/HomeRepository.js";
import type {
	HomeStateDecodeError,
	HomeStateLoadError,
	HomeStateSaveError,
} from "../../port/HomeRepositoryError.js";
import {
	ForgetIdentityAmbiguousIdentityError,
	ForgetIdentityForbiddenSelfError,
	ForgetIdentityPersistenceError,
	ForgetIdentityRemovedSuccess,
	ForgetIdentityUnchangedSuccess,
} from "./ForgetIdentityError.js";

const toPersistenceError = (
	error: HomeStateDecodeError | HomeStateLoadError | HomeStateSaveError,
) =>
	new ForgetIdentityPersistenceError({
		message: error.message,
	});

export class ForgetIdentity extends Effect.Service<ForgetIdentity>()(
	"ForgetIdentity",
	{
		accessors: true,
		effect: Effect.gen(function* () {
			const homeRepository = yield* HomeRepository;

			const execute = Effect.fn("ForgetIdentity.execute")(function* (input: {
				readonly identityRef: string;
			}) {
				const state = yield* homeRepository.loadState.pipe(
					Effect.mapError(toPersistenceError),
				);
				const resolution = resolveGrantIdentityRef({
					identityRef: input.identityRef,
					knownIdentities: state.knownIdentities,
					localAliases: state.localAliases,
					selfIdentity: state.self,
				});

				switch (resolution._tag) {
					case "ambiguous":
						return yield* new ForgetIdentityAmbiguousIdentityError({
							candidates: resolution.candidates,
							identityRef: input.identityRef,
							message: "Identity ref is ambiguous",
						});
					case "not-found":
						return new ForgetIdentityUnchangedSuccess({
							identityRef: input.identityRef,
							reason: "identity-not-known",
						});
					case "resolved": {
						if (
							Option.isSome(state.self) &&
							state.self.value.publicIdentity.ownerId ===
								resolution.identity.ownerId
						) {
							return yield* new ForgetIdentityForbiddenSelfError({
								message: "Forgetting current self identity is forbidden in v0",
							});
						}

						const nextKnownIdentities = state.knownIdentities.filter(
							(identity) => identity.ownerId !== resolution.identity.ownerId,
						);

						if (nextKnownIdentities.length === state.knownIdentities.length) {
							return new ForgetIdentityUnchangedSuccess({
								identityRef: input.identityRef,
								reason: "identity-not-known",
							});
						}

						yield* homeRepository
							.saveState({
								...state,
								knownIdentities: nextKnownIdentities,
								localAliases: Object.fromEntries(
									Object.entries(state.localAliases).filter(
										([ownerId]) => ownerId !== resolution.identity.ownerId,
									),
								),
							})
							.pipe(Effect.mapError(toPersistenceError));

						return new ForgetIdentityRemovedSuccess({
							handle: resolution.identity.handle,
						});
					}
				}
			});

			return { execute };
		}),
	},
) {}
