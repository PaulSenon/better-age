// import Docker, { type Container, type Exec } from "dockerode";
// import { readdir, stat } from "node:fs/promises";
// import { join, resolve } from "node:path";

// const IMAGE = "better-age:e2e";
// const USER = "testUser";
// const HOME_DIR = `/home/${USER}`;
// const PACKAGE_ROOT = resolve(import.meta.dirname, "../../..");
// const DOCKERFILE_REL = "test/e2e/fixtures/Dockerfile.test";
// const DEFAULT_TTY = {
// 	cols: 120,
// 	rows: 40,
// } as const;
// const DEFAULT_WAIT_TIMEOUT_MS = 5_000;
// const DEFAULT_IDLE_MS = 75;
// const IDLE_PATTERN = /<idle>/;

// let imageReadyPromise: Promise<void> | undefined;

// export interface SbExecResult {
// 	exitCode: number;
// 	stdout: string;
// 	stderr: string;
// }

// export type SessionPattern = string | RegExp;

// export interface InteractiveHistory {
// 	input: string;
// 	output: string;
// }

// export interface InteractiveExecResult {
// 	exitCode: number;
// 	output: string;
// 	input: string;
// 	history: InteractiveHistory[];
// }

// export interface InteractiveMatchResult {
// 	pattern: SessionPattern;
// 	cursorStart: number;
// 	cursorEnd: number;
// 	fullOutput: string;
// 	outputSinceCursor: string;
// 	matchText: string;
// 	matchIndex: number;
// 	groups: string[];
// }

// export interface InteractiveSession extends AsyncDisposable {
// 	checkpoint(): number;
// 	readAll(): string;
// 	readSince(cursor: number): string;
// 	drain(): string;
// 	waitFor(
// 		pattern: SessionPattern,
// 		options?: {
// 			timeoutMs?: number;
// 			from?: number;
// 			consume?: boolean;
// 		},
// 	): Promise<InteractiveMatchResult>;
// 	waitForIdle(
// 		options?: {
// 			timeoutMs?: number;
// 			idleMs?: number;
// 			from?: number;
// 			consume?: boolean;
// 		},
// 	): Promise<InteractiveMatchResult>;
// 	write(text: string): Promise<void>;
// 	writeLine(text: string): Promise<void>;
// 	sendCtrlC(): Promise<void>;
// 	resize(size: { cols: number; rows: number }): Promise<void>;
// 	finish(): Promise<InteractiveExecResult>;
// 	closeInput(): Promise<void>;
// 	dispose(): Promise<void>;
// }

// export interface Sandbox extends AsyncDisposable {
// 	exec(
// 		command: string,
// 		options?: {
// 			stdinText?: string;
// 			cwd?: string;
// 			env?: Record<string, string>;
// 			user?: string;
// 		},
// 	): Promise<SbExecResult>;
// 	startInteractive(
// 		command: string,
// 		options?: {
// 			cwd?: string;
// 			env?: Record<string, string>;
// 			user?: string;
// 			tty?: { cols: number; rows: number };
// 		},
// 	): Promise<InteractiveSession>;
// 	dispose(): Promise<void>;
// }

// type TarballInfo = {
// 	relativePath: string;
// };

// type PatternWaiter = {
// 	pattern: SessionPattern;
// 	from: number;
// 	consume: boolean;
// 	timeout: NodeJS.Timeout;
// 	resolve: (result: InteractiveMatchResult) => void;
// 	reject: (error: Error) => void;
// };

// type IdleWaiter = {
// 	from: number;
// 	consume: boolean;
// 	timeout: NodeJS.Timeout;
// 	idleMs: number;
// 	idleTimer: NodeJS.Timeout | undefined;
// 	hasSeenNewOutput: boolean;
// 	resolve: (result: InteractiveMatchResult) => void;
// 	reject: (error: Error) => void;
// };

// type MatchDetails = {
// 	matchText: string;
// 	matchIndex: number;
// 	groups: string[];
// };

// const toEnvArray = (env?: Record<string, string>) =>
// 	env
// 		? Object.entries(env).map(([key, value]) => `${key}=${value}`)
// 		: undefined;

