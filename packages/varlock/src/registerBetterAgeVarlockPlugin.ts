import type { Resolver } from "varlock/plugin-lib";
import {
	type BetterAgeInitConfig,
	createBetterAgeRuntime,
} from "./runtime/createBetterAgeRuntime.js";

type BetterAgePluginErrorConstructors = {
	ResolutionError: new (message: string) => Error;
	SchemaError: new (message: string) => Error;
};

type BetterAgeFnArgsResolver = {
	arr: Array<unknown>;
	obj: Record<string, unknown>;
};

type BetterAgeRootDecoratorDef = {
	execute?: (config: BetterAgeInitConfig) => void;
	isFunction?: boolean;
	name: string;
	process?: (argsResolver: Resolver) => Promise<BetterAgeInitConfig>;
	useFnArgsResolver?: boolean;
};

type BetterAgeResolverFunctionDef = {
	argsSchema?: {
		arrayExactLength?: number;
		arrayMaxLength?: number;
		type: "array";
	};
	name: string;
	resolve: () => Promise<string>;
};

export type BetterAgeVarlockPluginRegistration = {
	ERRORS: BetterAgePluginErrorConstructors;
	icon?: string;
	name?: string;
	registerResolverFunction: (resolverDef: BetterAgeResolverFunctionDef) => void;
	registerRootDecorator: (decoratorDef: BetterAgeRootDecoratorDef) => void;
};

const getErrorMessage = (error: unknown) =>
	error instanceof Error ? error.message : String(error);

const parseFunctionArgs = async (
	argsResolver: Pick<Resolver, "resolve">,
): Promise<BetterAgeFnArgsResolver> => {
	const resolvedArgs = await argsResolver.resolve();

	if (
		typeof resolvedArgs !== "object" ||
		resolvedArgs === null ||
		!("arr" in resolvedArgs) ||
		!("obj" in resolvedArgs)
	) {
		throw new Error("Expected function-style decorator args");
	}

	const arr = resolvedArgs.arr;
	const obj = resolvedArgs.obj;

	if (!Array.isArray(arr) || typeof obj !== "object" || obj === null) {
		throw new Error("Expected function-style decorator args");
	}

	return {
		arr,
		obj: obj as Record<string, unknown>,
	};
};

export const registerBetterAgeVarlockPlugin = (
	currentPlugin: BetterAgeVarlockPluginRegistration,
	runtime = createBetterAgeRuntime(),
) => {
	const { ResolutionError, SchemaError } = currentPlugin.ERRORS;

	currentPlugin.name = "@better-age/varlock";
	currentPlugin.icon = "mdi:key-lock";

	currentPlugin.registerRootDecorator({
		name: "initBetterAge",
		isFunction: true,
		useFnArgsResolver: true,
		process: async (argsResolver) => {
			const resolvedArgs = await parseFunctionArgs(argsResolver);
			const command = resolvedArgs.obj.command;
			const path = resolvedArgs.obj.path;

			if (typeof path !== "string" || path.trim().length === 0) {
				throw new SchemaError("@initBetterAge requires path=<payload-path>");
			}

			if (
				command !== undefined &&
				(typeof command !== "string" || command.trim().length === 0)
			) {
				throw new SchemaError(
					"@initBetterAge command must be a non-empty string when provided",
				);
			}

			return command === undefined ? { path } : { command, path };
		},
		execute: (initConfig) => {
			try {
				runtime.init(initConfig);
			} catch (error) {
				throw new SchemaError(getErrorMessage(error));
			}
		},
	});

	currentPlugin.registerResolverFunction({
		name: "betterAgeLoad",
		argsSchema: {
			type: "array",
			arrayMaxLength: 0,
		},
		resolve: async () => {
			try {
				return await runtime.loadEnvText();
			} catch (error) {
				throw new ResolutionError(getErrorMessage(error));
			}
		},
	});
};
