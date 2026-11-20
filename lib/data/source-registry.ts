export type SourceKind = "api" | "file" | "manual";
export type LicenseStatus = "unverified" | "public_api" | "licensed" | "restricted";
export interface SourceDefinition {
  id: string; name: string; kind: SourceKind; domains: string[]; baseUrl: string | null;
  expectedCadence: string; licenseStatus: LicenseStatus; enabled: boolean; notes: string;
}
export const SOURCE_REGISTRY: readonly SourceDefinition[] = [
  { id: "fred", name: "Federal Reserve Economic Data", kind: "api", domains: ["macro"], baseUrl: "https://api.stlouisfed.org/fred", expectedCadence: "daily / weekly", licenseStatus: "public_api", enabled: false, notes: "Requires a FRED API key; verify series definitions and publication lags." },
  { id: "cftc", name: "Commodity Futures Trading Commission", kind: "api", domains: ["positioning"], baseUrl: "https://publicreporting.cftc.gov", expectedCadence: "weekly", licenseStatus: "public_api", enabled: false, notes: "Disaggregated futures-only COMEX standard Silver contract 084691; report date is Tuesday-as-of, publication date is not inferred." },
  { id: "cme-comex", name: "CME / COMEX", kind: "file", domains: ["inventory_liquidity"], baseUrl: "https://www.cmegroup.com/solutions/clearing/operations-and-deliveries/nymex-delivery-notices.html", expectedCadence: "daily", licenseStatus: "unverified", enabled: false, notes: "Official Silver Stocks XLS is imported through the protected CSV endpoint after controlled conversion; review CME data terms before redistribution or commercial use." },
  { id: "licensed-market-data", name: "Licensed market data provider", kind: "file", domains: ["macro"], baseUrl: null, expectedCadence: "daily", licenseStatus: "unverified", enabled: false, notes: "Silver spot CSV import is disabled until provider identity, HTTPS source URL and commercial usage rights are configured." },
  { id: "lbma", name: "London Bullion Market Association", kind: "file", domains: ["inventory_liquidity", "supply_demand"], baseUrl: "https://www.lbma.org.uk", expectedCadence: "monthly", licenseStatus: "restricted", enabled: false, notes: "LBMA benchmark prices and historical tables require appropriate IBA usage rights; do not scrape or redistribute unlicensed data." },
] as const;
export function getSource(sourceId: string): SourceDefinition | undefined {
  return SOURCE_REGISTRY.find((source) => source.id === sourceId);
}