// const waitForStreamEnd = async (stream: Duplex) =>
// 	new Promise<void>((resolvePromise, rejectPromise) => {
// 		let settled = false;

// 		const cleanup = () => {
// 			stream.off("end", onEnd);
// 			stream.off("close", onClose);
// 			stream.off("error", onError);
// 		};

// 		const settle = (callback: () => void) => {
// 			if (settled) {
// 				return;
// 			}

// 			settled = true;
// 			cleanup();
// 			callback();
// 		};

// 		const onEnd = () => settle(resolvePromise);
// 		const onClose = () => settle(resolvePromise);
// 		const onError = (error: Error) => settle(() => rejectPromise(error));

// 		stream.on("end", onEnd);
// 		stream.on("close", onClose);
// 		stream.on("error", onError);
// 	});

// const cloneRegex = (pattern: RegExp) => new RegExp(pattern.source, pattern.flags);

// const findMatch = (
// 	pattern: SessionPattern,
// 	outputSinceCursor: string,
// ): MatchDetails | undefined => {
// 	if (typeof pattern === "string") {
// 		const matchIndex = outputSinceCursor.indexOf(pattern);

// 		if (matchIndex < 0) {
// 			return undefined;
// 		}

// 		return {
// 			matchText: pattern,
// 			matchIndex,
// 			groups: [],
// 		};
// 	}

// 	const regex = cloneRegex(pattern);
// 	const match = regex.exec(outputSinceCursor);

// 	if (!match) {
// 		return undefined;
// 	}

// 	return {
// 		matchText: match[0] ?? "",
// 		matchIndex: match.index,
// 		groups: match.slice(1).map((value) => value ?? ""),
// 	};
// };

// const createMatchResult = ({
// 	pattern,
// 	cursorStart,
// 	cursorEnd,
// 	fullOutput,
// 	outputSinceCursor,
// 	matchText,
// 	matchIndex,
// 	groups,
// }: {
// 	pattern: SessionPattern;
// 	cursorStart: number;
// 	cursorEnd: number;
// 	fullOutput: string;
// 	outputSinceCursor: string;
// 	matchText: string;
// 	matchIndex: number;
// 	groups: string[];
// }): InteractiveMatchResult => ({
// 	pattern,
// 	cursorStart,
// 	cursorEnd,
// 	fullOutput,
// 	outputSinceCursor,
// 	matchText,
// 	matchIndex,
// 	groups,
// });

// const createPatternTimeoutError = (pattern: SessionPattern, output: string) =>
// 	new Error(
// 		`Timed out waiting for interactive output matching ${String(pattern)}\n\nCurrent output:\n${output}`,
// 	);

// const createIdleTimeoutError = (output: string) =>
// 	new Error(`Timed out waiting for interactive output to go idle\n\nCurrent output:\n${output}`);

// const createSessionEndedError = (description: string, output: string) =>
// 	new Error(`${description}\n\nCurrent output:\n${output}`);

// const getTarballInfo = async (): Promise<TarballInfo> => {
// 	const tarballDir = join(PACKAGE_ROOT, "dist-artifacts");
// 	const tarballs = (await readdir(tarballDir)).filter((file) =>
// 		file.endsWith(".tgz"),
// 	);

// 	if (tarballs.length === 0) {
// 		throw new Error(
// 			"No CLI tarball found in dist-artifacts. Run `pnpm -F @better-age/cli run build && pnpm -F @better-age/cli run pack` first.",
// 		);
// 	}

// 	const entries = await Promise.all(
// 		tarballs.map(async (fileName) => ({
// 			fileName,
// 			stats: await stat(join(tarballDir, fileName)),
// 		})),
// 	);
// 	const newest = entries.sort(
// 		(left, right) => right.stats.mtimeMs - left.stats.mtimeMs,
// 	)[0];

// 	if (!newest) {
// 		throw new Error("Failed to resolve latest CLI tarball.");
// 	}

// 	return {
// 		relativePath: join("dist-artifacts", newest.fileName),
// 	};
// };

// const followProgress = async (docker: Docker, stream: NodeJS.ReadableStream) =>
// 	new Promise<void>((resolvePromise, rejectPromise) => {
// 		docker.modem.followProgress(stream, (error: unknown) => {
// 			if (error) {
// 				rejectPromise(error);
// 				return;
// 			}
// 			resolvePromise();
// 		});
// 	});

