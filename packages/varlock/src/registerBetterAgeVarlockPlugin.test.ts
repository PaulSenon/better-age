import { describe, expect, it, vi } from "vitest";
import {
	type BetterAgeVarlockPluginRegistration,
	registerBetterAgeVarlockPlugin,
} from "./registerBetterAgeVarlockPlugin.js";

type RootDecoratorCapture = {
	execute?: (config: { path: string }) => void;
	name: string;
	process?: Parameters<
		BetterAgeVarlockPluginRegistration["registerRootDecorator"]
	>[0]["process"];
	useFnArgsResolver?: boolean;
};

type ResolverFunctionCapture = {
	argsSchema?: {
		arrayMaxLength?: number;
		type: "array";
	};
	name: string;
	resolve: () => Promise<string>;
};

describe("registerBetterAgeVarlockPlugin", () => {
	it("registers the v0 init decorator and bulk-load resolver", async () => {
		class FakeSchemaError extends Error {}
		class FakeResolutionError extends Error {}

		const rootDecorators: Array<RootDecoratorCapture> = [];
		const resolverFunctions: Array<ResolverFunctionCapture> = [];
		const runtime = {
			init: vi.fn(),
			loadEnvText: vi.fn(async () => "API_TOKEN=secret\n"),
		};
		const fakePlugin: BetterAgeVarlockPluginRegistration = {
			ERRORS: {
				SchemaError: FakeSchemaError,
				ResolutionError: FakeResolutionError,
			},
			registerRootDecorator: vi.fn((decorator) => {
				rootDecorators.push(decorator);
			}),
			registerResolverFunction: vi.fn((resolver) => {
				resolverFunctions.push(resolver);
			}),
		};

		registerBetterAgeVarlockPlugin(fakePlugin, runtime);

		expect(fakePlugin.name).toBe("@better-age/varlock");
		expect(fakePlugin.icon).toBe("mdi:key-lock");
		expect(rootDecorators).toHaveLength(1);
		expect(resolverFunctions).toHaveLength(1);
		expect(rootDecorators[0]?.name).toBe("initBetterAge");
		expect(rootDecorators[0]?.useFnArgsResolver).toBe(true);
		expect(resolverFunctions[0]?.name).toBe("betterAgeLoad");
		expect(resolverFunctions[0]?.argsSchema).toEqual({
			type: "array",
			arrayMaxLength: 0,
		});

		const initConfig = await rootDecorators[0]?.process?.({
			resolve: async () => ({
				arr: [],
				obj: {
					path: "./.env.enc",
				},
			}),
		} as unknown as Parameters<
			Exclude<RootDecoratorCapture["process"], undefined>
		>[0]);
		rootDecorators[0]?.execute?.(initConfig ?? { path: "" });

		await expect(resolverFunctions[0]?.resolve()).resolves.toBe(
			"API_TOKEN=secret\n",
		);
		expect(runtime.init).toHaveBeenCalledWith({ path: "./.env.enc" });
		expect(runtime.loadEnvText).toHaveBeenCalledTimes(1);
	});

	it("passes optional command through initBetterAge(...)", async () => {
		class FakeSchemaError extends Error {}
		class FakeResolutionError extends Error {}

		const rootDecorators: Array<RootDecoratorCapture> = [];
		const runtime = {
			init: vi.fn(),
			loadEnvText: vi.fn(async () => "unused\n"),
		};

		registerBetterAgeVarlockPlugin(
			{
				ERRORS: {
					SchemaError: FakeSchemaError,
					ResolutionError: FakeResolutionError,
				},
				registerRootDecorator: (decorator) => {
					rootDecorators.push(decorator);
				},
				registerResolverFunction: () => {},
			},
			runtime,
		);

		const initConfig = await rootDecorators[0]?.process?.({
			resolve: async () => ({
				arr: [],
				obj: {
					command: "node /tmp/better-age-cli.cjs",
					path: "./.env.enc",
				},
			}),
		} as unknown as Parameters<
			Exclude<RootDecoratorCapture["process"], undefined>
		>[0]);

		rootDecorators[0]?.execute?.(initConfig ?? { path: "" });

		expect(runtime.init).toHaveBeenCalledWith({
			command: "node /tmp/better-age-cli.cjs",
			path: "./.env.enc",
		});
	});

	it("fails with schema error when initBetterAge(...) is missing path", async () => {
		class FakeSchemaError extends Error {}
		class FakeResolutionError extends Error {}

		const rootDecorators: Array<RootDecoratorCapture> = [];

		registerBetterAgeVarlockPlugin({
			ERRORS: {
				SchemaError: FakeSchemaError,
				ResolutionError: FakeResolutionError,
			},
			registerRootDecorator: (decorator) => {
				rootDecorators.push(decorator);
			},
			registerResolverFunction: () => {},
		});

		await expect(
			rootDecorators[0]?.process?.({
				resolve: async () => ({
					arr: [],
					obj: {},
				}),
			} as unknown as Parameters<
				Exclude<RootDecoratorCapture["process"], undefined>
			>[0]),
		).rejects.toThrow("@initBetterAge requires path=<payload-path>");
	});

	it("fails with schema error when path is whitespace only", async () => {
		class FakeSchemaError extends Error {}
		class FakeResolutionError extends Error {}

		const rootDecorators: Array<RootDecoratorCapture> = [];

		registerBetterAgeVarlockPlugin({
			ERRORS: {
				SchemaError: FakeSchemaError,
				ResolutionError: FakeResolutionError,
			},
			registerRootDecorator: (decorator) => {
				rootDecorators.push(decorator);
			},
			registerResolverFunction: () => {},
		});

		await expect(
			rootDecorators[0]?.process?.({
				resolve: async () => ({
					arr: [],
					obj: {
						path: "   ",
					},
				}),
			} as unknown as Parameters<
				Exclude<RootDecoratorCapture["process"], undefined>
			>[0]),
		).rejects.toThrow("@initBetterAge requires path=<payload-path>");
	});

	it("fails with schema error when command is empty", async () => {
		class FakeSchemaError extends Error {}
		class FakeResolutionError extends Error {}

		const rootDecorators: Array<RootDecoratorCapture> = [];

		registerBetterAgeVarlockPlugin({
			ERRORS: {
				SchemaError: FakeSchemaError,
				ResolutionError: FakeResolutionError,
			},
			registerRootDecorator: (decorator) => {
				rootDecorators.push(decorator);
			},
			registerResolverFunction: () => {},
		});

		await expect(
			rootDecorators[0]?.process?.({
				resolve: async () => ({
					arr: [],
					obj: {
						command: "",
						path: "./.env.enc",
					},
				}),
			} as unknown as Parameters<
				Exclude<RootDecoratorCapture["process"], undefined>
			>[0]),
		).rejects.toThrow(
			"@initBetterAge command must be a non-empty string when provided",
		);
	});

	it("fails with schema error when command is whitespace only", async () => {
		class FakeSchemaError extends Error {}
		class FakeResolutionError extends Error {}

		const rootDecorators: Array<RootDecoratorCapture> = [];

		registerBetterAgeVarlockPlugin({
			ERRORS: {
				SchemaError: FakeSchemaError,
				ResolutionError: FakeResolutionError,
			},
			registerRootDecorator: (decorator) => {
				rootDecorators.push(decorator);
			},
			registerResolverFunction: () => {},
		});

		await expect(
			rootDecorators[0]?.process?.({
				resolve: async () => ({
					arr: [],
					obj: {
						command: "   ",
						path: "./.env.enc",
					},
				}),
			} as unknown as Parameters<
				Exclude<RootDecoratorCapture["process"], undefined>
			>[0]),
		).rejects.toThrow(
			"@initBetterAge command must be a non-empty string when provided",
		);
	});
});
