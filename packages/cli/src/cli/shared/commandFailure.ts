export type CliCommandFailureReason =
	| "cancelled"
	| "unexpected"
	| "user-facing-error"
	| "validation";

export class CliCommandFailedError extends Error {
	readonly command: string;
	readonly reason: CliCommandFailureReason;

	constructor(input: {
		readonly command: string;
		readonly name?: string;
		readonly reason: CliCommandFailureReason;
	}) {
		super(`${input.command} failed`);
		this.command = input.command;
		this.name = input.name ?? "CliCommandFailedError";
		this.reason = input.reason;
	}
}
