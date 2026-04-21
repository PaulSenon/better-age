import { Option, Schema } from "effect";
import {
	KnownIdentity,
	RetiredKey,
	SelfIdentity,
	type StoredIdentityRecord,
	toStoredIdentityRecord,
} from "../identity/Identity.js";
import { KeyFingerprint } from "../identity/KeyFingerprint.js";

export const RotationTtl = Schema.Literal("1w", "1m", "3m", "6m", "9m", "1y");
export type RotationTtl = Schema.Schema.Type<typeof RotationTtl>;

export const HomeState = Schema.Struct({
	activeKeyFingerprint: Schema.OptionFromNullOr(KeyFingerprint),
	defaultEditorCommand: Schema.OptionFromNullOr(Schema.String),
	homeSchemaVersion: Schema.Literal(1),
	knownIdentities: Schema.Array(KnownIdentity),
	retiredKeys: Schema.Array(RetiredKey),
	rotationTtl: RotationTtl,
	self: Schema.OptionFromNullOr(SelfIdentity),
});

export type HomeState = Schema.Schema.Type<typeof HomeState>;

export const emptyHomeState = (): HomeState => ({
	activeKeyFingerprint: Option.none(),
	defaultEditorCommand: Option.none(),
	homeSchemaVersion: 1,
	knownIdentities: [],
	retiredKeys: [],
	rotationTtl: "3m",
	self: Option.none(),
});

export const getSelfIdentity = (state: HomeState) => state.self;

export const getDefaultEditorCommand = (state: HomeState) =>
	state.defaultEditorCommand;

export const getActiveKey = (
	state: HomeState,
): Option.Option<Schema.Schema.Type<typeof StoredIdentityRecord>> =>
	Option.zipWith(state.self, state.activeKeyFingerprint, (self, fingerprint) =>
		self.fingerprint === fingerprint ? toStoredIdentityRecord(self) : null,
	).pipe(
		Option.filter((record): record is StoredIdentityRecord => record !== null),
	);
