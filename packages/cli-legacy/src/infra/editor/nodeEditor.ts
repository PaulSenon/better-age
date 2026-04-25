import { spawn as nodeSpawn } from "node:child_process";
import { Effect, Layer } from "effect";
import { Editor } from "../../port/Editor.js";
import { EditorExitError, EditorLaunchError } from "../../port/EditorError.js";

type SpawnedProcess = Pick<
	ReturnType<typeof nodeSpawn>,
	"stderr" | "stdout"
> & {
	once(
		event: "close",
		listener: (code: number | null, signal: NodeJS.Signals | null) => void,
	): SpawnedProcess;
	once(event: "error", listener: (error: Error) => void): SpawnedProcess;
};

export type SpawnLike = (
	command: string,
	args: ReadonlyArray<string>,
	options: { readonly stdio: "inherit" },
) => SpawnedProcess;

export const parseEditorCommand = (
	configured: string,
): { readonly args: ReadonlyArray<string>; readonly command: string } => {
	const [command, ...args] = configured.split(/\s+/).filter(Boolean);

	if (command === undefined) {
		throw new EditorLaunchError({
			message: "Failed to launch editor",
		});
	}

	return { args, command };
};

export const makeNodeEditor = (input?: { readonly spawn?: SpawnLike }) =>
	Editor.make({
		editFile: ({ command, path }) =>
			Effect.gen(function* () {
				const spawnProcess: SpawnLike =
					input?.spawn ??
					((command, args, options) => {
						const child = nodeSpawn(command, [...args], {
							stdio: options.stdio,
						});
						const wrapped: SpawnedProcess = {
							stderr: child.stderr,
							stdout: child.stdout,
							once(event, listener) {
								child.once(event, listener);
								return wrapped;
							},
						};
						return wrapped;
					});
				const resolved = yield* Effect.try({
					catch: (cause) =>
						cause instanceof EditorLaunchError
							? cause
							: new EditorLaunchError({
									message: "Failed to launch editor",
								}),
					try: () => parseEditorCommand(command),
				});

				yield* Effect.async<void, EditorExitError | EditorLaunchError>(
					(resume) => {
						const child = spawnProcess(
							resolved.command,
							[...resolved.args, path],
							{ stdio: "inherit" },
						);

						child.once("error", () => {
							resume(
								Effect.fail(
									new EditorLaunchError({
										message: "Failed to launch editor",
									}),
								),
							);
						});
						child.once(
							"close",
							(code: number | null, signal: NodeJS.Signals | null) => {
								if (code === 0 && signal === null) {
									resume(Effect.void);
									return;
								}

								resume(
									Effect.fail(
										new EditorExitError({
											message:
												signal === null
													? `Editor exited with code ${String(code)}`
													: `Editor exited from signal ${signal}`,
										}),
									),
								);
							},
						);
					},
				);
			}),
	});

export const NodeEditorLive = Layer.succeed(Editor, makeNodeEditor());
