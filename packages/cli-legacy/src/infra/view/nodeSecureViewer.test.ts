import { EventEmitter } from "node:events";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { makeNodeSecureViewer } from "./nodeSecureViewer.js";

class FakeStdin extends EventEmitter {
	isRaw = false;
	isTTY = true;
	pauseCalls = 0;
	resumeCalls = 0;
	setRawModeCalls: boolean[] = [];

	setRawMode(value: boolean) {
		this.isRaw = value;
		this.setRawModeCalls.push(value);
	}

	pause() {
		this.pauseCalls += 1;
	}

	resume() {
		this.resumeCalls += 1;
	}
}

class FakeStderr extends EventEmitter {
	isTTY = true;
	rows = 24;
	writes: string[] = [];
	cursorCalls: Array<{ x: number; y: number }> = [];
	clearCalls = 0;

	write(chunk: string) {
		this.writes.push(chunk);
	}

	cursorTo(x: number, y: number) {
		this.cursorCalls.push({ x, y });
	}

	clearScreenDown() {
		this.clearCalls += 1;
	}
}

describe("nodeSecureViewer", () => {
	it("pauses stdin when quitting the viewer", async () => {
		const stdin = new FakeStdin();
		const stderr = new FakeStderr();
		let emitKeypressEventsCalls = 0;
		const viewer = makeNodeSecureViewer({
			emitKeypressEvents: () => {
				emitKeypressEventsCalls += 1;
			},
			stderr,
			stdin,
		});

		const run = Effect.runPromise(
			viewer.view({
				envText: "API_TOKEN=secret",
				path: "./.env.enc",
			}),
		);

		stdin.emit("keypress", "q", { name: "q" });

		await run;

		expect(emitKeypressEventsCalls).toBe(1);
		expect(stdin.resumeCalls).toBe(1);
		expect(stdin.pauseCalls).toBe(1);
		expect(stdin.setRawModeCalls).toEqual([true, false]);
	});
});