// const ensureImage = async (
// 	docker: Docker,
// 	tarballInfo: TarballInfo,
// ): Promise<void> => {
// 	imageReadyPromise ??= (async () => {
// 		const stream = await docker.buildImage(
// 			{
// 				context: PACKAGE_ROOT,
// 				src: [DOCKERFILE_REL, tarballInfo.relativePath],
// 			},
// 			{
// 				t: IMAGE,
// 				dockerfile: DOCKERFILE_REL,
// 			},
// 		);

// 		await followProgress(docker, stream);
// 	})().catch((error) => {
// 		imageReadyPromise = undefined;
// 		throw error;
// 	});

// 	await imageReadyPromise;
// };

// class DisposableInteractiveSession implements InteractiveSession {
// 	private readonly execInstance: Exec;
// 	private readonly stream: Duplex;
// 	private output = "";
// 	private input = "";
// 	private consumedCursor = 0;
// 	private readonly history: InteractiveHistory[] = [];
// 	private readonly patternWaiters = new Set<PatternWaiter>();
// 	private readonly idleWaiters = new Set<IdleWaiter>();
// 	private readonly finishedPromise: Promise<InteractiveExecResult>;
// 	private isInputClosed = false;
// 	private isDisposed = false;
// 	private isFinished = false;

// 	constructor(execInstance: Exec, stream: Duplex) {
// 		this.execInstance = execInstance;
// 		this.stream = stream;
// 		this.history.push({
// 			input: "",
// 			output: "",
// 		});

// 		this.stream.on("data", (chunk: Buffer | string) => {
// 			const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
// 			this.output += text;

// 			const currentHistory = this.history.at(-1);
// 			if (currentHistory) {
// 				currentHistory.output += text;
// 			}

// 			this.flushPatternWaiters();
// 			this.flushIdleWaiters();
// 		});

// 		this.finishedPromise = (async () => {
// 			await waitForStreamEnd(stream);
// 			const info = await execInstance.inspect();
// 			this.isFinished = true;
// 			this.rejectPatternWaiters((waiter) =>
// 				createSessionEndedError(
// 					`Interactive session ended before output matched ${String(waiter.pattern)}`,
// 					this.output,
// 				),
// 			);
// 			this.rejectIdleWaiters(() =>
// 				createSessionEndedError(
// 					"Interactive session ended before output became idle",
// 					this.output,
// 				),
// 			);
// 			return {
// 				exitCode: info.ExitCode ?? 1,
// 				output: this.output,
// 				input: this.input,
// 				history: this.history.map((entry) => ({ ...entry })),
// 			};
// 		})().catch((error) => {
// 			this.isFinished = true;
// 			const typedError =
// 				error instanceof Error ? error : new Error(String(error));
// 			this.rejectPatternWaiters(() => typedError);
// 			this.rejectIdleWaiters(() => typedError);
// 			throw typedError;
// 		});
// 	}

// 	checkpoint(): number {
// 		return this.output.length;
// 	}

// 	readAll(): string {
// 		return this.output;
// 	}

// 	readSince(cursor: number): string {
// 		return this.output.slice(cursor);
// 	}

// 	drain(): string {
// 		const outputSinceCursor = this.output.slice(this.consumedCursor);
// 		this.consumedCursor = this.output.length;
// 		return outputSinceCursor;
// 	}

// 	async waitFor(
// 		pattern: SessionPattern,
// 		options?: {
// 			timeoutMs?: number;
// 			from?: number;
// 			consume?: boolean;
// 		},
// 	): Promise<InteractiveMatchResult> {
// 		const from = options?.from ?? this.consumedCursor;
// 		const consume = options?.consume ?? true;
// 		const immediate = this.tryMatch(pattern, from, consume);

// 		if (immediate) {
// 			return immediate;
// 		}

// 		if (this.isFinished || this.isDisposed) {
// 			throw createSessionEndedError(
// 				`Interactive session ended before output matched ${String(pattern)}`,
// 				this.output,
// 			);
// 		}

