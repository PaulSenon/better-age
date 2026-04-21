import { Effect } from "effect";
import { OpenPayload } from "../shared/OpenPayload.js";
import {
	ReadPayloadCryptoError,
	ReadPayloadEnvError,
	ReadPayloadEnvelopeError,
	ReadPayloadFileFormatError,
	ReadPayloadPersistenceError,
	ReadPayloadSuccess,
} from "./ReadPayloadError.js";

export class ReadPayload extends Effect.Service<ReadPayload>()("ReadPayload", {
	accessors: true,
	effect: Effect.gen(function* () {
		const openPayload = yield* OpenPayload;

		const execute = Effect.fn("ReadPayload.execute")(function* (input: {
			readonly passphrase: string;
			readonly path: string;
		}) {
			const openedPayload = yield* openPayload.execute(input).pipe(
				Effect.mapError((error) => {
					switch (error._tag) {
						case "OpenPayloadPersistenceError":
							return new ReadPayloadPersistenceError({
								message: error.message,
								operation: error.operation,
							});
						case "OpenPayloadFileFormatError":
							return new ReadPayloadFileFormatError({
								message: error.message,
							});
						case "OpenPayloadCryptoError":
							return new ReadPayloadCryptoError({
								message: error.message,
							});
						case "OpenPayloadEnvelopeError":
							return new ReadPayloadEnvelopeError({
								message: error.message,
							});
						case "OpenPayloadEnvError":
							return new ReadPayloadEnvError({
								message: error.message,
							});
					}
				}),
			);

			return new ReadPayloadSuccess({
				envText: openedPayload.envelope.envText,
				needsUpdate: openedPayload.needsUpdate,
				path: openedPayload.path,
			});
		});

		return { execute };
	}),
}) {}
