import { NextResponse } from "next/server";
import { getCurrentSupabaseUser } from "@/lib/auth/supabase-session";
import { previewHuataiCsv, type ImportKind } from "@/lib/portfolio/huatai-csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Preview is intentionally local/in-memory: this endpoint does not persist source files
// or ledger rows. A separate commit flow will be added after a real Huatai sample validates
// the parser mappings and the private Storage bucket is provisioned.
export async function POST(request: Request) {
  const user = await getCurrentSupabaseUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let form: FormData;
  try { form = await request.formData(); }
  catch { return NextResponse.json({ error: "invalid_multipart_request" }, { status: 400 }); }

  const file = form.get("file");
  const kind = form.get("kind");
  if (!(file instanceof File)) return NextResponse.json({ error: "file_required" }, { status: 400 });
  if (kind !== "holdings_snapshot" && kind !== "executions") {
    return NextResponse.json({ error: "invalid_import_kind" }, { status: 400 });
  }
  if (!/\.(csv|txt)$/i.test(file.name)) {
    return NextResponse.json({ error: "unsupported_file_type", supported: [".csv", ".txt"] }, { status: 415 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "file_too_large", limitBytes: 10 * 1024 * 1024 }, { status: 413 });
  }
  try {
    const preview = previewHuataiCsv(await file.arrayBuffer(), kind as ImportKind);
    return NextResponse.json({
      preview: {
        ...preview,
        fileName: file.name,
        fileSize: file.size,
        acceptedCount: preview.acceptedRows.length,
        rejectedCount: preview.rejectedRows.length,
        commitAvailable: false,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({
      error: "file_parse_failed",
      message: error instanceof Error ? error.message : "Unable to parse file",
    }, { status: 422, headers: { "Cache-Control": "no-store" } });
  }
}
