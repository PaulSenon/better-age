import { Predicate } from "effect";

/**
 * Reads the `{ kind, version }` header every versioned JSON artifact carries.
 * Returns null when the input is not that artifact kind or the version is not
 * an integer, so callers can distinguish "invalid" from "too new".
 */
export const readArtifactHeader = (
	json: unknown,
	kind: string,
): { readonly version: number } | null =>
	Predicate.isObject(json) &&
	"kind" in json &&
	json.kind === kind &&
	"version" in json &&
	Number.isInteger(json.version)
		? { version: json.version as number }
		: null;
