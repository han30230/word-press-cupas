/**
 * 모델 출력 JSON의 html 품질을 휴리스틱으로 점검(재생성·수동 수정 판단용).
 * 100% 정확하지 않으며, “실패”는 경고 목록에 넣는다.
 */

import { POST_SEMANTIC_CLASSES as C } from "./prompts/articlePrompt.js";

function countClassOccurrences(html: string, className: string): number {
  const esc = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\bclass\\s*=\\s*["'][^"']*\\b${esc}\\b`, "gi");
  return (html.match(re) || []).length;
}

const OPENING_PATTERNS =
  /^(안녕하세요|안녕|여러분|오늘은|이번(에|엔)?|소개(해|드릴)?|드디어|반갑|저는|최근\s*에)/;

/** 본문에서 ‘아쉬운 점·균형’ 언급이 있는지(장점만일 때 경고). */
const DOWNSIDE_MARKERS =
  /(단점|아쉬운\s*점|아쉬움|한계|아쉽|불편한\s*점|부담스|고려할\s*점|아쉬울\s*수|기대에\s*안\s*맞|노(트|ㅅ)|짚어|꼼꼼히)/;

function stripTags(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function koreanishCharCount(plain: string): number {
  return plain.replace(/\s/g, "").length;
}

function extractHeadingTexts(html: string, tag: "h2" | "h3"): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    out.push(
      m[1]
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    );
  }
  return out;
}

/** 기계적 홍보 소제목으로 자주 쓰이는 짧은 제목·구절을 잡는다(질문형 긴 제목은 오탐 줄이기). */
function isBannedHeadingText(t: string): boolean {
  const s = t.replace(/\s+/g, " ").trim();
  if (!s) return false;
  if (/[?？]/.test(s) && s.length > 22) {
    return false;
  }
  const exact =
    /^(제품\s*설명|특징|장점|단점|사용\s*방법|체험담|마무리|결론|서론|본론)(\s*[:：\-\—].*)?$/i;
  if (exact.test(s)) return true;
  if (/^이\s*제품(의)?\s*특징$/i.test(s)) return true;
  if (/^핵심\s*특징$/i.test(s)) return true;
  if (/^제품\s*설명/i.test(s) && s.length <= 24) return true;
  if (/^사용\s*방법$/i.test(s)) return true;
  if (/^체험담$/i.test(s)) return true;
  if (/^(특징|장점)\s*정리$/i.test(s)) return true;
  if (/^상품\s*특징$/i.test(s)) return true;
  if (s.length <= 14) {
    if (/^(특징|장점|마무리|결론|체험담)$/i.test(s)) return true;
  }
  return false;
}

