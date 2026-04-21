import { Effect, Either, Option } from "effect";
import type { HomeState } from "../../domain/home/HomeState.js";
import { isSelfOwnerId } from "../../domain/home/SelfIdentityGuard.js";
import type { KnownIdentity } from "../../domain/identity/Identity.js";
import type { IdentityAlias } from "../../domain/identity/IdentityAlias.js";
import { decodeIdentityString } from "../../domain/identity/IdentityString.js";
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
): KnownIdentity => ({
	displayName: payload.displayName,
	fingerprint: payload.fingerprint,
	handle: payload.handle,
	identityUpdatedAt: payload.identityUpdatedAt,
	localAlias: Option.none(),
	ownerId: payload.ownerId,
	publicKey: payload.publicKey,
});

const sameSnapshot = (left: KnownIdentity, right: KnownIdentity) =>
	left.displayName === right.displayName &&
	left.fingerprint === right.fingerprint &&
	left.handle === right.handle &&
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
	readonly existingLocalAlias: KnownIdentity["localAlias"];
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
						yield* homeRepository
							.saveState({
								...state,
								knownIdentities: [
									...state.knownIdentities,
									{
										...importedIdentity,
										localAlias: nextLocalAlias({
											existingLocalAlias: importedIdentity.localAlias,
											overrideLocalAlias: input.localAlias,
										}),
									},
								],
							})
							.pipe(Effect.mapError(toPersistenceError));

						return new ImportIdentityStringSuccess({
							displayName: importedIdentity.displayName,
							handle: importedIdentity.handle,
							outcome: "added",
						});
					}

					if (sameSnapshot(existingIdentity, importedIdentity)) {
						return new ImportIdentityStringSuccess({
							displayName: importedIdentity.displayName,
							handle: importedIdentity.handle,
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
						return new ImportIdentityStringSuccess({
							displayName: existingIdentity.displayName,
							handle: existingIdentity.handle,
							outcome: "unchanged",
						});
					}

					yield* homeRepository
						.saveState(
							replaceKnownIdentity(state, {
								...importedIdentity,
								localAlias: nextLocalAlias({
									existingLocalAlias: existingIdentity.localAlias,
									overrideLocalAlias: input.localAlias,
								}),
							}),
						)
						.pipe(Effect.mapError(toPersistenceError));

					return new ImportIdentityStringSuccess({
						displayName: importedIdentity.displayName,
						handle: importedIdentity.handle,
						outcome: "updated",
					});
				},
			);

			return { execute };
		}),
	},
) {}
