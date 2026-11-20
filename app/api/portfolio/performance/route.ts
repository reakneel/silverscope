import { NextResponse } from "next/server";
import { getCurrentSupabaseUser } from "@/lib/auth/supabase-session";
import { supabaseAdminRequest } from "@/lib/supabase/admin";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 const user=await getCurrentSupabaseUser();if(!user)return NextResponse.json({error:"unauthorized"},{status:401});
 const url=new URL(request.url);const accountId=url.searchParams.get("accountId");const days=Math.min(30,Math.max(1,Number(url.searchParams.get("days")||1)));
 if(!accountId)return NextResponse.json({error:"account_id_required"},{status:400});
 const since=new Date(Date.now()-days*86400000).toISOString();
 try{
  const account=await supabaseAdminRequest(`portfolio_accounts?id=eq.${encodeURIComponent(accountId)}&owner_id=eq.${encodeURIComponent(user.id)}&select=id,base_currency&limit=1`);
  if(!account.ok)return NextResponse.json({error:"portfolio_account_unavailable"},{status:503});
  const rows=await account.json() as Array<{id:string;base_currency:string}>;if(!rows.length)return NextResponse.json({error:"not_found"},{status:404});
  const response=await supabaseAdminRequest(`portfolio_valuation_snapshots?account_id=eq.${encodeURIComponent(accountId)}&owner_id=eq.${encodeURIComponent(user.id)}&as_of=gte.${encodeURIComponent(since)}&select=as_of,total_value,positions_value,cash_value,currency,completeness,status&order=as_of.asc&limit=5000`);
  if(!response.ok)return NextResponse.json({error:"portfolio_series_unavailable"},{status:503});
  const points=await response.json() as Array<{as_of:string;total_value:number|string|null;positions_value:number|string|null;cash_value:number|string|null;currency:string;completeness:number|string;status:string}>;
  return NextResponse.json({accountId,currency:rows[0].base_currency,days,points:points.map(p=>({time:p.as_of,totalValue:p.total_value===null?null:Number(p.total_value),positionsValue:p.positions_value===null?null:Number(p.positions_value),cashValue:p.cash_value===null?null:Number(p.cash_value),currency:p.currency,completeness:Number(p.completeness),status:p.status})),source:"persisted_valuation_snapshots",intradayAvailable:points.length>1},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"portfolio_series_unavailable"},{status:503,headers:{"Cache-Control":"no-store"}});}
}
