// Stellar MLS (Florida's primary MLS, covers Tampa Bay) provider — STUB.
//
// This implementation is intentionally empty. Once the brokerage license is
// approved and Stellar provides an API token + endpoint, fill in fetchListings
// and fetchByProviderListingId. The rest of the app doesn't need to change —
// flipping MLS_PROVIDER=stellar in env vars routes everything here.
//
// Docs once you have access: https://www.stellarmls.com/products/api

import type { MlsDataProvider, MlsFilters, MlsListingRecord } from "./types";

const token = process.env.STELLAR_API_TOKEN;
const apiBase = process.env.STELLAR_API_BASE;

export const stellarProvider: MlsDataProvider = {
  name: "stellar",
  get configured() {
    return !!(token && apiBase);
  },

  async fetchListings(_filters: MlsFilters): Promise<MlsListingRecord[]> {
    if (!this.configured) {
      console.warn("[marketing/stellar] STELLAR_API_TOKEN / STELLAR_API_BASE not set — returning empty list. Fill these once brokerage membership is approved.");
      return [];
    }
    // TODO: implement once we have MLS access. Pattern will mirror bridge.ts —
    // RESO OData query with $filter + status mapping.
    throw new Error("Stellar MLS provider not yet implemented. Add RESO Web API calls here.");
  },

  async fetchByProviderListingId(_id: string): Promise<MlsListingRecord | null> {
    if (!this.configured) return null;
    throw new Error("Stellar MLS provider not yet implemented.");
  },
};
