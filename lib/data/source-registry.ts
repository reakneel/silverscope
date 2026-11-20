export type SourceKind = "api" | "file" | "manual";
export type LicenseStatus = "unverified" | "public_api" | "licensed" | "restricted";
export interface SourceDefinition {
  id: string; name: string; kind: SourceKind; domains: string[]; baseUrl: string | null;
  expectedCadence: string; licenseStatus: LicenseStatus; enabled: boolean; notes: string;
}
export const SOURCE_REGISTRY: readonly SourceDefinition[] = [
  { id: "fred", name: "Federal Reserve Economic Data", kind: "api", domains: ["macro"], baseUrl: "https://api.stlouisfed.org/fred", expectedCadence: "daily / weekly", licenseStatus: "public_api", enabled: false, notes: "Requires a FRED API key; verify series definitions and publication lags." },
  { id: "cftc", name: "Commodity Futures Trading Commission", kind: "api", domains: ["positioning"], baseUrl: "https://publicreporting.cftc.gov", expectedCadence: "weekly", licenseStatus: "public_api", enabled: false, notes: "Disaggregated futures-only COMEX standard Silver contract 084691; report date is Tuesday-as-of, publication date is not inferred." },
  { id: "cme-comex", name: "CME / COMEX", kind: "api", domains: ["inventory_liquidity"], baseUrl: "https://www.cmegroup.com", expectedCadence: "daily", licenseStatus: "unverified", enabled: false, notes: "Confirm redistribution and licensing terms before production ingestion." },
  { id: "lbma", name: "London Bullion Market Association", kind: "file", domains: ["inventory_liquidity", "supply_demand"], baseUrl: "https://www.lbma.org.uk", expectedCadence: "monthly", licenseStatus: "unverified", enabled: false, notes: "Confirm data access and redistribution terms." },
] as const;
export function getSource(sourceId: string): SourceDefinition | undefined {
  return SOURCE_REGISTRY.find((source) => source.id === sourceId);
}
