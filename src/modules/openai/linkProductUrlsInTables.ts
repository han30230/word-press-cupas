import type { NormalizedProduct } from "../coupang/types.js";

function escAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeForMatch(s: string): string {
  return s
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

type ProductEntry = { name: string; url: string; norm: string };

function buildProductEntries(products: NormalizedProduct[]): ProductEntry[] {
  return products
    .filter((p) => p.productUrl?.trim() && p.productName?.trim())
    .map((p) => ({
      name: p.productName.trim(),
      url: p.productUrl.trim(),
      norm: normalizeForMatch(p.productName),
    }))
    .sort((a, b) => b.norm.length - a.norm.length);
}

/** 표 헤더에서 제품명 열 인덱스 (없으면 0). */
export function detectProductNameColumnIndex(tableHtml: string): number {
  const theadRow = /<thead\b[\s\S]*?<tr\b[^>]*>([\s\S]*?)<\/tr>/i.exec(tableHtml);
  const row = theadRow
    ? theadRow[1]
    : /<tr\b[^>]*>([\s\S]*?)<\/tr>/i.exec(tableHtml)?.[1] ?? "";
  const cells = [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)];
  for (let i = 0; i < cells.length; i++) {
    const text = stripTags(cells[i][1]).replace(/\s+/g, " ").trim();
    if (/제품명|상품명/.test(text)) return i;
  }
  for (let i = 0; i < cells.length; i++) {
    const text = stripTags(cells[i][1]).replace(/\s+/g, " ").trim();
    if (/^구분$/i.test(text)) return i;
  }
  return 0;
}

function matchProductUrl(plainCell: string, list: ProductEntry[]): string | null {
  const n = normalizeForMatch(stripTags(plainCell));
  if (!n || n === "—" || n === "-" || n === "해당 없음" || n === "해당없음") {
    return null;
  }
  for (const p of list) {
    const pn = p.norm;
    if (n === pn) return p.url;
    const shorter = n.length <= pn.length ? n : pn;
    const longer = n.length <= pn.length ? pn : n;
    if (shorter.length < 8) continue;
    if (longer.includes(shorter) && shorter.length / longer.length >= 0.35) {
      return p.url;
    }
  }
  return null;
}

function linkNthTdInTr(trInner: string, colIdx: number, list: ProductEntry[]): string {
  let i = 0;
  return trInner.replace(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi, (full, attrs: string, inner: string) => {
    const cur = i++;
    if (cur !== colIdx) return full;
    if (/<a\b/i.test(inner)) return full;
    const plain = stripTags(inner).replace(/\s+/g, " ").trim();
    const url = matchProductUrl(plain, list);
    if (!url) return full;
    const body = inner.trim();
    const linked = `<a href="${escAttr(url)}" rel="noopener noreferrer sponsored" target="_blank">${body}</a>`;
    return `<td${attrs}>${linked}</td>`;
  });
}

function transformTableDataRows(table: string, colIdx: number, list: ProductEntry[]): string {
  const thead = /<thead\b[\s\S]*?<\/thead>/i.exec(table);
  if (thead) {
    const before = table.slice(0, thead.index! + thead[0].length);
    const after = table.slice(thead.index! + thead[0].length);
    const afterNew = after.replace(
      /<tr(\b[^>]*)>([\s\S]*?)<\/tr>/gi,
      (_m, trAttrs: string, inner: string) =>
        `<tr${trAttrs}>${linkNthTdInTr(inner, colIdx, list)}</tr>`,
    );
    return before + afterNew;
  }

  if (/<tbody\b/i.test(table)) {
    return table.replace(
      /<tbody(\b[^>]*)>([\s\S]*?)<\/tbody>/gi,
      (_m, tbAttrs: string, body: string) => {
        const nb = body.replace(
          /<tr(\b[^>]*)>([\s\S]*?)<\/tr>/gi,
          (_m2, trAttrs: string, inner: string) =>
            `<tr${trAttrs}>${linkNthTdInTr(inner, colIdx, list)}</tr>`,
        );
        return `<tbody${tbAttrs}>${nb}</tbody>`;
      },
    );
  }

  let first = true;
  return table.replace(
    /<tr(\b[^>]*)>([\s\S]*?)<\/tr>/gi,
    (full, trAttrs: string, inner: string) => {
      if (first) {
        first = false;
        return full;
      }
      return `<tr${trAttrs}>${linkNthTdInTr(inner, colIdx, list)}</tr>`;
    },
  );
}

/**
 * 비교 표 등에서 제품명이 적힌 셀에 쿠팡 파트너스 URL 링크를 붙입니다.
 * - 헤더에 「제품명」「상품명」 열이 있으면 그 열, 없고 「구분」만 있으면 그 열, 그 외 첫 번째 열을 사용합니다.
 * - `products`에 있는 상품명과 셀 텍스트를 정규화해 매칭합니다(포함 관계·긴 이름 우선).
 */
export function linkKnownProductNamesInTables(
  html: string,
  products: NormalizedProduct[],
): string {
  const list = buildProductEntries(products);
  if (list.length === 0) return html;

  return html.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, (table) => {
    const colIdx = detectProductNameColumnIndex(table);
    return transformTableDataRows(table, colIdx, list);
  });
}
