// `bage interactive` / `bage i`: keyboard menus over the guided command flows.
// A failing command prints its error and returns to the menu; an explicit
// Cancel/Back returns too. Ctrl-C (abort) ends the whole session with 130.
import * as Home from "@better-age/core/Home";
import { Effect, Option } from "effect";
import { CliFailure, type Failure } from "../failures.js";
import { type Choice, sayFailure, Ui } from "../ui/Ui.js";
import {
	changePassphrase,
	exportIdentity,
	forgetIdentity,
	importIdentity,
	listIdentities,
	listKeys,
	rotateIdentity,
	setup,
} from "./identity.js";
import {
	createPayload,
	editPayload,
	inspectPayload,
	updatePayload,
	viewPayload,
} from "./payload.js";
import { grant, revoke } from "./sharing.js";

const none = Option.none<string>();
const guided = { path: none, reference: none };

// `load` (machine protocol) and `interactive` itself are intentionally absent.
const commandFlows = {
	setup: setup(none),
	create: createPayload(none),
	edit: editPayload(none),
	grant: grant(guided),
	inspect: inspectPayload(none),
	revoke: revoke(guided),
	update: updatePayload(none),
	view: viewPayload(none),
	"identity export": exportIdentity,
	"identity import": importIdentity({
		identityString: none,
		alias: none,
		trustKeyUpdate: false,
	}),
	"identity list": listIdentities,
	"identity keys": listKeys({ current: false, retired: false, path: false }),
	"identity forget": forgetIdentity(none),
	"identity passphrase": changePassphrase,
	"identity rotate": rotateIdentity,
};

type CommandName = keyof typeof commandFlows;
type SessionServices =
	(typeof commandFlows)[CommandName] extends Effect.Effect<
		infer _A,
		infer _E,
		infer R
	>
		? R
		: never;

const command = (name: CommandName): Choice => ({ value: name, label: name });
const back = { value: "back", label: "Back" };
const quit = { value: "quit", label: "Quit" };

const menus = {
	notSetup: [command("setup"), quit],
	root: [
		{ value: "files", label: "Files" },
		{ value: "identities", label: "Identities" },
		quit,
	],
	files: [
		...(
			[
				"create",
				"edit",
				"grant",
				"inspect",
				"revoke",
				"update",
				"view",
			] as const
		).map(command),
		back,
		quit,
	],
	identities: [
		...(
			[
				"identity export",
				"identity import",
				"identity list",
				"identity keys",
				"identity forget",
				"identity passphrase",
				"identity rotate",
			] as const
		).map(command),
		back,
		quit,
	],
} satisfies Record<string, ReadonlyArray<Choice>>;

/** Runs one command; pauses afterwards if it printed a primary stdout screen. */
const runInSession = Effect.fnUntraced(function* (name: CommandName) {
	const ui = yield* Ui;
	let wroteStdout = false;
	const selected: Effect.Effect<void, Failure, SessionServices> =
		commandFlows[name];
	const flow = selected.pipe(
		Effect.provideService(Ui, {
			...ui,
			stdout: (text) => {
				wroteStdout ||= text.length > 0;
				return ui.stdout(text);
			},
		}),
	);

	yield* flow.pipe(
		Effect.catchIf(
			(failure): failure is Failure =>
				!(failure instanceof CliFailure && failure.abort === true),
			sayFailure,
		),
	);

	if (wroteStdout) {
		yield* ui.pause("Press Enter");
	}
});

export const interactiveSession = Effect.gen(function* () {
	const ui = yield* Ui;

	if (!ui.interactive) {
		return yield* new CliFailure({ code: "INTERACTIVE_UNAVAILABLE" });
	}

	let menu: keyof typeof menus = "root";

	while (true) {
		const status = yield* Home.status;

		if (status.status === "not-setup") {
			menu = "notSetup";
		} else if (menu === "notSetup") {
			menu = "root";
		}

		const selected: string = yield* ui.select("Command", menus[menu]);

		if (selected === "quit") {
			return;
		}

		if (selected === "back") {
			menu = "root";
		} else if (selected === "files" || selected === "identities") {
			menu = selected;
		} else if (selected in commandFlows) {
			yield* runInSession(selected as CommandName);
		}
	}
});
