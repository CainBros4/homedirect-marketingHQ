// Provider registry — returns whichever MLS provider is configured via
// MLS_PROVIDER env var. Defaults to "bridge" for the pre-brokerage-license
// phase; flip to "stellar" once the Stellar MLS account is live.

import type { MlsDataProvider } from "./types";
import { bridgeProvider } from "./bridge";
import { stellarProvider } from "./stellar";

const providerName = process.env.MLS_PROVIDER || "bridge";

const registry: Record<string, MlsDataProvider> = {
  bridge: bridgeProvider,
  stellar: stellarProvider,
};

export function getMlsProvider(): MlsDataProvider {
  const p = registry[providerName];
  if (!p) {
    console.warn(`[marketing/providers] Unknown MLS_PROVIDER="${providerName}", falling back to bridge`);
    return bridgeProvider;
  }
  return p;
}

export { bridgeProvider, stellarProvider };
export type { MlsDataProvider, MlsFilters, MlsListingRecord } from "./types";
