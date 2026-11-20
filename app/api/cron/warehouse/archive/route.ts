import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cold archival is intentionally workstation-driven: Vercel cannot verify an
// independent local archive before deleting rows from the primary database.
export async function GET() {
  return NextResponse.json({
    error: "cold_archive_requires_verified_local_backup",
    message: "Automatic in-database archival is disabled. Export and verify a local cold archive first; use scripts/db/cold-archive-observations.py --apply-delete only after reviewing its SHA-256 manifest and row parity.",
  }, { status: 410, headers: { "Cache-Control": "no-store" } });
}
export const POST = GET;
