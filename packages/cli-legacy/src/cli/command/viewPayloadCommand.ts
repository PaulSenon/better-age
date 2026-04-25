import { Args, Command } from "@effect/cli";
import { Effect } from "effect";
import {
	ViewPayload,
	ViewPayloadFailedError,
} from "../../app/view-payload/ViewPayload.js";
import { CliCommandFailedError } from "../shared/commandFailure.js";

export class ViewPayloadCommandFailedError extends CliCommandFailedError {
	constructor() {
		super({
			command: "view",
			name: "ViewPayloadCommandFailedError",
			reason: "user-facing-error",
		});
	}
}

const pathArg = Args.text({ name: "path" }).pipe(Args.optional);

export const viewPayloadCommand = Command.make(
	"view",
	{ path: pathArg },
	({ path }) =>
		ViewPayload.execute({ path }).pipe(
			Effect.catchIf(
				(error): error is ViewPayloadFailedError =>
					error instanceof ViewPayloadFailedError,
				() => Effect.fail(new ViewPayloadCommandFailedError()),
			),
		),
);
