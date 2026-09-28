// Payload file flows: create, inspect, load, view, edit, update.
import { PayloadAlreadyExists } from "@better-age/core/Errors";
import * as Payloads from "@better-age/core/Payloads";
import { Effect, FileSystem, Option } from "effect";
import { cancelled, usage } from "../failures.js";
import { payloadInspect } from "../present.js";
import { sayOk, Ui } from "../ui/Ui.js";
import {
	ensureUpToDate,
	openPayload,
	requireInteractive,
	withPassphrase,
} from "./common.js";
import { editText } from "./editor.js";

const defaultPayloadPath = ".env.enc";

/** Target for a new payload; interactive collisions offer Override / Change Name. */
const resolveNewPayloadTarget = Effect.fnUntraced(function* (
	pathArg: Option.Option<string>,
) {
	const ui = yield* Ui;
	const fs = yield* FileSystem.FileSystem;
	const askPath = Effect.map(
		ui.text("Payload path", { defaultValue: defaultPayloadPath }),
		(path) => (path.length === 0 ? defaultPayloadPath : path),
	);

	if (Option.isNone(pathArg) && !ui.interactive) {
		return yield* usage("PAYLOAD_PATH_MISSING");
	}

	let path = Option.isSome(pathArg) ? pathArg.value : yield* askPath;

	while (yield* fs.exists(path).pipe(Effect.orDie)) {
		if (!ui.interactive) {
			return yield* new PayloadAlreadyExists({ path });
		}

		const choice = yield* ui.select("Payload already exists", [
			{ value: "override", label: "Override" },
			{ value: "change-name", label: "Change Name" },
			{ value: "cancel", label: "Cancel" },
		]);

		if (choice === "override") {
			return { path, overwrite: true };
		}

		if (choice !== "change-name") {
			return yield* cancelled();
		}

		path = yield* askPath;
	}

	return { path, overwrite: false };
});

export const createPayload = Effect.fn("createPayload")(function* (
	pathArg: Option.Option<string>,
) {
	const target = yield* resolveNewPayloadTarget(pathArg);
	yield* requireInteractive();
	yield* withPassphrase((passphrase) =>
		Payloads.create({ ...target, passphrase }),
	);
	yield* sayOk(`Payload created: ${target.path}`);
});

export const inspectPayload = Effect.fn("inspectPayload")(function* (
	pathArg: Option.Option<string>,
) {
	const { payload } = yield* openPayload(pathArg);
	yield* (yield* Ui).stdout(payloadInspect(payload));
});

/**
 * Machine boundary used by Varlock: stdout is exactly the payload text,
 * everything else (prompts, warnings, errors) goes to stderr.
 */
export const loadPayload = Effect.fn("loadPayload")(function* (input: {
	readonly path: Option.Option<string>;
	readonly protocolVersion: Option.Option<string>;
}) {
	if (Option.isNone(input.protocolVersion)) {
		return yield* usage("LOAD_PROTOCOL_REQUIRED");
	}

	if (input.protocolVersion.value !== "1") {
		return yield* usage("LOAD_PROTOCOL_UNSUPPORTED");
	}

	const { payload } = yield* openPayload(input.path);
	yield* (yield* Ui).stdout(payload.envText);
});

export const viewPayload = Effect.fn("viewPayload")(function* (
	pathArg: Option.Option<string>,
) {
	const { payload } = yield* openPayload(pathArg);
	yield* (yield* Ui).view(payload.envText, payload.path);
	yield* sayOk("Viewer closed");
});

export const editPayload = Effect.fn("editPayload")(function* (
	pathArg: Option.Option<string>,
) {
	const opened = yield* openPayload(pathArg);
	yield* ensureUpToDate(opened, Option.isSome(pathArg));

	const { path, envText } = opened.payload;
	const edited = yield* editText(envText);

	if (edited === envText) {
		return yield* sayOk(`Payload unchanged: ${path}`);
	}

	const result = yield* Payloads.edit({
		path,
		passphrase: opened.passphrase,
		envText: edited,
	});
	yield* sayOk(`Payload ${result.outcome}: ${path}`);
});

export const updatePayload = Effect.fn("updatePayload")(function* (
	pathArg: Option.Option<string>,
) {
	const opened = yield* openPayload(pathArg);
	const result = yield* Payloads.update({
		path: opened.payload.path,
		passphrase: opened.passphrase,
	});
	yield* sayOk(`Payload ${result.outcome}: ${result.path}`);
});
