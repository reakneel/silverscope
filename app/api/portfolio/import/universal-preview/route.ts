import { NextResponse } from "next/server";
import { getCurrentSupabaseUser } from "@/lib/auth/supabase-session";
import { previewUniversalImport,type UniversalImportKind,type CanonicalField } from "@/lib/portfolio/universal-import";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function POST(request:Request){
 const user=await getCurrentSupabaseUser();if(!user)return NextResponse.json({error:"unauthorized"},{status:401});
 let form:FormData;try{form=await request.formData();}catch{return NextResponse.json({error:"invalid_multipart_request"},{status:400});}
 const file=form.get("file"),kind=form.get("kind");if(!(file instanceof File))return NextResponse.json({error:"file_required"},{status:400});
 if(!["holdings_snapshot","executions","cash_ledger"].includes(String(kind)))return NextResponse.json({error:"invalid_import_kind"},{status:400});
 if(!/\.(csv|txt)$/i.test(file.name))return NextResponse.json({error:"unsupported_file_type",supported:[".csv",".txt"]},{status:415});
 if(file.size>10*1024*1024)return NextResponse.json({error:"file_too_large"},{status:413});
 try{const raw=form.get("mapping");const mapping=raw?JSON.parse(String(raw)) as Partial<Record<CanonicalField,string>>:{};const preview=previewUniversalImport(await file.arrayBuffer(),kind as UniversalImportKind,mapping);return NextResponse.json({preview:{...preview,fileName:file.name,fileSize:file.size,acceptedCount:preview.acceptedRows.length,rejectedCount:preview.rejectedRows.length,commitAvailable:false}},{headers:{"Cache-Control":"no-store"}});}
 catch(e){return NextResponse.json({error:"file_parse_failed",message:e instanceof Error?e.message:"Unable to parse file"},{status:422,headers:{"Cache-Control":"no-store"}});}
}
