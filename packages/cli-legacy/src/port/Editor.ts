import { Effect } from "effect";
import type {
	EditorExitError,
	EditorLaunchError,
	EditorUnavailableError,
} from "./EditorError.js";

type EditorShape = {
	readonly editFile: (input: {
		readonly command: string;
		readonly path: string;
	}) => Effect.Effect<
		void,
		EditorExitError | EditorLaunchError | EditorUnavailableError
	>;
};

const missingEditor = {
	editFile: (_input: { readonly command: string; readonly path: string }) =>
		Effect.dieMessage("Editor implementation not provided") as Effect.Effect<
			void,
			EditorExitError | EditorLaunchError | EditorUnavailableError
		>,
} satisfies EditorShape;

export class Editor extends Effect.Service<Editor>()("Editor", {
	accessors: true,
	succeed: missingEditor,
}) {}
