// Shared types for MLS data providers. Both Bridge Interactive and Stellar
// MLS implementations produce these normalized shapes so the rest of the app
// doesn't care which provider is backing the data.

export interface MlsListingRecord {
  providerListingId: string;
  status: "active" | "pending" | "closed" | "expired" | "cancelled" | "withdrawn" | "fsbo" | "coming_soon";
  statusChangedAt?: string; // ISO
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  price?: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  propertyType?: string;
  daysOnMarket?: number;
  listingAgent?: string;
  ownerName?: string;
  latitude?: number;
  longitude?: number;
  raw: Record<string, any>;
}

export interface MlsFilters {
  statuses?: Array<MlsListingRecord["status"]>;
  city?: string;
  zip?: string;
  county?: string;
  priceMin?: number;
  priceMax?: number;
  bedsMin?: number;
  bathsMin?: number;
  sqftMin?: number;
  sqftMax?: number;
  propertyTypes?: string[];
  domMin?: number;
  domMax?: number;
  statusChangedSince?: string; // ISO
  limit?: number;
  offset?: number;
}

export interface MlsDataProvider {
  readonly name: string;
  readonly configured: boolean;
  fetchListings(filters: MlsFilters): Promise<MlsListingRecord[]>;
  fetchByProviderListingId(id: string): Promise<MlsListingRecord | null>;
}
