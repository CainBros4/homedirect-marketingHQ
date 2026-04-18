// Bridge Interactive (Zillow-owned RESO Web API) provider.
// Free tier used for FSBO data while brokerage license is pending.
// Docs: https://bridgedataoutput.com/docs/platform/
//
// Dataset IDs we'll likely use:
//   - "zillow-fsbo" — FSBO listings from Zillow (default for pre-MLS phase)
//   - "actris_ref"  — example MLS dataset once approved

import type { MlsDataProvider, MlsFilters, MlsListingRecord } from "./types";

const API_BASE = "https://api.bridgedataoutput.com/api/v2";
const token = process.env.BRIDGE_API_TOKEN;
const dataset = process.env.BRIDGE_DATASET || "zillow-fsbo";

export const bridgeProvider: MlsDataProvider = {
  name: "bridge",
  get configured() {
    return !!token;
  },

  async fetchListings(filters: MlsFilters): Promise<MlsListingRecord[]> {
    if (!token) {
      console.warn("[marketing/bridge] BRIDGE_API_TOKEN not set — returning empty list");
      return [];
    }
    const query = buildODataFilter(filters);
    const url = new URL(`${API_BASE}/OData/${dataset}/Property`);
    if (query) url.searchParams.set("$filter", query);
    url.searchParams.set("$top", String(filters.limit ?? 50));
    if (filters.offset) url.searchParams.set("$skip", String(filters.offset));
    url.searchParams.set("access_token", token);

    try {
      const res = await fetch(url.toString());
      if (!res.ok) {
        console.error(`[marketing/bridge] ${res.status}:`, await res.text().catch(() => ""));
        return [];
      }
      const data: any = await res.json();
      return (data.value || []).map(normalizeBridgeRecord);
    } catch (err: any) {
      console.error(`[marketing/bridge] fetch error:`, err?.message || err);
      return [];
    }
  },

  async fetchByProviderListingId(id: string): Promise<MlsListingRecord | null> {
    if (!token) return null;
    const url = new URL(`${API_BASE}/OData/${dataset}/Property('${id}')`);
    url.searchParams.set("access_token", token);
    try {
      const res = await fetch(url.toString());
      if (!res.ok) return null;
      const data = await res.json();
      return normalizeBridgeRecord(data);
    } catch {
      return null;
    }
  },
};

function buildODataFilter(f: MlsFilters): string {
  const parts: string[] = [];
  if (f.statuses?.length) {
    const mlsStatuses = f.statuses.map((s) => `StandardStatus eq '${mapStatusToReso(s)}'`).join(" or ");
    parts.push(`(${mlsStatuses})`);
  }
  if (f.city) parts.push(`City eq '${escapeOData(f.city)}'`);
  if (f.zip) parts.push(`PostalCode eq '${escapeOData(f.zip)}'`);
  if (f.county) parts.push(`CountyOrParish eq '${escapeOData(f.county)}'`);
  if (f.priceMin !== undefined) parts.push(`ListPrice ge ${f.priceMin}`);
  if (f.priceMax !== undefined) parts.push(`ListPrice le ${f.priceMax}`);
  if (f.bedsMin !== undefined) parts.push(`BedroomsTotal ge ${f.bedsMin}`);
  if (f.bathsMin !== undefined) parts.push(`BathroomsTotalInteger ge ${f.bathsMin}`);
  if (f.sqftMin !== undefined) parts.push(`LivingArea ge ${f.sqftMin}`);
  if (f.sqftMax !== undefined) parts.push(`LivingArea le ${f.sqftMax}`);
  if (f.domMin !== undefined) parts.push(`DaysOnMarket ge ${f.domMin}`);
  if (f.domMax !== undefined) parts.push(`DaysOnMarket le ${f.domMax}`);
  if (f.statusChangedSince) parts.push(`StatusChangeTimestamp ge ${f.statusChangedSince}`);
  return parts.join(" and ");
}

function escapeOData(v: string): string {
  return v.replace(/'/g, "''");
}

function mapStatusToReso(s: MlsListingRecord["status"]): string {
  switch (s) {
    case "active": return "Active";
    case "pending": return "Pending";
    case "closed": return "Closed";
    case "expired": return "Expired";
    case "cancelled": return "Canceled";
    case "withdrawn": return "Withdrawn";
    case "coming_soon": return "Coming Soon";
    case "fsbo": return "Active"; // Zillow FSBO dataset stores FSBO as Active
    default: return "Active";
  }
}

function mapStatusFromReso(s: string | undefined): MlsListingRecord["status"] {
  const v = (s || "").toLowerCase();
  if (v.includes("pending")) return "pending";
  if (v.includes("closed")) return "closed";
  if (v.includes("expired")) return "expired";
  if (v.includes("cancel")) return "cancelled";
  if (v.includes("withdrawn")) return "withdrawn";
  if (v.includes("coming")) return "coming_soon";
  return "active";
}

function normalizeBridgeRecord(r: any): MlsListingRecord {
  return {
    providerListingId: String(r.ListingKey || r.ListingId || r.Id),
    status: mapStatusFromReso(r.StandardStatus || r.MlsStatus),
    statusChangedAt: r.StatusChangeTimestamp,
    address: [r.StreetNumber, r.StreetName, r.StreetSuffix].filter(Boolean).join(" "),
    city: r.City,
    state: r.StateOrProvince,
    zip: r.PostalCode,
    county: r.CountyOrParish,
    price: r.ListPrice,
    beds: r.BedroomsTotal,
    baths: r.BathroomsTotalInteger,
    sqft: r.LivingArea,
    propertyType: r.PropertyType,
    daysOnMarket: r.DaysOnMarket,
    listingAgent: r.ListAgentFullName,
    ownerName: r.OwnerName,
    latitude: r.Latitude,
    longitude: r.Longitude,
    raw: r,
  };
}
