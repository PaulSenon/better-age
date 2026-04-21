import { Effect, Option, Schema } from "effect";
import { getSelfIdentity } from "../../domain/home/HomeState.js";
import {
	encodeIdentityString,
	type IdentityString,
	IdentityStringPayload,
	toIdentityStringPayload,
} from "../../domain/identity/IdentityString.js";
import { HomeRepository } from "../../port/HomeRepository.js";
import type {
	HomeStateDecodeError,
	HomeStateLoadError,
} from "../../port/HomeRepositoryError.js";
import {
	ExportIdentityStringNotSetUpError,
	ExportIdentityStringPersistenceError,
} from "./ExportIdentityStringError.js";

const toPersistenceError = (error: HomeStateDecodeError | HomeStateLoadError) =>
	new ExportIdentityStringPersistenceError({
		message: error.message,
	});

export class ExportIdentityString extends Effect.Service<ExportIdentityString>()(
	"ExportIdentityString",
	{
		accessors: true,
		effect: Effect.gen(function* () {
			const homeRepository = yield* HomeRepository;

			const execute = homeRepository.loadState.pipe(
				Effect.mapError(toPersistenceError),
				Effect.flatMap((state) => {
					const selfIdentity = getSelfIdentity(state);

					if (Option.isNone(selfIdentity)) {
						return Effect.fail(
							new ExportIdentityStringNotSetUpError({
								message: "No local identity is configured",
							}),
						);
					}

					return Schema.decodeUnknown(
						IdentityStringPayload,
					)(toIdentityStringPayload(selfIdentity.value.publicIdentity)).pipe(
						Effect.map(encodeIdentityString),
						Effect.orDie,
					);
				}),
				Effect.withSpan("ExportIdentityString.execute"),
			);

			return {
				execute: execute as Effect.Effect<
					Schema.Schema.Type<typeof IdentityString>,
					| ExportIdentityStringNotSetUpError
					| ExportIdentityStringPersistenceError
				>,
			};
		}),
	},
) {}
