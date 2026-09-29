// Minimal pseudo-terminal driver built on util-linux `script(1)`, so the
// built `bage` sees a real TTY (raw mode, hidden input, Ctrl-C -> SIGINT)
// without native modules. Runs inside the E2E container only.
import { spawn } from "node:child_process";
import { stripVTControlCharacters } from "node:util";

export const keys = {
	enter: "\r",
	down: "\u001B[B",
	up: "\u001B[A",
	ctrlC: "\u0003",
};

const expectTimeoutMs = Number(
	process.env.BAGE_E2E_EXPECT_TIMEOUT_MS ?? 20_000,
);

/** Every started session, so the runner can kill leftovers unconditionally. */
const live = new Set();

/** Kills every still-running session (SIGKILL on the whole process group). */
export const disposeAll = () => {
	for (const session of live) session.dispose();
};

const quote = (value) => `'${String(value).replaceAll("'", `'\\''`)}'`;

/**
 * Starts `bage <args>` on a PTY. `stdoutFile` redirects only stdout (the PTY
 * keeps stdin/stderr), which is how Varlock consumes `bage load`.
 */
export const startBage = ({ args, env, cwd, stdoutFile }) => {
	const redirect = stdoutFile === undefined ? "" : ` > ${quote(stdoutFile)}`;
	const command = `stty cols 100 rows 30; exec node /opt/bage/bage ${args
		.map(quote)
		.join(" ")}${redirect}`;
	// detached: `script` leads its own process group, so dispose() can kill
	// script, the shell, bage, and any editor child in one signal.
	const child = spawn("script", ["-q", "-e", "-c", command, "/dev/null"], {
		cwd,
		env,
		detached: true,
		stdio: ["pipe", "pipe", "pipe"],
	});
	let done = false;
	let raw = "";
	let cursor = 0;
	const exited = new Promise((resolve) => {
		child.on("exit", (code, signal) => {
			done = true;
			live.delete(session);
			resolve(code ?? (signal ? 128 : 1));
		});
	});
	child.stdout.on("data", (chunk) => {
		raw += chunk.toString("utf8");
	});
	child.stderr.on("data", (chunk) => {
		raw += chunk.toString("utf8");
	});

	const session = {
		/** Everything the terminal displayed so far, ANSI-stripped. */
		get screen() {
			return stripVTControlCharacters(raw);
		},
		get raw() {
			return raw;
		},
		/** Waits until `pattern` appears after the previous match. */
		expect: async (pattern, timeoutMs = expectTimeoutMs) => {
			const deadline = Date.now() + timeoutMs;
			while (Date.now() < deadline) {
				const text = session.screen.slice(cursor);
				const match =
					typeof pattern === "string"
						? text.indexOf(pattern)
						: text.search(pattern);
				if (match !== -1) {
					cursor += match + 1;
					return;
				}
				await new Promise((resolve) => setTimeout(resolve, 25));
			}
			session.dispose();
			throw new Error(
				`Timed out waiting for ${pattern}\n--- screen ---\n${session.screen}`,
			);
		},
		send: async (text) => {
			// Small pause so prompts finish attaching their keypress listeners.
			await new Promise((resolve) => setTimeout(resolve, 150));
			child.stdin.write(text);
		},
		answer: async (prompt, text) => {
			await session.expect(prompt);
			await session.send(`${text}${keys.enter}`);
		},
		exit: async (timeoutMs = 30_000) => {
			const timer = setTimeout(session.dispose, timeoutMs);
			const code = await exited;
			clearTimeout(timer);
			return code;
		},
		dispose: () => {
			if (done) return;
			try {
				process.kill(-child.pid, "SIGKILL");
			} catch {
				child.kill("SIGKILL");
			}
		},
	};

	live.add(session);
	return session;
};