// 		return await new Promise<InteractiveMatchResult>(
// 			(resolvePromise, rejectPromise) => {
// 				const waiter: PatternWaiter = {
// 					pattern,
// 					from,
// 					consume,
// 					timeout: setTimeout(() => {
// 						this.patternWaiters.delete(waiter);
// 						rejectPromise(createPatternTimeoutError(pattern, this.output));
// 					}, options?.timeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS),
// 					resolve: resolvePromise,
// 					reject: rejectPromise,
// 				};

// 				this.patternWaiters.add(waiter);
// 				this.flushPatternWaiters();
// 			},
// 		);
// 	}

// 	async waitForIdle(
// 		options?: {
// 			timeoutMs?: number;
// 			idleMs?: number;
// 			from?: number;
// 			consume?: boolean;
// 		},
// 	): Promise<InteractiveMatchResult> {
// 		const from = options?.from ?? this.consumedCursor;
// 		const consume = options?.consume ?? true;

// 		if (this.isFinished || this.isDisposed) {
// 			throw createSessionEndedError(
// 				"Interactive session ended before output became idle",
// 				this.output,
// 			);
// 		}

// 		return await new Promise<InteractiveMatchResult>(
// 			(resolvePromise, rejectPromise) => {
// 				const waiter: IdleWaiter = {
// 					from,
// 					consume,
// 					timeout: setTimeout(() => {
// 						this.clearIdleWaiter(waiter);
// 						rejectPromise(createIdleTimeoutError(this.output));
// 					}, options?.timeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS),
// 					idleMs: options?.idleMs ?? DEFAULT_IDLE_MS,
// 					idleTimer: undefined,
// 					hasSeenNewOutput: this.output.length > from,
// 					resolve: resolvePromise,
// 					reject: rejectPromise,
// 				};

// 				this.idleWaiters.add(waiter);
// 				this.flushIdleWaiters();
// 			},
// 		);
// 	}

// 	async write(text: string): Promise<void> {
// 		if (this.isDisposed) {
// 			throw new Error("Interactive session already disposed.");
// 		}

// 		if (this.isInputClosed) {
// 			throw new Error("Interactive session input already closed.");
// 		}

// 		this.input += text;
// 		this.history.push({
// 			input: text,
// 			output: "",
// 		});

// 		await new Promise<void>((resolvePromise, rejectPromise) => {
// 			this.stream.write(text, "utf8", (error?: Error | null) => {
// 				if (error) {
// 					rejectPromise(error);
// 					return;
// 				}
// 				resolvePromise();
// 			});
// 		});
// 	}

// 	writeLine(text: string): Promise<void> {
// 		return this.write(`${text}\n`);
// 	}

// 	sendCtrlC(): Promise<void> {
// 		return this.write("\u0003");
// 	}

// 	async resize(size: { cols: number; rows: number }): Promise<void> {
// 		if (this.isFinished || this.isDisposed) {
// 			return;
// 		}

// 		await this.execInstance.resize({
// 			w: size.cols,
// 			h: size.rows,
// 		});
// 	}

// 	async closeInput(): Promise<void> {
// 		if (this.isInputClosed) {
// 			return;
// 		}

// 		this.isInputClosed = true;

// 		await new Promise<void>((resolvePromise, rejectPromise) => {
// 			const onError = (error: Error) => {
// 				this.stream.off("error", onError);
// 				rejectPromise(error);
// 			};

// 			this.stream.once("error", onError);
// 			this.stream.end(() => {
// 				this.stream.off("error", onError);
// 				resolvePromise();
// 			});
// 		}).catch((error) => {
// 			throw error instanceof Error ? error : new Error(String(error));
// 		});
// 	}

// 	async finish(): Promise<InteractiveExecResult> {
// 		if (!this.isInputClosed) {
// 			await this.closeInput();
// 		}

// 		return await this.finishedPromise;
// 	}

// 	async dispose(): Promise<void> {
// 		if (this.isDisposed) {
// 			return;
// 		}

// 		this.isDisposed = true;
// 		this.rejectPatternWaiters((waiter) =>
// 			createSessionEndedError(
// 				`Interactive session disposed before output matched ${String(waiter.pattern)}`,
// 				this.output,
// 			),
// 		);
// 		this.rejectIdleWaiters(() =>
// 			createSessionEndedError(
// 				"Interactive session disposed before output became idle",
// 				this.output,
// 			),
// 		);

