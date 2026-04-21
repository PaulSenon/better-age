import { Effect, Either, Option } from "effect";
import type { HomeState } from "../../domain/home/HomeState.js";
import { isSelfOwnerId } from "../../domain/home/SelfIdentityGuard.js";
import {
	getLocalAlias,
	materializeKnownIdentity,
	setLocalAlias,
	type KnownIdentity,
} from "../../domain/identity/Identity.js";
import type { IdentityAlias } from "../../domain/identity/IdentityAlias.js";
import { decodeIdentityString } from "../../domain/identity/IdentityString.js";
import { derivePublicIdentityHandle } from "../../domain/identity/PublicIdentity.js";
import { HomeRepository } from "../../port/HomeRepository.js";
import type {
	HomeStateDecodeError,
	HomeStateLoadError,
	HomeStateSaveError,
} from "../../port/HomeRepositoryError.js";
import {
	ImportIdentityStringConflictError,
	ImportIdentityStringDecodeError,
	ImportIdentityStringForbiddenSelfError,
	ImportIdentityStringPersistenceError,
	ImportIdentityStringSuccess,
} from "./ImportIdentityStringError.js";

const toPersistenceError = (
	error: HomeStateDecodeError | HomeStateLoadError | HomeStateSaveError,
) =>
	new ImportIdentityStringPersistenceError({
		message: error.message,
	});

const toKnownIdentity = (
	payload: ReturnType<typeof decodeIdentityString> extends Either.Either<
		infer A,
		unknown
	>
		? A
		: never,
): KnownIdentity => {
	return {
		displayName: payload.displayName,
		identityUpdatedAt: payload.identityUpdatedAt,
		ownerId: payload.ownerId,
		publicKey: payload.publicKey,
	};
};

const sameSnapshot = (left: KnownIdentity, right: KnownIdentity) =>
	left.displayName === right.displayName &&
	left.identityUpdatedAt === right.identityUpdatedAt &&
	left.ownerId === right.ownerId &&
	left.publicKey === right.publicKey;

const replaceKnownIdentity = (
	state: HomeState,
	nextIdentity: KnownIdentity,
): HomeState => ({
	...state,
	knownIdentities: state.knownIdentities.map((identity) =>
		identity.ownerId === nextIdentity.ownerId ? nextIdentity : identity,
	),
});

const nextLocalAlias = (input: {
	readonly existingLocalAlias: Option.Option<IdentityAlias>;
	readonly overrideLocalAlias: Option.Option<IdentityAlias> | undefined;
}) =>
	input.overrideLocalAlias === undefined
		? input.existingLocalAlias
		: input.overrideLocalAlias;

export class ImportIdentityString extends Effect.Service<ImportIdentityString>()(
	"ImportIdentityString",
	{
		accessors: true,
		effect: Effect.gen(function* () {
			const homeRepository = yield* HomeRepository;

			const execute = Effect.fn("ImportIdentityString.execute")(
				function* (input: {
					readonly identityString: string;
					readonly localAlias?: Option.Option<IdentityAlias>;
				}) {
					const decoded = decodeIdentityString(input.identityString);

					if (Either.isLeft(decoded)) {
						return yield* new ImportIdentityStringDecodeError({
							message: "Identity string is malformed",
						});
					}

					const importedIdentity = toKnownIdentity(decoded.right);
					const state = yield* homeRepository.loadState.pipe(
						Effect.mapError(toPersistenceError),
					);

					if (isSelfOwnerId(state, importedIdentity.ownerId)) {
						return yield* new ImportIdentityStringForbiddenSelfError({
							message: "Cannot import your own identity string",
						});
					}

					const existingIdentity = state.knownIdentities.find(
						(identity) => identity.ownerId === importedIdentity.ownerId,
					);

					if (existingIdentity === undefined) {
						const nextLocalAliases = setLocalAlias({
							localAlias: nextLocalAlias({
								existingLocalAlias: Option.none(),
								overrideLocalAlias: input.localAlias,
							}),
							localAliases: state.localAliases,
							ownerId: importedIdentity.ownerId,
						});

						yield* homeRepository
							.saveState({
								...state,
								knownIdentities: [...state.knownIdentities, importedIdentity],
								localAliases: nextLocalAliases,
							})
							.pipe(Effect.mapError(toPersistenceError));

						return new ImportIdentityStringSuccess({
							displayName: importedIdentity.displayName,
							handle: derivePublicIdentityHandle(importedIdentity),
							outcome: "added",
						});
					}

					if (sameSnapshot(existingIdentity, importedIdentity)) {
						return new ImportIdentityStringSuccess({
							displayName: importedIdentity.displayName,
							handle: derivePublicIdentityHandle(importedIdentity),
							outcome: "unchanged",
						});
					}

					if (
						existingIdentity.identityUpdatedAt ===
						importedIdentity.identityUpdatedAt
					) {
						return yield* new ImportIdentityStringConflictError({
							message:
								"Identity string conflicts with an existing known identity snapshot",
							ownerId: importedIdentity.ownerId,
						});
					}

					if (
						existingIdentity.identityUpdatedAt >
						importedIdentity.identityUpdatedAt
					) {
						const existingResolvedIdentity = materializeKnownIdentity({
							identity: existingIdentity,
							localAliases: state.localAliases,
						});

						return new ImportIdentityStringSuccess({
							displayName: existingResolvedIdentity.displayName,
							handle: existingResolvedIdentity.handle,
							outcome: "unchanged",
						});
					}

					const nextLocalAliases = setLocalAlias({
						localAlias: nextLocalAlias({
							existingLocalAlias: getLocalAlias(
								state.localAliases,
								existingIdentity.ownerId,
							),
							overrideLocalAlias: input.localAlias,
						}),
						localAliases: state.localAliases,
						ownerId: importedIdentity.ownerId,
					});

					yield* homeRepository
						.saveState({
							...replaceKnownIdentity(state, importedIdentity),
							localAliases: nextLocalAliases,
						})
						.pipe(Effect.mapError(toPersistenceError));

					return new ImportIdentityStringSuccess({
						displayName: importedIdentity.displayName,
						handle: derivePublicIdentityHandle(importedIdentity),
						outcome: "updated",
					});
				},
			);

			return { execute };
		}),
	},
) {}
