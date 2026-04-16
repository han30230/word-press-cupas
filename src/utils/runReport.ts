import fs from "node:fs";
import path from "node:path";
import { appRootDir } from "./appRoot.js";

export interface RunReportEntry {
  at: string;
  ok: boolean;
  accountId?: string;
  accountName?: string;
  keyword?: string;
  title?: string;
  excerpt?: string;
  /** HTML 제거한 본문 앞부분 */
  contentPreview?: string;
  postId?: number;
  postUrl?: string;
  localHtmlPath?: string;
  error?: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripTags(html: string, maxLen: number): string {
  const plain = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return plain.length > maxLen ? `${plain.slice(0, maxLen)}…` : plain;
}

export function previewFromHtml(html: string, maxLen = 400): string {
  return stripTags(html, maxLen);
}

function reportsDir(): string {
  return path.join(appRootDir(), "output", "reports");
}

export function appendRunReport(entry: RunReportEntry): void {
  const dir = reportsDir();
  fs.mkdirSync(dir, { recursive: true });
  const jsonl = path.join(dir, "runs.jsonl");
  fs.appendFileSync(jsonl, `${JSON.stringify(entry)}\n`, "utf8");
  regenerateDashboard(dir);
}

function readLastRuns(jsonlPath: string, max = 80): RunReportEntry[] {
  if (!fs.existsSync(jsonlPath)) return [];
  const raw = fs.readFileSync(jsonlPath, "utf8");
  const lines = raw.split("\n").filter(Boolean);
  const slice = lines.slice(-max);
  const out: RunReportEntry[] = [];
  for (const line of slice) {
    try {
      out.push(JSON.parse(line) as RunReportEntry);
    } catch {
      /* skip */
    }
  }
  return out.reverse();
}

function regenerateDashboard(dir: string): void {
  const jsonl = path.join(dir, "runs.jsonl");
  const runs = readLastRuns(jsonl, 80);
  const rows = runs
    .map((r) => {
      const acc =
        r.accountName || r.accountId
          ? `<div class="acc">${escapeHtml(r.accountName ?? "")}${r.accountId ? ` <span class="muted">(${escapeHtml(r.accountId)})</span>` : ""}</div>`
          : "";
      const status = r.ok
        ? '<span class="ok">성공</span>'
        : '<span class="fail">실패</span>';
      const link =
        r.postUrl && r.ok
          ? `<a href="${escapeHtml(r.postUrl)}" target="_blank" rel="noopener">열기</a>`
          : "—";
      const prev = r.contentPreview
        ? `<div class="preview">${escapeHtml(r.contentPreview)}</div>`
        : "";
      const err = r.error ? `<div class="err">${escapeHtml(r.error)}</div>` : "";
      const local =
        r.localHtmlPath && fs.existsSync(r.localHtmlPath)
          ? `<span class="muted">${escapeHtml(r.localHtmlPath)}</span>`
          : r.localHtmlPath
            ? escapeHtml(r.localHtmlPath)
            : "—";
      return `<tr>
  <td>${escapeHtml(r.at)}</td>
  <td>${status}${acc}</td>
  <td>${escapeHtml(r.keyword ?? "—")}</td>
  <td>${escapeHtml(r.title ?? "—")}</td>
  <td>${r.postId ?? "—"}</td>
  <td>${link}</td>
  <td>${local}</td>
</tr>
<tr class="detail"><td colspan="7">${prev}${err}</td></tr>`;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>발행 기록</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 16px; background: #f6f7f9; color: #1a1a1a; }
    h1 { font-size: 1.25rem; }
    table { border-collapse: collapse; width: 100%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    th, td { border: 1px solid #e2e5eb; padding: 8px 10px; text-align: left; font-size: 13px; vertical-align: top; }
    th { background: #eef1f6; }
    tr.detail td { background: #fafbfc; border-top: none; padding-top: 0; }
    .ok { color: #0a7; font-weight: 600; }
    .fail { color: #c12; font-weight: 600; }
    .preview { white-space: pre-wrap; margin: 6px 0; line-height: 1.45; }
    .err { color: #a00; margin-top: 6px; font-size: 12px; }
    .muted { font-size: 11px; color: #666; }
    .acc { font-size: 12px; font-weight: 500; margin-top: 4px; }
    .hint { color: #555; font-size: 13px; margin-bottom: 12px; }
  </style>
</head>
<body>
  <h1>자동 발행 기록</h1>
  <p class="hint">최근 실행만 표시합니다. 원본 HTML은 <code>output/</code> 폴더, 로그는 <code>logs/app.log</code> 를 참고하세요.</p>
  <table>
    <thead>
      <tr>
        <th>시각(UTC)</th>
        <th>결과 · 계정</th>
        <th>키워드</th>
        <th>제목</th>
        <th>post id</th>
        <th>사이트 링크</th>
        <th>로컬 HTML</th>
      </tr>
    </thead>
    <tbody>
${rows || "<tr><td colspan=\"7\">기록 없음</td></tr>"}
    </tbody>
  </table>
</body>
</html>`;

  fs.writeFileSync(path.join(dir, "dashboard.html"), html, "utf8");
}
