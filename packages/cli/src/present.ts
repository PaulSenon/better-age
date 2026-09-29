// Pure text rendering. stdout carries machine/primary output; stderr carries
// `[OK]`/`[WARN]`/`[ERROR]` lines. Untrusted text (names, aliases, paths)
// always goes through `sanitize` so it cannot drive the terminal.

import type {
	KnownIdentity,
	SelfIdentity,
} from "@better-age/core/domain/Identity";
import type { LocalKeys } from "@better-age/core/Home";
import type { DecryptedPayload } from "@better-age/core/Payloads";

const renderControl = (character: string) =>
	character === "\t"
		? "\\t"
		: character === "\r"
			? "\\r"
			: `\\x${character.charCodeAt(0).toString(16).padStart(2, "0")}`;

const isInvisibleFormat = (code: number) =>
	(code >= 0x200b && code <= 0x200f) || // zero-width, LRM/RLM
	(code >= 0x202a && code <= 0x202e) || // bidi embeddings/overrides
	(code >= 0x2066 && code <= 0x2069) || // bidi isolates
	code === 0x2028 ||
	code === 0x2029 ||
	code === 0xfeff;

/**
 * Renders C0/C1 controls, bidi overrides, and zero-width characters visibly,
 * so untrusted names cannot drive the terminal or spoof picker labels.
 */
export const sanitize = (text: string) =>
	Array.from(text)
		.map((character) => {
			const code = character.charCodeAt(0);

			if (code < 0x20 || code === 0x7f || (code >= 0x80 && code <= 0x9f)) {
				return renderControl(character);
			}

			return isInvisibleFormat(code) ? `\\u{${code.toString(16)}}` : character;
		})
		.join("");

export const ok = (message: string) => `[OK] ${sanitize(message)}\n`;
export const warning = (message: string) => `[WARN] ${sanitize(message)}\n`;
export const error = (code: string, message: string) =>
	`[ERROR] ${sanitize(code)}: ${sanitize(message)}\n`;

const ansi = {
	reset: "\u001B[0m",
	bold: "\u001B[1m",
	green: "\u001B[32m",
	yellow: "\u001B[33m",
	red: "\u001B[31m",
};

/** Minimal emphasis for human stderr lines; never applied to stdout. */
export const style = (line: string) =>
	line
		.replace(/^(\[ERROR\] )([A-Z0-9_]+):/, `$1${ansi.bold}$2:${ansi.reset}`)
		.replace(/^\[OK\]/, `${ansi.green}[OK]${ansi.reset}`)
		.replace(/^\[WARN\]/, `${ansi.yellow}[WARN]${ansi.reset}`)
		.replace(/^\[ERROR\]/, `${ansi.red}[ERROR]${ansi.reset}`);

/** Compact identity line: `alias (Name) owner_id [tag]`, no key noise. */
export const identityLabel = (identity: {
	readonly displayName: string;
	readonly ownerId: string;
	readonly localAlias: string | null;
	readonly tag?: string;
}) => {
	const name =
		identity.localAlias === null
			? sanitize(identity.displayName)
			: `${sanitize(identity.localAlias)} (${sanitize(identity.displayName)})`;
	const tag = identity.tag === undefined ? "" : ` ${identity.tag}`;

	return `${name} ${sanitize(identity.ownerId)}${tag}`;
};

const section = (title: string, lines: ReadonlyArray<string>) =>
	`${title}\n${lines.length === 0 ? "  none\n" : lines.map((line) => `  ${line}\n`).join("")}`;

export const identityList = (input: {
	readonly self: SelfIdentity;
	readonly known: ReadonlyArray<KnownIdentity>;
	readonly keys: LocalKeys;
}) =>
	[
		section("Self", [
			identityLabel({ ...input.self, localAlias: null, tag: "[you]" }),
		]),
		section("Known identities", input.known.map(identityLabel)),
		section(
			"Retired keys",
			input.keys.retired.map(
				(key) => `${sanitize(key.fingerprint)} ${sanitize(key.retiredAt)}`,
			),
		),
	].join("\n");

export const identityKeys = (input: {
	readonly current: LocalKeys["current"] | null;
	readonly retired: LocalKeys["retired"];
}) =>
	[
		...(input.current === null
			? []
			: [
					section("Current key", [
						`${sanitize(input.current.fingerprint)}  ${sanitize(input.current.path)}`,
					]),
				]),
		section(
			"Retired keys",
			input.retired.map(
				(key) =>
					`${sanitize(key.fingerprint)}  ${sanitize(key.retiredAt)}  ${sanitize(key.path)}`,
			),
		),
	].join("\n");

export const payloadInspect = (payload: DecryptedPayload) =>
	[
		`Payload\n  path: ${sanitize(payload.path)}\n  payload id: ${sanitize(payload.payloadId)}\n  schema version: ${payload.schemaVersion}\n  compatibility: ${payload.compatibility}\n`,
		section("Env keys", payload.envKeys.map(sanitize)),
		section(
			"Recipients",
			payload.recipients.map((recipient) => {
				const tags = [
					recipient.isSelf ? "[you]" : "",
					recipient.isStaleSelf ? "[stale]" : "",
				].filter((tag) => tag.length > 0);

				return identityLabel({
					...recipient,
					...(tags.length === 0 ? {} : { tag: tags.join(" ") }),
				});
			}),
		),
	].join("\n");
