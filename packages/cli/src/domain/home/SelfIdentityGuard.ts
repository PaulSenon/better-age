import { Option } from "effect";
import type { HomeState } from "./HomeState.js";

export const isSelfOwnerId = (state: HomeState, ownerId: string) =>
	Option.isSome(state.self) && state.self.value.ownerId === ownerId;
