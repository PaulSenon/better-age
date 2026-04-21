import { Clock, Effect, Option } from "effect";
import { getSelfIdentity } from "../../domain/home/HomeState.js";
import { getRotationDueAt } from "../../domain/home/RotationSchedule.js";
import type {
	KnownIdentity,
	RetiredKey,
	SelfIdentity,
} from "../../domain/identity/Identity.js";
import {
	getLocalAlias,
	materializeSelfIdentity,
} from "../../domain/identity/Identity.js";
import {
	derivePublicIdentityFingerprint,
	derivePublicIdentityHandle,
} from "../../domain/identity/PublicIdentity.js";
import { HomeRepository } from "../../port/HomeRepository.js";
import type {
	HomeStateDecodeError,
	HomeStateLoadError,
} from "../../port/HomeRepositoryError.js";
import { InspectHomeIdentitiesPersistenceError } from "./InspectHomeIdentitiesError.js";

const toPersistenceError = (error: HomeStateDecodeError | HomeStateLoadError) =>
	new InspectHomeIdentitiesPersistenceError({
		message: error.message,
	});

type MeInspection = {
	readonly displayName: SelfIdentity["displayName"];
	readonly fingerprint: SelfIdentity["fingerprint"];
	readonly handle: SelfIdentity["handle"];
	readonly identityUpdatedAt: SelfIdentity["identityUpdatedAt"];
	readonly ownerId: SelfIdentity["ownerId"];
	readonly rotationStatus: {
		readonly dueAt: string;
		readonly isOverdue: boolean;
	};
	readonly rotationTtl: "1w" | "1m" | "3m" | "6m" | "9m" | "1y";
	readonly status: "active";
};

type KnownIdentityInspection = {
	readonly displayName: KnownIdentity["displayName"];
	readonly fingerprint: KnownIdentity["fingerprint"];
	readonly handle: KnownIdentity["handle"];
	readonly identityUpdatedAt: KnownIdentity["identityUpdatedAt"];
	readonly localAlias: KnownIdentity["localAlias"];
};

type RetiredKeyInspection = {
	readonly fingerprint: RetiredKey["fingerprint"];
	readonly retiredAt: RetiredKey["retiredAt"];
};

export type HomeIdentityInspection = {
	readonly knownIdentities: ReadonlyArray<KnownIdentityInspection>;
	readonly me: Option.Option<MeInspection>;
	readonly retiredKeyCount: number;
	readonly retiredKeys: ReadonlyArray<RetiredKeyInspection>;
	readonly rotationTtl: "1w" | "1m" | "3m" | "6m" | "9m" | "1y";
};

export class InspectHomeIdentities extends Effect.Service<InspectHomeIdentities>()(
	"InspectHomeIdentities",
	{
		accessors: true,
		effect: Effect.gen(function* () {
			const homeRepository = yield* HomeRepository;

			const execute = Effect.gen(function* () {
				const state = yield* homeRepository.loadState.pipe(
					Effect.mapError(toPersistenceError),
				);
				const now = yield* Clock.currentTimeMillis;
				const selfIdentity = getSelfIdentity(state);

				return {
					knownIdentities: state.knownIdentities.map((identity) => ({
						displayName: identity.displayName,
						fingerprint: derivePublicIdentityFingerprint(identity),
						handle: derivePublicIdentityHandle(identity),
						identityUpdatedAt: identity.identityUpdatedAt,
						localAlias: getLocalAlias(state.localAliases, identity.ownerId),
					})),
					me: Option.map(selfIdentity, (identity) => {
						const resolvedSelfIdentity = materializeSelfIdentity(identity);
						const dueAt = getRotationDueAt(
							resolvedSelfIdentity.identityUpdatedAt,
							state.rotationTtl,
						);

						return {
							displayName: resolvedSelfIdentity.displayName,
							fingerprint: resolvedSelfIdentity.fingerprint,
							handle: resolvedSelfIdentity.handle,
							identityUpdatedAt: resolvedSelfIdentity.identityUpdatedAt,
							ownerId: resolvedSelfIdentity.ownerId,
							rotationStatus: {
								dueAt,
								isOverdue: new Date(dueAt).getTime() <= now,
							},
							rotationTtl: state.rotationTtl,
							status: "active" as const,
						};
					}),
					retiredKeyCount: state.retiredKeys.length,
					retiredKeys: state.retiredKeys.map((key) => ({
						fingerprint: key.fingerprint,
						retiredAt: key.retiredAt,
					})),
					rotationTtl: state.rotationTtl,
				} satisfies HomeIdentityInspection;
			}).pipe(Effect.withSpan("InspectHomeIdentities.execute"));

			return { execute };
		}),
	},
) {}
