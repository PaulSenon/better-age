import { Option } from "effect";
import { toPublicIdentityFromSelfIdentity } from "../identity/Identity.js";
import type { HomeState } from "./HomeState.js";

export const isSelfOwnerId = (state: HomeState, ownerId: string) =>
	Option.isSome(state.self) &&
	toPublicIdentityFromSelfIdentity(state.self.value).ownerId === ownerId;
