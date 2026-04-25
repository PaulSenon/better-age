import { Effect } from "effect";
import type {
	SecureViewerDisplayError,
	SecureViewerUnavailableError,
} from "./SecureViewerError.js";

type SecureViewerShape = {
	readonly view: (input: {
		readonly envText: string;
		readonly path: string;
	}) => Effect.Effect<
		void,
		SecureViewerDisplayError | SecureViewerUnavailableError
	>;
};

const missingSecureViewer = {
	view: (_input: { readonly envText: string; readonly path: string }) =>
		Effect.dieMessage(
			"SecureViewer implementation not provided",
		) as Effect.Effect<
			void,
			SecureViewerDisplayError | SecureViewerUnavailableError
		>,
} satisfies SecureViewerShape;

export class SecureViewer extends Effect.Service<SecureViewer>()(
	"SecureViewer",
	{
		accessors: true,
		succeed: missingSecureViewer,
	},
) {}
