import { Effect } from "effect";

type PathAccessShape = {
	readonly exists: (path: string) => Effect.Effect<boolean>;
};

const missingPathAccess = {
	exists: (_path: string) =>
		Effect.dieMessage(
			"PathAccess implementation not provided",
		) as Effect.Effect<boolean>,
} satisfies PathAccessShape;

export class PathAccess extends Effect.Service<PathAccess>()("PathAccess", {
	accessors: true,
	succeed: missingPathAccess,
}) {}
