import { Schema } from "effect";
import { KeyFingerprint } from "../domain/identity/KeyFingerprint.js";
import { PrivateKeyRelativePath } from "../domain/identity/PrivateKeyRelativePath.js";

export class HomeStateLoadError extends Schema.TaggedError<HomeStateLoadError>()(
	"HomeStateLoadError",
	{
		message: Schema.String,
		stateFile: Schema.String,
	},
) {}

export class HomeStateDecodeError extends Schema.TaggedError<HomeStateDecodeError>()(
	"HomeStateDecodeError",
	{
		message: Schema.String,
		stateFile: Schema.String,
	},
) {}

export class HomeStateSaveError extends Schema.TaggedError<HomeStateSaveError>()(
	"HomeStateSaveError",
	{
		message: Schema.String,
		stateFile: Schema.String,
	},
) {}

export class PrivateKeyWriteError extends Schema.TaggedError<PrivateKeyWriteError>()(
	"PrivateKeyWriteError",
	{
		fingerprint: KeyFingerprint,
		message: Schema.String,
	},
) {}

export class PrivateKeyPathWriteError extends Schema.TaggedError<PrivateKeyPathWriteError>()(
	"PrivateKeyPathWriteError",
	{
		message: Schema.String,
		privateKeyPath: PrivateKeyRelativePath,
	},
) {}

export class PrivateKeyReadError extends Schema.TaggedError<PrivateKeyReadError>()(
	"PrivateKeyReadError",
	{
		message: Schema.String,
		privateKeyPath: PrivateKeyRelativePath,
	},
) {}

export class PrivateKeyDeleteError extends Schema.TaggedError<PrivateKeyDeleteError>()(
	"PrivateKeyDeleteError",
	{
		message: Schema.String,
		privateKeyPath: PrivateKeyRelativePath,
	},
) {}
