import { Effect } from "effect";
import type {
	PayloadReadError,
	PayloadWriteError,
} from "./PayloadRepositoryError.js";

type PayloadRepositoryShape = {
	readonly readFile: (path: string) => Effect.Effect<string, PayloadReadError>;
	readonly writeFile: (
		path: string,
		contents: string,
	) => Effect.Effect<void, PayloadWriteError>;
};

const missingPayloadRepository = {
	readFile: (_path: string) =>
		Effect.dieMessage(
			"PayloadRepository implementation not provided",
		) as Effect.Effect<string, PayloadReadError>,
	writeFile: (_path: string, _contents: string) =>
		Effect.dieMessage(
			"PayloadRepository implementation not provided",
		) as Effect.Effect<void, PayloadWriteError>,
} satisfies PayloadRepositoryShape;

export class PayloadRepository extends Effect.Service<PayloadRepository>()(
	"PayloadRepository",
	{
		accessors: true,
		succeed: missingPayloadRepository,
	},
) {}
