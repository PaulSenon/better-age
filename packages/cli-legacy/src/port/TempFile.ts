import { Effect } from "effect";
import type {
	TempFileCreateError,
	TempFileDeleteError,
	TempFileReadError,
} from "./TempFileError.js";

type TempFileShape = {
	readonly create: (input: {
		readonly extension: string;
		readonly initialContents: string;
	}) => Effect.Effect<{ readonly path: string }, TempFileCreateError>;
	readonly delete: (path: string) => Effect.Effect<void, TempFileDeleteError>;
	readonly read: (path: string) => Effect.Effect<string, TempFileReadError>;
};

const missingTempFile = {
	create: (_input: {
		readonly extension: string;
		readonly initialContents: string;
	}) =>
		Effect.dieMessage("TempFile implementation not provided") as Effect.Effect<
			{ readonly path: string },
			TempFileCreateError
		>,
	delete: (_path: string) =>
		Effect.dieMessage("TempFile implementation not provided") as Effect.Effect<
			void,
			TempFileDeleteError
		>,
	read: (_path: string) =>
		Effect.dieMessage("TempFile implementation not provided") as Effect.Effect<
			string,
			TempFileReadError
		>,
} satisfies TempFileShape;

export class TempFile extends Effect.Service<TempFile>()("TempFile", {
	accessors: true,
	succeed: missingTempFile,
}) {}
