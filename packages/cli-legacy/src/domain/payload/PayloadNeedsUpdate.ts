import type { HomeState } from "../home/HomeState.js";
import type { PayloadEnvelope } from "./PayloadEnvelope.js";
import {
	computePayloadUpdateState,
	type PayloadUpdateState,
	toPayloadNeedsUpdate,
} from "./PayloadUpdateState.js";

export type PayloadNeedsUpdate = ReturnType<typeof toPayloadNeedsUpdate>;

export const getPayloadNeedsUpdate = (
	state: HomeState,
	envelope: PayloadEnvelope,
	input?: {
		readonly persistedSchemaVersion?: number;
	},
): PayloadNeedsUpdate =>
	toPayloadNeedsUpdate(computePayloadUpdateState(state, envelope, input));

export type { PayloadUpdateState };
