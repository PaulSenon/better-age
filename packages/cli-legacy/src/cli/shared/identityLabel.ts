import { Option } from "effect";

export const renderIdentityLabel = (input: {
	readonly displayName: string;
	readonly handle: string;
	readonly isYou: boolean;
	readonly localAlias: Option.Option<string>;
}) => {
	const prefix = Option.match(input.localAlias, {
		onNone: () => "",
		onSome: (localAlias) => `${localAlias}: `,
	});

	return `${prefix}${input.displayName} (${input.handle})${input.isYou ? " [you]" : ""}`;
};

export const renderHandleCandidate = (input: {
	readonly displayName: Option.Option<string>;
	readonly handle: string;
	readonly isYou: boolean;
	readonly localAlias: Option.Option<string>;
}) =>
	Option.match(input.displayName, {
		onNone: () => `${input.handle}${input.isYou ? " [you]" : ""}`,
		onSome: (displayName) =>
			renderIdentityLabel({
				displayName,
				handle: input.handle,
				isYou: input.isYou,
				localAlias: input.localAlias,
			}),
	});