// 		if (!this.isInputClosed) {
// 			this.isInputClosed = true;
// 			this.stream.end();
// 		}

// 		this.stream.destroy();
// 		await this.finishedPromise.catch(() => undefined);
// 	}

// 	async [Symbol.asyncDispose](): Promise<void> {
// 		await this.dispose();
// 	}

// 	private tryMatch(
// 		pattern: SessionPattern,
// 		from: number,
// 		consume: boolean,
// 	): InteractiveMatchResult | undefined {
// 		const outputSinceCursor = this.output.slice(from);
// 		const details = findMatch(pattern, outputSinceCursor);

// 		if (!details) {
// 			return undefined;
// 		}

// 		const result = createMatchResult({
// 			pattern,
// 			cursorStart: from,
// 			cursorEnd: this.output.length,
// 			fullOutput: this.output,
// 			outputSinceCursor,
// 			matchText: details.matchText,
// 			matchIndex: details.matchIndex,
// 			groups: details.groups,
// 		});

// 		if (consume) {
// 			this.consumedCursor = this.output.length;
// 		}

// 		return result;
// 	}

// 	private flushPatternWaiters(): void {
// 		for (const waiter of [...this.patternWaiters]) {
// 			const result = this.tryMatch(waiter.pattern, waiter.from, waiter.consume);

// 			if (!result) {
// 				continue;
// 			}

// 			this.patternWaiters.delete(waiter);
// 			clearTimeout(waiter.timeout);
// 			waiter.resolve(result);
// 		}
// 	}

// 	private flushIdleWaiters(): void {
// 		for (const waiter of [...this.idleWaiters]) {
// 			if (this.output.length <= waiter.from) {
// 				continue;
// 			}

// 			waiter.hasSeenNewOutput = true;

// 			if (waiter.idleTimer) {
// 				clearTimeout(waiter.idleTimer);
// 			}

// 			waiter.idleTimer = setTimeout(() => {
// 				if (!waiter.hasSeenNewOutput) {
// 					return;
// 				}

// 				this.clearIdleWaiter(waiter);
// 				const outputSinceCursor = this.output.slice(waiter.from);

// 				if (waiter.consume) {
// 					this.consumedCursor = this.output.length;
// 				}

// 				waiter.resolve(
// 					createMatchResult({
// 						pattern: IDLE_PATTERN,
// 						cursorStart: waiter.from,
// 						cursorEnd: this.output.length,
// 						fullOutput: this.output,
// 						outputSinceCursor,
// 						matchText: "",
// 						matchIndex: outputSinceCursor.length,
// 						groups: [],
// 					}),
// 				);
// 			}, waiter.idleMs);
// 		}
// 	}

// 	private clearIdleWaiter(waiter: IdleWaiter): void {
// 		this.idleWaiters.delete(waiter);
// 		clearTimeout(waiter.timeout);
// 		if (waiter.idleTimer) {
// 			clearTimeout(waiter.idleTimer);
// 			waiter.idleTimer = undefined;
// 		}
// 	}

// 	private rejectPatternWaiters(
// 		createError: (waiter: PatternWaiter) => Error,
// 	): void {
// 		for (const waiter of [...this.patternWaiters]) {
// 			this.patternWaiters.delete(waiter);
// 			clearTimeout(waiter.timeout);
// 			waiter.reject(createError(waiter));
// 		}
// 	}

// 	private rejectIdleWaiters(createError: (waiter: IdleWaiter) => Error): void {
// 		for (const waiter of [...this.idleWaiters]) {
// 			this.clearIdleWaiter(waiter);
// 			waiter.reject(createError(waiter));
// 		}
// 	}
// }

// class DisposableDockerSandbox implements Sandbox {
//   private readonly docker: Docker;
//   private readonly container: Container;

// 	constructor(
// 		docker: Docker,
// 		container: Container,
//   ) {
//     this.docker = docker;
//     this.container = container;
// 	}

