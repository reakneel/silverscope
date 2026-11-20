import { createHash } from "node:crypto";

export type ImportKind = "holdings_snapshot" | "executions";

export interface PreviewRow {
  rowNumber: number;
  values: Record<string, string>;
  normalized: Record<string, string | number | null>;
  fingerprint: string;
}

export interface CsvPreview {
  kind: ImportKind;
  delimiter: "," | ";" | "\t";
  headers: string[];
  totalRows: number;
  acceptedRows: PreviewRow[];
  rejectedRows: Array<{ rowNumber: number; reason: string }>;
  warnings: string[];
  sha256: string;
}

const aliases = {
  code: ["证券代码", "股票代码", "代码", "证券编号", "symbol", "stock code"],
  name: ["证券名称", "股票名称", "名称", "证券简称", "name", "stock name"],
  quantity: ["持仓数量", "当前拥股", "股份余额", "股票余额", "持有数量", "成交数量", "数量", "quantity"],
  available: ["可用股份", "可卖数量", "可用数量", "可卖股份", "available quantity"],
  frozen: ["冻结数量", "冻结股份", "冻结", "frozen quantity"],
  cost: ["成本价", "摊薄成本价", "持仓成本价", "买入成本", "cost price"],
  price: ["市价", "当前价", "最新价", "成交价格", "成交价", "price"],
  marketValue: ["市值", "当前市值", "证券市值", "market value"],
  date: ["成交日期", "发生日期", "业务日期", "委托日期", "日期", "交易日期", "trade date"],
  time: ["成交时间", "发生时间", "时间", "trade time"],
  side: ["买卖标志", "买卖方向", "操作", "业务名称", "交易类别", "方向", "side"],
  amount: ["成交金额", "发生金额", "清算金额", "金额", "trade amount"],
  fee: ["手续费", "佣金", "交易费用", "fee"],
  tax: ["印花税", "税费", "tax"],
  transactionId: ["成交编号", "合同编号", "成交序号", "流水号", "委托编号", "transaction id"],
} as const;

function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[\s_\-（）()【】\[\]]/g, "");
}
function findHeader(headers: string[], key: keyof typeof aliases): number {
  const choices = new Set(aliases[key].map(normalizeHeader));
  return headers.findIndex((header) => choices.has(normalizeHeader(header)));
}
function splitLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { current += '"'; i++; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      values.push(current.trim()); current = "";
    } else current += char;
  }
  if (quoted) throw new Error("CSV 存在未闭合的引号");
  values.push(current.trim());
  return values;
}
function detectDelimiter(lines: string[]): "," | ";" | "\t" {
  const candidates = [",", ";", "\t"] as const;
  const header = lines.find((line) => line.trim()) ?? "";
  return candidates
    .map((delimiter) => ({ delimiter, count: splitLine(header, delimiter).length }))
    .sort((a, b) => b.count - a.count)[0].delimiter;
}
function decimal(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  let raw = value.trim().replace(/[￥¥$\s]/g, "");
  if (/^\(.*\)$/.test(raw)) raw = "-" + raw.slice(1, -1);
  raw = raw.replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}
function dateTime(date: string | undefined, time: string | undefined): string | null {
  if (!date?.trim()) return null;
  const d = date.trim().replace(/[年/.]/g, "-").replace(/月/g, "-").replace(/日/g, "");
  const t = (time ?? "00:00:00").trim();
  const normalized = d.includes("T") ? d : `${d}T${t}`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
function decode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  if (!utf8.includes("\uFFFD")) return utf8;
  try { return new TextDecoder("gb18030", { fatal: false }).decode(bytes); }
  catch { return utf8; }
}
function canonicalValues(headers: string[], cells: string[], kind: ImportKind) {
  const value = (key: keyof typeof aliases) => {
    const index = findHeader(headers, key);
    return index < 0 ? undefined : cells[index];
  };
  const code = value("code")?.trim() ?? "";
  const name = value("name")?.trim() ?? "";
  const quantity = decimal(value("quantity"));
  if (kind === "holdings_snapshot") {
    const cost = decimal(value("cost"));
    const price = decimal(value("price"));
    const marketValue = decimal(value("marketValue"));
    return {
      requiredError: !code || quantity === null ? "缺少证券代码或有效持仓数量" : null,
      normalized: {
        code, name: name || null, quantity,
        availableQuantity: decimal(value("available")),
        frozenQuantity: decimal(value("frozen")),
        costPrice: cost, marketPrice: price, marketValue,
      },
    };
  }
  const tradeAt = dateTime(value("date"), value("time"));
  const sideText = (value("side") ?? "").trim();
  const side = /买|证券买入|buy/i.test(sideText) ? "buy" : /卖|证券卖出|sell/i.test(sideText) ? "sell" : null;
  const amount = decimal(value("amount"));
  const price = decimal(value("price"));
  const fee = decimal(value("fee")) ?? 0;
  const tax = decimal(value("tax")) ?? 0;
  return {
    requiredError: !code || !tradeAt || !side || quantity === null || amount === null
      ? "缺少证券代码、交易日期、买卖方向、成交数量或成交金额" : null,
    normalized: {
      code, name: name || null, tradeAt, side, quantity,
      price, grossAmount: amount, fees: fee, taxes: tax,
      sourceTransactionId: value("transactionId")?.trim() || null,
    },
  };
}

export function previewHuataiCsv(buffer: ArrayBuffer, kind: ImportKind): CsvPreview {
  if (buffer.byteLength === 0) throw new Error("文件为空");
  if (buffer.byteLength > 10 * 1024 * 1024) throw new Error("文件超过 10 MB 限制");
  const text = decode(buffer).replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) throw new Error("文件至少需要一行表头和一行数据");
  const delimiter = detectDelimiter(lines);
  const headers = splitLine(lines[0], delimiter);
  const requiredKeys: (keyof typeof aliases)[] = kind === "holdings_snapshot"
    ? ["code", "quantity"] : ["code", "quantity", "date", "side", "amount"];
  const missing = requiredKeys.filter((key) => findHeader(headers, key) < 0);
  if (missing.length) throw new Error(`无法识别必需列：${missing.join(", ")}。请使用华泰导出的原始 CSV，不要修改表头。`);
  const acceptedRows: PreviewRow[] = [];
  const rejectedRows: CsvPreview["rejectedRows"] = [];
  for (let i = 1; i < lines.length; i++) {
    let cells: string[];
    try { cells = splitLine(lines[i], delimiter); }
    catch (error) { rejectedRows.push({ rowNumber: i + 1, reason: error instanceof Error ? error.message : "CSV 格式错误" }); continue; }
    const values = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
    const result = canonicalValues(headers, cells, kind);
    if (result.requiredError) { rejectedRows.push({ rowNumber: i + 1, reason: result.requiredError }); continue; }
    const fingerprint = hash(JSON.stringify({ kind, values }));
    acceptedRows.push({ rowNumber: i + 1, values, normalized: result.normalized, fingerprint });
  }
  return {
    kind, delimiter, headers, totalRows: lines.length - 1, acceptedRows, rejectedRows,
    warnings: [
      "这是本地预览，不会上传或写入数据库。",
      "尚未用真实华泰导出样本验证表头映射；确认前请勿提交账本。",
      "持仓快照不是成交流水；成交文件也不能单独证明账户现金余额。",
    ],
    sha256: createHash("sha256").update(Buffer.from(buffer)).digest("hex"),
  };
}
