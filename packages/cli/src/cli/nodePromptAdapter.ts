import { confirm, input, password, select } from "@inquirer/prompts";
import { CliPromptCancelledError } from "./secretPrompt.js";

type PromptContext = {
	readonly clearPromptOnDone: boolean;
	readonly input: NodeJS.ReadableStream;
	readonly output: NodeJS.WritableStream;
};

type SelectChoice = {
	readonly disabled: boolean;
	readonly label: string;
	readonly value: string;
};

export type NodePromptFunctions = {
	readonly confirm: (
		config: { readonly message: string },
		context: PromptContext,
	) => Promise<boolean>;
	readonly input: (
		config: { readonly default?: string; readonly message: string },
		context: PromptContext,
	) => Promise<string>;
	readonly password: (
		config: { readonly mask: boolean | string; readonly message: string },
		context: PromptContext,
	) => Promise<string>;
	readonly select: (
		config: {
			readonly choices: ReadonlyArray<{
				readonly disabled?: boolean | string;
				readonly name: string;
				readonly value: string;
			}>;
			readonly default?: string;
			readonly message: string;
		},
		context: PromptContext,
	) => Promise<string>;
};

export type NodePromptAdapter = {
	readonly confirm: (label: string) => Promise<boolean>;
	readonly promptSecret: (label: string) => Promise<string>;
	readonly promptText: (
		label: string,
		defaultValue?: string,
	) => Promise<string>;
	readonly selectOne: (
		label: string,
		choices: ReadonlyArray<SelectChoice>,
	) => Promise<string>;
	readonly waitForEnter: (label: string) => Promise<void>;
};

type NodePromptAdapterInput = {
	readonly promptFns?: NodePromptFunctions;
	readonly stderr: NodeJS.WritableStream;
	readonly stdin: NodeJS.ReadableStream;
};

const defaultPromptFns: NodePromptFunctions = {
	confirm,
	input,
	password: (config, context) =>
		password({ mask: config.mask, message: config.message }, context),
	select,
};

const isPromptCancelled = (cause: unknown) =>
	cause instanceof CliPromptCancelledError ||
	(cause instanceof Error &&
		(cause.name === "ExitPromptError" || cause.name === "AbortPromptError"));

const normalizePromptError = (cause: unknown): never => {
	if (isPromptCancelled(cause)) {
		throw new CliPromptCancelledError();
	}

	throw cause;
};

const withCancellation = async <TValue>(
	run: () => Promise<TValue>,
): Promise<TValue> => {
	try {
		return await run();
	} catch (cause) {
		return normalizePromptError(cause);
	}
};

const toInquirerChoices = (choices: ReadonlyArray<SelectChoice>) =>
	choices.map((choice) => ({
		value: choice.value,
		name: choice.label,
		...(choice.disabled ? { disabled: true } : {}),
	}));

const toSelectConfig = (
	label: string,
	choices: ReadonlyArray<SelectChoice>,
) => {
	const defaultChoice = choices.find((choice) => !choice.disabled);
	const baseConfig = {
		choices: toInquirerChoices(choices),
		message: label,
	};

	return defaultChoice === undefined
		? baseConfig
		: { ...baseConfig, default: defaultChoice.value };
};

export const createNodePromptAdapter = (
	inputRuntime: NodePromptAdapterInput,
): NodePromptAdapter => {
	const promptFns = inputRuntime.promptFns ?? defaultPromptFns;
	const context: PromptContext = {
		clearPromptOnDone: false,
		input: inputRuntime.stdin,
		output: inputRuntime.stderr,
	};

	return {
		confirm: async (label) =>
			await withCancellation(() =>
				promptFns.confirm({ message: label }, context),
			),
		promptSecret: async (label) =>
			await withCancellation(() =>
				promptFns.password({ mask: false, message: label }, context),
			),
		promptText: async (label, defaultValue) =>
			await withCancellation(() =>
				promptFns.input(
					{
						...(defaultValue === undefined ? {} : { default: defaultValue }),
						message: label,
					},
					context,
				),
			),
		selectOne: async (label, choices) =>
			await withCancellation(() =>
				promptFns.select(toSelectConfig(label, choices), context),
			),
		waitForEnter: async (label) => {
			await withCancellation(() =>
				promptFns.input({ default: "", message: label }, context),
			);
		},
	};
};