function countProductUrlInAHref(html: string, productUrl: string): number {
  if (!productUrl) return 0;
  const esc = productUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<a\\b[^>]*\\bhref\\s*=\\s*(["'])${esc}\\1`, "gi");
  return (html.match(re) || []).length;
}

/** <p>별 문자 수(태그 제거 후) — 문단 길이 단조 검사용 */
function extractParagraphCharLengths(html: string): number[] {
  const lengths: number[] = [];
  const re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const inner = m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (inner.length > 0) {
      lengths.push(koreanishCharCount(inner));
    }
  }
  return lengths;
}

function paragraphLengthMonotonyIssue(lengths: number[]): string | null {
  if (lengths.length < 6) return null;
  const n = lengths.length;
  const mean = lengths.reduce((a, b) => a + b, 0) / n;
  if (mean < 40) return null;
  let v = 0;
  for (const L of lengths) {
    v += (L - mean) ** 2;
  }
  const sd = Math.sqrt(v / n);
  const cv = mean > 0 ? sd / mean : 0;
  if (cv < 0.18) {
    return `문단(<p>) 길이가 서로 비슷해 패턴이 단조로울 수 있음(coeff of var ${cv.toFixed(2)})`;
  }
  return null;
}

function firstImageSurroundedByParagraphsIssue(html: string): string | null {
  const m = /<img\b[^>]*>/i.exec(html);
  if (!m || m.index === undefined) return null;
  const before = html.slice(0, m.index);
  const after = html.slice(m.index + m[0].length);
  const issues: string[] = [];
  if (!/<p\b/i.test(before)) {
    issues.push("첫 이미지 위에 설명 문단(<p>)이 없음(이미지 앞뒤 문단 권장)");
  }
  if (!/<p\b/i.test(after)) {
    issues.push("첫 이미지 아래에 설명 문단(<p>)이 없음(이미지 앞뒤 문단 권장)");
  }
  return issues.length ? issues.join(" / ") : null;
}

export function getArticleHtmlQualityIssues(
  html: string,
  options?: { productUrl?: string; minChars?: number },
): string[] {
  const minChars = options?.minChars ?? 5200;
  const productUrl = options?.productUrl?.trim() ?? "";
  const issues: string[] = [];
  const plain = stripTags(html);
  const head = plain.slice(0, 180);

  if (OPENING_PATTERNS.test(head) || /안녕하세요|소개해드릴게요|오늘은\s*이번/.test(plain.slice(0, 300))) {
    issues.push("도입: 인사·‘오늘은 소개’ 류로 시작한 것으로 보일 수 있음(첫 문단은 상황 공감 권장)");
  }

  for (const tag of ["h2", "h3"] as const) {
    for (const t of extractHeadingTexts(html, tag)) {
      if (isBannedHeadingText(t)) {
        issues.push(
          `소제목(${tag})에 기계적/홍보문 표현 의심: “${t.slice(0, 48)}”`,
        );
      }
    }
  }

  if (!/<table\b/i.test(html)) {
    issues.push("비교 표(<table>) 없음(필수 1개)");
  }

  if (!html.includes(C.disclosure)) {
    issues.push(`파트너스 고지 블록(class="${C.disclosure}") 없음`);
  }

  if (!html.includes(C.keySummary)) {
    issues.push(`핵심 요약 박스(class="${C.keySummary}") 없음`);
  }

  if (!html.includes(C.toc)) {
    issues.push(`목차 블록(class="${C.toc}") 없음`);
  }

  if (!html.includes(C.pros)) {
    issues.push(`장점 블록(class="${C.pros}") 없음`);
  }
  if (!html.includes(C.cons)) {
    issues.push(`아쉬운 점 블록(class="${C.cons}") 없음`);
  }

  if (!html.includes(C.recoYes)) {
    issues.push(`추천 대상 블록(class="${C.recoYes}") 없음`);
  }
  if (!html.includes(C.recoNo)) {
    issues.push(`비추천·아쉬울 사람 블록(class="${C.recoNo}") 없음`);
  }

  if (!html.includes(C.checklist)) {
    issues.push(`구매 전 체크포인트(class="${C.checklist}") 없음`);
  }

  const ctaCards = countClassOccurrences(html, C.ctaCard);
  if (ctaCards < 2) {
    issues.push(
      `카드형 CTA(class="${C.ctaCard}")가 ${ctaCards}개 — 중간·하단 각 1개(총 2개) 권장`,
    );
  }

  if (!new RegExp(`<hr[^>]*\\bclass\\s*=\\s*["'][^"']*\\b${C.divider}\\b`, "i").test(html)) {
    issues.push(`섹션 구분선(<hr class="${C.divider}">) 없음`);
  }

  if (productUrl) {
    const ctaN = countProductUrlInAHref(html, productUrl);
    if (ctaN < 2) {
      issues.push(`productUrl이 <a href>에 ${ctaN}회만 등장(중간·하단 CTA 권장: 2회 이상)`);
    }
  } else {
    issues.push("productUrl이 없어 CTA 링크 횟수를 확인하지 못함");
  }

  const imgTags = html.match(/<img\b[^>]*>/gi) || [];
  if (imgTags.length > 0) {
    const miss = imgTags.filter((t) => !/\bonerror\s*=/i.test(t));
    if (miss.length > 0) {
      issues.push(`img ${miss.length}개에 onerror 없음(loading="lazy" + onerror 권장)`);
    }
    const noLazy = imgTags.filter((t) => !/\bloading\s*=\s*["']?lazy/i.test(t));
    if (noLazy.length > 0) {
      issues.push("일부 img에 loading=lazy 없음");
    }
  } else {
    issues.push("본문에 <img> 없음(대표 이미지 URL이 있으면 초반 배치 권장)");
  }

  const imgCtx = firstImageSurroundedByParagraphsIssue(html);
  if (imgCtx) {
    issues.push(imgCtx);
  }

  if (!DOWNSIDE_MARKERS.test(plain)) {
    issues.push(
      "단점·아쉬운 점·한계 등 ‘균형’ 키워드가 약함(장점만 강조해 보일 수 있음)",
    );
  }

  const pLens = extractParagraphCharLengths(html);
  const mono = paragraphLengthMonotonyIssue(pLens);
  if (mono) {
    issues.push(mono);
  }

  const nChars = koreanishCharCount(plain);
  if (nChars < minChars) {
    issues.push(`순수 텍스트(공백 제외) 약 ${nChars}자 — 권장 ${minChars}자 이상`);
  }

  return issues;
}
