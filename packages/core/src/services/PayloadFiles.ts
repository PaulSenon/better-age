// Caller-owned encrypted payload files (anywhere on disk, e.g. `.env.enc`).
import { Context, Effect, FileSystem, Layer, Option, Path } from "effect";

export class PayloadFiles extends Context.Service<
	PayloadFiles,
	{
		readonly exists: (path: string) => Effect.Effect<boolean>;
		/** None when the file cannot be read. */
		readonly read: (path: string) => Effect.Effect<Option.Option<string>>;
		/** Same-directory `<path>.tmp` then rename, so readers never see a partial file. */
		readonly write: (path: string, contents: string) => Effect.Effect<void>;
	}
>()("@better-age/core/PayloadFiles") {
	static readonly layer = Layer.effect(PayloadFiles)(
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;

			return PayloadFiles.of({
				exists: (target) => fs.exists(target).pipe(Effect.orDie),
				read: (target) =>
					fs.readFileString(target).pipe(
						Effect.map(Option.some),
						Effect.orElseSucceed(() => Option.none()),
					),
				write: (target, contents) => {
					const temp = `${target}.tmp`;

					return Effect.gen(function* () {
						yield* fs.makeDirectory(path.dirname(target), { recursive: true });
						yield* fs.writeFileString(temp, contents);
						yield* fs.rename(temp, target);
					}).pipe(
						Effect.onError(() =>
							fs.remove(temp, { force: true }).pipe(Effect.ignore),
						),
						Effect.orDie,
					);
				},
			});
		}),
	);
}
