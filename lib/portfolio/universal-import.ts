import { createHash } from "node:crypto";

export type UniversalImportKind = "holdings_snapshot" | "executions" | "cash_ledger";
export type CanonicalField = "symbol" | "name" | "quantity" | "availableQuantity" | "costPrice" | "marketPrice" | "marketValue" | "currency" | "date" | "side" | "price" | "amount" | "fees" | "taxes" | "cashBalance" | "transactionId";
export interface UniversalPreviewRow { rowNumber: number; values: Record<string,string>; normalized: Record<string,string|number|null>; fingerprint: string; }
export interface UniversalPreview { kind: UniversalImportKind; headers: string[]; delimiter: ","|";"|"\t"; totalRows: number; acceptedRows: UniversalPreviewRow[]; rejectedRows: Array<{rowNumber:number;reason:string}>; mapping: Partial<Record<CanonicalField,string>>; unmappedHeaders: string[]; warnings: string[]; sha256: string; }
const aliases: Record<CanonicalField,string[]> = {
 symbol:["证券代码","股票代码","基金代码","代码","symbol","ticker","stock code","security code"],
 name:["证券名称","股票名称","基金名称","名称","name","security name","stock name"],
 quantity:["持仓数量","股份余额","股票余额","持有数量","成交数量","数量","quantity","shares","units"],
 availableQuantity:["可用股份","可卖数量","可用数量","available quantity","sellable quantity"],
 costPrice:["成本价","摊薄成本价","持仓成本价","买入成本","cost price","average cost","avg cost"],
 marketPrice:["市价","当前价","最新价","market price","last price","quote"],
 marketValue:["市值","当前市值","证券市值","market value","position value"],
 currency:["币种","货币","currency","ccy"],
 date:["成交日期","发生日期","业务日期","交易日期","日期","时间","trade date","datetime","timestamp","date"],
 side:["买卖标志","买卖方向","操作","业务名称","交易类别","方向","side","action","type"],
 price:["成交价格","成交价","价格","price","execution price"],
 amount:["成交金额","发生金额","清算金额","金额","trade amount","gross amount","net amount","amount"],
 fees:["手续费","佣金","交易费用","fee","fees","commission"],
 taxes:["印花税","税费","tax","taxes"],
 cashBalance:["资金余额","可用资金","现金余额","余额","cash balance","cash","balance"],
 transactionId:["成交编号","合同编号","成交序号","流水号","委托编号","transaction id","trade id","order id"]
};
const norm = (s:string) => s.replace(/^\uFEFF/,"").trim().toLowerCase().replace(/[\s_\-（）()【】\[\]]/g,"");
function split(line:string, delimiter:string):string[]{const out:string[]=[];let value="",quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(c===delimiter&&!quoted){out.push(value.trim());value="";}else value+=c;}if(quoted)throw new Error("CSV 存在未闭合引号");out.push(value.trim());return out;}
function parseNumber(raw:string|undefined):number|null{if(!raw?.trim())return null;let s=raw.trim().replace(/[￥¥$\s]/g,"");if(/^\(.*\)$/.test(s))s="-"+s.slice(1,-1);s=s.replace(/,/g,"");if(!/^-?\d+(\.\d+)?$/.test(s))return null;const n=Number(s);return Number.isFinite(n)?n:null;}
function parseDate(raw:string|undefined):string|null{if(!raw?.trim())return null;const s=raw.trim().replace(/[年/.]/g,"-").replace(/月/g,"-").replace(/日/g,"");const d=new Date(s.includes("T")?s:s+"T00:00:00+08:00");return Number.isNaN(d.getTime())?null:d.toISOString();}
export function previewUniversalImport(buffer:ArrayBuffer,kind:UniversalImportKind,overrides:Partial<Record<CanonicalField,string>>={}):UniversalPreview{
 if(!buffer.byteLength)throw new Error("文件为空");if(buffer.byteLength>10*1024*1024)throw new Error("文件超过 10 MB 限制");
 const bytes=new Uint8Array(buffer);let source=new TextDecoder("utf-8").decode(bytes);if(source.includes("\uFFFD"))source=new TextDecoder("gb18030").decode(bytes);
 const lines=source.replace(/^\uFEFF/,"").split(/\r?\n/).filter(x=>x.trim());if(lines.length<2)throw new Error("文件至少需要一行表头和一行数据");
 const delimiter=([",",";","\t"] as const).map(d=>({d,n:split(lines[0],d).length})).sort((a,b)=>b.n-a.n)[0].d;
 const headers=split(lines[0],delimiter), headerIndex=new Map(headers.map((h,i)=>[norm(h),i]));
 const mapping:Partial<Record<CanonicalField,string>>={};
 for(const field of Object.keys(aliases) as CanonicalField[]){const override=overrides[field];const found=override?headers.find(h=>h===override):headers.find(h=>aliases[field].some(a=>norm(a)===norm(h)));if(found)mapping[field]=found;}
 const required:CanonicalField[]=kind==="holdings_snapshot"?["symbol","quantity"]:kind==="executions"?["symbol","date","side","quantity"]:["date","amount"];
 const missing=required.filter(f=>!mapping[f]);if(missing.length)throw new Error("无法识别必需字段："+missing.join("、")+"。可在调用时提供列映射覆盖。");
 const acceptedRows:UniversalPreviewRow[]=[],rejectedRows:UniversalPreview["rejectedRows"]=[];
 const get=(cells:string[],field:CanonicalField)=>{const h=mapping[field];const idx=h===undefined?-1:headerIndex.get(norm(h))??-1;return idx<0?undefined:cells[idx];};
 for(let i=1;i<lines.length;i++){try{const cells=split(lines[i],delimiter);const values=Object.fromEntries(headers.map((h,j)=>[h,cells[j]??""]));const sideRaw=(get(cells,"side")??"").toLowerCase();const side=/买|buy|purchase/.test(sideRaw)?"buy":/卖|sell/.test(sideRaw)?"sell":null;
 const normalized:Record<string,string|number|null> = kind==="holdings_snapshot"?{symbol:get(cells,"symbol")?.trim()||null,name:get(cells,"name")?.trim()||null,quantity:parseNumber(get(cells,"quantity")),availableQuantity:parseNumber(get(cells,"availableQuantity")),costPrice:parseNumber(get(cells,"costPrice")),marketPrice:parseNumber(get(cells,"marketPrice")),marketValue:parseNumber(get(cells,"marketValue")),currency:get(cells,"currency")?.trim().toUpperCase()||null}:{symbol:get(cells,"symbol")?.trim()||null,name:get(cells,"name")?.trim()||null,date:parseDate(get(cells,"date")),side,quantity:parseNumber(get(cells,"quantity")),price:parseNumber(get(cells,"price")),amount:parseNumber(get(cells,"amount")),fees:parseNumber(get(cells,"fees"))??0,taxes:parseNumber(get(cells,"taxes"))??0,currency:get(cells,"currency")?.trim().toUpperCase()||null,cashBalance:parseNumber(get(cells,"cashBalance")),transactionId:get(cells,"transactionId")?.trim()||null};
 const invalid=kind==="holdings_snapshot"?!normalized.symbol||typeof normalized.quantity!=="number":kind==="executions"?!normalized.symbol||!normalized.date||!side||typeof normalized.quantity!=="number"||typeof normalized.amount!=="number":!normalized.date||typeof normalized.amount!=="number";
 if(invalid){rejectedRows.push({rowNumber:i+1,reason:"必需字段缺失或数值无效"});continue;}
 const fingerprint=createHash("sha256").update(JSON.stringify({kind,normalized})).digest("hex");acceptedRows.push({rowNumber:i+1,values,normalized,fingerprint});
 }catch(e){rejectedRows.push({rowNumber:i+1,reason:e instanceof Error?e.message:"行解析失败"});}}
 const used=new Set(Object.values(mapping));return {kind,headers,delimiter,totalRows:lines.length-1,acceptedRows,rejectedRows,mapping,unmappedHeaders:headers.filter(h=>!used.has(h)),warnings:["通用字段映射仅负责预览，不代表来源数据已核验。","币种、数量单位、复权口径和时区必须在正式入账前确认。","当前版本不写入账本；重复指纹可用于后续幂等导入。"],sha256:createHash("sha256").update(bytes).digest("hex")};
}
