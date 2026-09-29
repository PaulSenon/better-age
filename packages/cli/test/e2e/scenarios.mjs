// Real-terminal end-to-end scenarios for the built `bage` bundle. Runs inside
// an isolated container (see run.mjs): throwaway homes, no network, fake editor.
import assert from "node:assert/strict";
import {
	chmodSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { disposeAll, keys, startBage } from "./pty.mjs";

const work = join(tmpdir(), "work");
mkdirSync(work, { recursive: true });
const homes = { alice: join(tmpdir(), "alice"), bob: join(tmpdir(), "bob") };
for (const home of Object.values(homes)) mkdirSync(home, { recursive: true });

const pass = { alice: "alice passphrase", bob: "bob passphrase" };
const envFor = (home, extra = {}) => ({
	PATH: process.env.PATH,
	HOME: home,
	TERM: "xterm-256color",
	EDITOR: "/e2e/fake-editor.sh",
	...extra,
});
const run = (who, args, { env, stdoutFile } = {}) =>
	startBage({ args, env: envFor(homes[who], env), cwd: work, stdoutFile });
const editTempDirs = () =>
	readdirSync(tmpdir()).filter((name) => name.startsWith("better-age-edit-"));

const scenarios = [];
const scenario = (name, body) => scenarios.push({ name, body });

scenario("setup hides the passphrase and confirms it", async () => {
	for (const who of ["alice", "bob"]) {
		const setup = run(who, [
			"setup",
			"--name",
			who === "alice" ? "Alice" : "Bob",
		]);
		await setup.answer("Passphrase", pass[who]);
		await setup.answer("Confirm passphrase", pass[who]);
		await setup.expect(/\[OK\] Identity created: \w+#fp_[0-9a-f]{16}/);
		assert.equal(await setup.exit(), 0);
		assert.ok(!setup.screen.includes(pass[who]), "passphrase was echoed");
	}
	const mode = statSync(join(homes.alice, ".better-age")).mode & 0o777;
	assert.equal(mode, 0o700);
});

scenario("create, then edit arbitrary text through a real editor", async () => {
	const create = run("alice", ["create", ".env.enc"]);
	await create.answer("Passphrase", pass.alice);
	await create.expect("[OK] Payload created: .env.enc");
	assert.equal(await create.exit(), 0);

	const edit = run("alice", ["edit", ".env.enc"], {
		env: { BAGE_E2E_TEXT: "API_TOKEN=e2e-secret\nhello world, not env\n" },
	});
	await edit.answer("Passphrase", pass.alice);
	await edit.expect("[OK] Payload edited: .env.enc");
	assert.equal(await edit.exit(), 0);
	assert.deepEqual(editTempDirs(), [], "editor temp dir left behind");
	assert.ok(
		!readFileSync(join(work, ".env.enc"), "utf8").includes("e2e-secret"),
	);
});

scenario("load keeps stdout pure while prompting on the terminal", async () => {
	const out = join(tmpdir(), "load.out");
	const load = run("alice", ["load", ".env.enc", "--protocol-version=1"], {
		stdoutFile: out,
	});
	await load.answer("Passphrase", "wrong passphrase");
	await load.expect(
		"[ERROR] PASSPHRASE_INCORRECT: invalid passphrase, try again",
	);
	await load.answer("Passphrase", pass.alice);
	assert.equal(await load.exit(), 0);
	assert.equal(
		readFileSync(out, "utf8"),
		"API_TOKEN=e2e-secret\nhello world, not env\n",
	);
});

scenario("grant by identity string lets another home decrypt", async () => {
	const out = join(tmpdir(), "bob.identity");
	const exportBob = run("bob", ["identity", "export"], { stdoutFile: out });
	assert.equal(await exportBob.exit(), 0);
	const bobIdentity = readFileSync(out, "utf8");
	assert.match(bobIdentity, /^better-age:\/\/identity\/v1\/[\w-]+\n$/);

	const grant = run("alice", ["grant", ".env.enc", bobIdentity.trim()]);
	await grant.answer("Passphrase", pass.alice);
	await grant.expect(/\[OK\] Recipient granted: Bob#fp_[0-9a-f]{16}/);
	assert.equal(await grant.exit(), 0);

	const bobOut = join(tmpdir(), "bob.out");
	const load = run("bob", ["load", ".env.enc", "--protocol-version=1"], {
		stdoutFile: bobOut,
	});
	await load.answer("Passphrase", pass.bob);
	assert.equal(await load.exit(), 0);
	assert.match(readFileSync(bobOut, "utf8"), /^API_TOKEN=e2e-secret\n/);
});

scenario(
	"secure viewer uses the alternate screen and restores it",
	async () => {
		const view = run("alice", ["view", ".env.enc"]);
		await view.answer("Passphrase", pass.alice);
		await view.expect("Viewing .env.enc");
		await view.send("q");
		await view.expect("[OK] Viewer closed");
		assert.equal(await view.exit(), 0);
		assert.ok(
			view.raw.includes("\u001B[?1049h"),
			"alternate screen not entered",
		);
		assert.ok(
			view.raw.includes("\u001B[?25h\u001B[?1049l"),
			"screen not restored",
		);
	},
);

scenario(
	"interactive menus navigate by keyboard; Ctrl-C aborts with 130",
	async () => {
		const session = run("alice", ["interactive"]);
		await session.expect("Command");
		await session.send(keys.enter); // Files
		await session.expect("create");
		await session.send(`${keys.down}${keys.down}${keys.down}${keys.enter}`); // inspect
		await session.expect("Payload");
		await session.send(keys.enter); // .env.enc
		await session.answer("Passphrase", pass.alice);
		await session.expect("compatibility: up-to-date");
		await session.answer("Press Enter", "");
		await session.expect("Command");
		await session.send(keys.ctrlC);
		await session.expect("[ERROR] CANCELLED: command cancelled");
		assert.equal(await session.exit(), 130);
	},
);

scenario("Ctrl-C at a passphrase prompt exits 130", async () => {
	const load = run("alice", ["load", ".env.enc", "--protocol-version=1"]);
	await load.expect("Passphrase");
	await load.send(keys.ctrlC);
	assert.equal(await load.exit(), 130);
	assert.match(load.screen, /\[ERROR\] CANCELLED: command cancelled/);
});

scenario(
	"SIGINT while the editor runs removes plaintext temp files",
	async () => {
		const edit = run("alice", ["edit", ".env.enc"], {
			env: { BAGE_E2E_EDITOR_SLEEP: "30" },
		});
		await edit.answer("Passphrase", pass.alice);
		await edit.expect("fake-editor: editing");
		assert.equal(editTempDirs().length, 1);
		await edit.send(keys.ctrlC);
		assert.equal(await edit.exit(), 130);
		assert.deepEqual(editTempDirs(), [], "plaintext temp dir left behind");
	},
);

scenario(
	"rotation, outdated warning, update, and permission repair",
	async () => {
		const rotate = run("alice", ["identity", "rotate"]);
		await rotate.answer("Passphrase", pass.alice);
		await rotate.expect(
			"[WARN] Existing payloads may need update: run bage update",
		);
		assert.equal(await rotate.exit(), 0);

		chmodSync(join(homes.alice, ".better-age"), 0o755);
		const update = run("alice", ["update", ".env.enc"]);
		await update.answer("Passphrase", pass.alice);
		await update.expect("[WARN] Local file permissions repaired");
		await update.expect("[WARN] Payload update recommended: run bage update");
		await update.expect("[OK] Payload updated: .env.enc");
		assert.equal(await update.exit(), 0);
		assert.equal(
			statSync(join(homes.alice, ".better-age")).mode & 0o777,
			0o700,
		);
	},
);

const only = process.env.BAGE_E2E_ONLY;
let failures = 0;
for (const { name, body } of scenarios) {
	if (only !== undefined && !name.includes(only)) continue;
	try {
		await body();
		console.log(`ok - ${name}`);
	} catch (error) {
		failures += 1;
		console.log(`not ok - ${name}\n${error?.stack ?? error}`);
	} finally {
		// A failed step must never leave a PTY/bage/editor process behind.
		disposeAll();
	}
}
console.log(`${failures === 0 ? "PASS" : "FAIL"}: ${failures} failed`);
// Exit explicitly: leftover handles must not keep the container alive.
process.exit(failures === 0 ? 0 : 1);
