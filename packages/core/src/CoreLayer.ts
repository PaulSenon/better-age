import { Layer } from "effect";
import { AgeCrypto } from "./services/AgeCrypto.js";
import { HomeStore } from "./services/HomeStore.js";
import { PayloadFiles } from "./services/PayloadFiles.js";

/**
 * Live Core services for a home directory. Requires the platform `FileSystem`
 * and `Path` services (e.g. `NodeServices.layer`); use cases additionally use
 * the platform `Crypto` service for random ids.
 */
export const layer = (options: { readonly homeDir: string }) =>
	Layer.mergeAll(HomeStore.layer(options), PayloadFiles.layer, AgeCrypto.layer);
