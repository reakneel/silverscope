"use client";

import { useState } from "react";

type Preview = {
  fileName: string;
  totalRows: number;
  acceptedCount: number;
  rejectedCount: number;
  sha256: string;
  warnings: string[];
  acceptedRows: Array<{ rowNumber: number; normalized: Record<string, string | number | null> }>;
  rejectedRows: Array<{ rowNumber: number; reason: string }>;
  commitAvailable: boolean;
};

export function HuataiImportPanel() {
  const [kind, setKind] = useState<"holdings_snapshot" | "executions">("holdings_snapshot");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function runPreview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) { setError("请选择华泰导出的 CSV 文件。"); return; }
    setBusy(true); setError(""); setPreview(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("kind", kind);
      const response = await fetch("/api/portfolio/import/preview", { method: "POST", body: form, cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? result.error ?? "文件预览失败");
      setPreview(result.preview);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "文件预览失败");
    } finally { setBusy(false); }
  }

  return <section className="panel portfolio-import">
    <div className="panel-heading"><div><h2>华泰文件导入预览</h2><p>仅在服务器内存中解析，不上传原文件、不写入账户账本</p></div><span className="status-pending">PREVIEW ONLY</span></div>
    <form onSubmit={runPreview} className="portfolio-import-form">
      <label className="auth-field">数据类型
        <select className="auth-input" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
          <option value="holdings_snapshot">持仓股份余额 / 持仓快照</option>
          <option value="executions">历史成交 / 成交记录</option>
        </select>
      </label>
      <label className="auth-field">华泰导出文件（CSV / TXT，最大 10 MB）
        <input className="auth-input" type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setPreview(null); setError(""); }} />
      </label>
      <button className="button-primary" type="submit" disabled={busy || !file}>{busy ? "正在校验…" : "解析并预览"}</button>
    </form>
    {error && <p className="auth-error" role="alert">{error}</p>}
    {preview && <>
      <div className="portfolio-preview-stats">
        <div><span>总行数</span><strong>{preview.totalRows}</strong></div>
        <div><span>通过</span><strong>{preview.acceptedCount}</strong></div>
        <div><span>拒绝</span><strong>{preview.rejectedCount}</strong></div>
      </div>
      <p className="muted portfolio-hash">文件：{preview.fileName} · SHA-256：{preview.sha256}</p>
      <div className="notice"><strong>提交已禁用</strong><p>解析器尚未使用真实华泰样本校准。预览通过不代表账本数据已导入或与券商对账。</p></div>
      <div className="table-wrap"><table><thead><tr><th>行</th><th>标准化结果</th></tr></thead><tbody>
        {preview.acceptedRows.slice(0, 20).map((row) => <tr key={row.rowNumber}><td>{row.rowNumber}</td><td><code>{JSON.stringify(row.normalized)}</code></td></tr>)}
        {preview.rejectedRows.slice(0, 20).map((row) => <tr key={row.rowNumber}><td>{row.rowNumber}</td><td className="auth-error">{row.reason}</td></tr>)}
      </tbody></table></div>
      {preview.warnings.map((warning) => <p className="muted" key={warning}>• {warning}</p>)}
    </>}
  </section>;
}