// 	async exec(
// 		command: string,
// 		options?: {
// 			stdinText?: string;
// 			cwd?: string;
// 			env?: Record<string, string>;
// 			user?: string;
// 		},
// 	): Promise<SbExecResult> {
// 		const stdout = new PassThrough();
// 		const stderr = new PassThrough();
// 		const stdoutChunks: Buffer[] = [];
// 		const stderrChunks: Buffer[] = [];

// 		stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
// 		stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

// 		const exec = await this.container.exec({
// 			AttachStdin: Boolean(options?.stdinText),
// 			AttachStdout: true,
// 			AttachStderr: true,
// 			Cmd: ["sh", "-lc", command],
// 			Env: toEnvArray(options?.env),
// 			User: options?.user ?? USER,
// 			WorkingDir: options?.cwd ?? HOME_DIR,
// 		});

// 		const stream = await exec.start({
// 			hijack: true,
// 			stdin: Boolean(options?.stdinText),
// 		});

// 		this.docker.modem.demuxStream(stream, stdout, stderr);

// 		if (options?.stdinText) {
// 			stream.write(options.stdinText);
// 			stream.end();
// 		}

// 		await waitForStreamEnd(stream);

// 		const info = await exec.inspect();

// 		return {
// 			exitCode: info.ExitCode ?? 1,
// 			stdout: Buffer.concat(stdoutChunks).toString("utf8"),
// 			stderr: Buffer.concat(stderrChunks).toString("utf8"),
// 		};
// 	}

// 	async startInteractive(
// 		command: string,
// 		options?: {
// 			cwd?: string;
// 			env?: Record<string, string>;
// 			user?: string;
// 			tty?: { cols: number; rows: number };
// 		},
// 	): Promise<InteractiveSession> {
// 		const exec = await this.container.exec({
// 			AttachStdin: true,
// 			AttachStdout: true,
// 			AttachStderr: true,
// 			Tty: true,
// 			Cmd: ["sh", "-lc", command],
// 			Env: toEnvArray(options?.env),
// 			User: options?.user ?? USER,
// 			WorkingDir: options?.cwd ?? HOME_DIR,
// 		});

// 		const stream = await exec.start({
// 			hijack: true,
// 			stdin: true,
// 		});

// 		const tty = options?.tty ?? DEFAULT_TTY;
// 		await exec.resize({
// 			w: tty.cols,
// 			h: tty.rows,
// 		});

// 		return new DisposableInteractiveSession(exec, stream);
// 	}

// 	async dispose(): Promise<void> {
// 		await this.container.stop({ t: 0 }).catch(() => undefined);
// 		await this.container.remove({ force: true }).catch(() => undefined);
// 	}

// 	async [Symbol.asyncDispose](): Promise<void> {
// 		await this.dispose();
// 	}
// }

// export const createSandbox = async (): Promise<Sandbox> => {
// 	const tarballInfo = await getTarballInfo();
// 	const docker = new Docker();

// 	await ensureImage(docker, tarballInfo);

// 	const container = await docker.createContainer({
// 		Image: IMAGE,
// 		Cmd: ["sleep", "infinity"],
// 		WorkingDir: HOME_DIR,
// 		User: USER,
// 		Tty: false,
// 		OpenStdin: true,
// 		StdinOnce: false,
// 		AttachStdout: false,
// 		AttachStderr: false,
// 		HostConfig: {
// 			AutoRemove: true,
// 		},
// 	});

// 	await container.start();

// 	return new DisposableDockerSandbox(docker, container);
// };

// await using sb = await createSandbox();
// // console.log(await sb.startInteractive('bage --help'));
// await using session = await sb.startInteractive('bage setup');
// // const results: SbExecResult[] = [];
// let res: InteractiveMatchResult;
// res = await session.waitFor("Alias", {})
// // console.log(res.outputSinceCursor)
// await session.writeLine("");
// res = await session.waitFor("Passphrase")
// // console.log(res.outputSinceCursor)
// await session.writeLine("mypassphrase123\n");
// res = await session.waitFor("Confirm")
// // console.log(res.outputSinceCursor)
// await session.writeLine("mypassphrase124");
// // results.push(await sb.startInteractive('bage --help'));
// // results.push(await sb.exec("bage setup"));
// // for (const result of results) {
// //   console.log(result);
// // }
