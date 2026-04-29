/**
 * WordPress.com(무료) 등에서 추가 CSS 없이도 본문이 읽기 좋게 보이도록
 * 시맨틱 블록에 인라인 style 을 붙입니다. (쿠팡 파트너스형 그라데이션 CTA·비교 카드·표 포함)
 */

function escStyleAttr(css: string): string {
  return css.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function classAttrContainsToken(classAttr: string, token: string): boolean {
  const parts = classAttr.split(/\s+/).filter(Boolean);
  return parts.includes(token);
}

function injectStyleOnOpenTag(
  html: string,
  tagNames: string[],
  classToken: string,
  styleCss: string,
): string {
  const styleEsc = escStyleAttr(styleCss);
  for (const tag of tagNames) {
    const re = new RegExp(`<${tag}((?:\\s[^>]*)?)>`, "gi");
    html = html.replace(re, (full, inner: string) => {
      const cm = /\bclass\s*=\s*(["'])((?:(?!\1).)*)\1/i.exec(inner);
      if (!cm) return full;
      const classVal = cm[2];
      if (!classAttrContainsToken(classVal, classToken)) return full;
      if (/\bstyle\s*=/i.test(inner)) return full;
      return `<${tag}${inner} style="${styleEsc}">`;
    });
  }
  return html;
}

const S = {
  post: `font-family:'Pretendard Variable',Pretendard,'Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif;font-size:1rem;line-height:1.72;color:#111827;max-width:42rem;margin:0 auto;word-break:keep-all;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility`,
  disclosure: `font-size:0.8125rem;color:#475569;line-height:1.65;padding:0.9rem 1.05rem;margin:0 0 1.35rem;background:#fafafa;border:1px solid #e5e7eb;border-radius:11px;border-left:4px solid #64748b`,
  hero: `margin:1.35rem 0 1.5rem;padding:0;background:#fff;border:1px solid #e8ecf1;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,.08)`,
  keySummary: `border:1px solid #e2e8f0;border-radius:14px;padding:1.25rem 1.35rem;margin:1.4rem 0;background:linear-gradient(180deg,#fffdfb 0%,#fff 55%);box-shadow:0 4px 16px rgba(234,88,12,.07);border-left:4px solid #ea580c`,
  toc: `margin:1.35rem 0;padding:1.05rem 1.25rem 1.15rem;background:linear-gradient(180deg,#f8fafc,#fff);border:1px solid #cbd5e1;border-radius:14px;border-left:4px solid #2563eb;box-shadow:0 2px 10px rgba(15,23,42,.05)`,
  pros: `border-radius:14px;padding:1.2rem 1.3rem;margin:1.2rem 0;background:linear-gradient(145deg,#f0fdf4 0%,#fff 100%);border:1px solid #86efac;box-shadow:0 3px 14px rgba(22,101,52,.08)`,
  cons: `border-radius:14px;padding:1.2rem 1.3rem;margin:1.2rem 0;background:linear-gradient(145deg,#fffbeb 0%,#fff 100%);border:1px solid #fcd34d;box-shadow:0 3px 14px rgba(180,83,9,.07)`,
  recoYes: `border-radius:14px;padding:1.15rem 1.25rem;margin:0.75rem 0;background:#fff;border:1px solid #e2e8f0;border-top:4px solid #2563eb;box-shadow:0 3px 14px rgba(15,23,42,.06)`,
  recoNo: `border-radius:14px;padding:1.15rem 1.25rem;margin:0.75rem 0;background:#fff;border:1px solid #e7e5e4;border-top:4px solid #94a3b8;box-shadow:0 3px 14px rgba(15,23,42,.05)`,
  checklist: `border:1px solid #e2e8f0;border-radius:14px;padding:1.2rem 1.35rem;margin:1.4rem 0;background:#fff;box-shadow:0 2px 10px rgba(15,23,42,.05)`,
  /** 상·하단 그라데이션 CTA — 중간 카드(선택)도 동일 톤 */
  spotlight: `text-align:center;padding:1.85rem 1.4rem;margin:1.9rem 0;border-radius:16px;background:linear-gradient(100deg,#ff9a3c 0%,#ff6b6b 48%,#ff4e6a 100%);box-shadow:0 12px 36px rgba(255,90,100,.34),0 1px 0 rgba(255,255,255,.22) inset;border:1px solid rgba(255,255,255,.2)`,
  ctaCard: `text-align:center;padding:1.85rem 1.4rem;margin:1.9rem 0;border-radius:16px;background:linear-gradient(100deg,#ff9a3c 0%,#ff6b6b 48%,#ff4e6a 100%);box-shadow:0 10px 32px rgba(255,90,100,.28),0 1px 0 rgba(255,255,255,.18) inset;border:1px solid rgba(255,255,255,.18)`,
  callout: `margin:1.5rem 0;padding:1.15rem 1.2rem 1.15rem 1.28rem;background:linear-gradient(90deg,#eff6ff 0%,#f8fafc 100%);border-radius:12px;border-left:5px solid #2563eb;box-shadow:0 2px 10px rgba(37,99,235,.06)`,
  cardGrid: `display:flex;flex-wrap:wrap;gap:1.05rem;margin:1.55rem 0;justify-content:stretch;align-items:stretch`,
  miniCard: `flex:1 1 28%;min-width:190px;box-sizing:border-box;border:1px solid #bfdbfe;border-radius:12px;padding:1.08rem 1.12rem;background:#fff;box-shadow:0 2px 10px rgba(30,64,175,.08)`,
  lead: `font-size:1.02rem;font-weight:600;color:#334155;line-height:1.55;margin:0.85rem 0 0.75rem`,
  spotlightTitle: `margin:0 0 0.5rem;font-size:1.05rem;font-weight:700;color:#fff;line-height:1.38;text-shadow:0 1px 3px rgba(0,0,0,.14)`,
  spotlightDesc: `margin:0 auto;font-size:0.98rem;font-weight:500;color:rgba(255,255,255,.96);line-height:1.62;max-width:36rem`,
  spotlightBtn: `display:inline-block;margin-top:1.1rem;padding:0.78rem 1.9rem;background:#fff;color:#e11d48 !important;font-weight:800;font-size:0.9375rem;border-radius:11px;text-decoration:none !important;box-shadow:0 6px 20px rgba(0,0,0,.2);border:2px solid rgba(255,255,255,.95);letter-spacing:0.02em`,
  tableWrap: `overflow-x:auto;margin:1.45rem 0;border-radius:14px;border:1px solid #e2e8f0;background:#fff;box-shadow:0 4px 18px rgba(15,23,42,.06)`,
  divider: `border:0;margin:2.5rem 0;padding:0;height:0;border-top:1px solid #eeeeee`,
  h2: `font-size:clamp(1.02rem,1.55vw,1.14rem);font-weight:600;line-height:1.42;color:#1e293b;margin:1.45rem 0 0.6rem;padding:0;letter-spacing:-0.01em`,
  h3: `font-size:0.98rem;font-weight:600;line-height:1.48;color:#475569;margin:1.2rem 0 0.4rem`,
};

const RECO_PAIR_WIDE = `display:grid;gap:1rem;margin:1.1rem 0;grid-template-columns:repeat(auto-fit,minmax(268px,1fr))`;

/** 기존 인라인 주입 버그로 `<hr ... / style="...">` 형태가 되었을 때 정상화 */
function fixMalformedPostDividerHr(html: string): string {
  return html.replace(/<hr\b([\s\S]*?)\/\s+style="([^"]*)"\s*>/gi, (_full, part1: string, styleVal: string) => {
    const inner = part1.trim();
    const prefix = inner ? ` ${inner}` : "";
    return `<hr${prefix} style="${escStyleAttr(styleVal)}" />`;
  });
}

/** self-closing hr 에만 스타일 삽입 (일반 `>` 패턴과 호환) */
function injectPostDividerHrStyle(html: string, styleCss: string): string {
  const styleEsc = escStyleAttr(styleCss);
  let out = html.replace(/<hr\b([^>]*?)\/>/gi, (full, inner: string) => {
    if (!/\bpost-divider\b/.test(inner)) return full;
    if (/\bstyle\s*=/i.test(inner)) return full;
    const sp = inner.trim() ? ` ${inner.trim()}` : "";
    return `<hr${sp} style="${styleEsc}" />`;
  });
  out = out.replace(/<hr\b([^>]*\bpost-divider\b[^>]*)>/gi, (full, inner: string) => {
    if (/\/>/.test(full)) return full;
    if (/\bstyle\s*=/i.test(inner)) return full;
    const sp = inner.trim() ? ` ${inner.trim()}` : "";
    return `<hr${sp} style="${styleEsc}" />`;
  });
  return out;
}

/** post-toc 블록 안 첫 p / ol / li 에 읽기 좋은 인라인 스타일(무료 플랜용). */
function stylePostTocInnerContent(html: string): string {
  return html.replace(
    /<div(\b[^>]*\bpost-toc\b[^>]*)>([\s\S]*?)<\/div>/gi,
    (full, attrs: string, inner: string) => {
      if (/<div\b/i.test(inner)) return full;

      let pDone = false;
      let olSeen = false;
      let strongDone = false;

      let patched = inner.replace(/<p\b([^>]*)>/gi, (pFull, g1: string) => {
        if (pDone) return pFull;
        pDone = true;
        if (/\bstyle\s*=/i.test(g1)) return pFull;
        const st = escStyleAttr(
          `margin:0 0 0.4rem;font-size:0.82rem;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#2563eb`,
        );
        return `<p${g1} style="${st}">`;
      });

      patched = patched.replace(/<strong\b([^>]*)>/gi, (sFull, g1: string) => {
        if (strongDone) return sFull;
        strongDone = true;
        if (/\bstyle\s*=/i.test(g1)) return sFull;
        const st = escStyleAttr(`font-size:1.05em;color:#0f172a;font-weight:800`);
        return `<strong${g1} style="${st}">`;
      });

      patched = patched.replace(/<ol\b([^>]*)>/gi, (oFull, g1: string) => {
        if (olSeen) return oFull;
        olSeen = true;
        if (/\bstyle\s*=/i.test(g1)) return oFull;
        const st = escStyleAttr(
          `margin:0.35rem 0 0;padding:0.5rem 0 0 1.45rem;line-height:1.75;color:#334155;font-size:0.98rem;font-weight:500`,
        );
        return `<ol${g1} style="${st}">`;
      });

      patched = patched.replace(/<li\b([^>]*)>/gi, (liFull, g1: string) => {
        if (!olSeen) return liFull;
        if (/\bstyle\s*=/i.test(g1)) return liFull;
        const st = escStyleAttr(`margin:0.3rem 0`);
        return `<li${g1} style="${st}">`;
      });

      return `<div${attrs}>${patched}</div>`;
    },
  );
}

/** 비교 표 안 일반 링크(제품명 등) — CTA 버튼과 시각적으로 구분 */
function styleTableWrapAnchors(html: string): string {
  return html.replace(
    /<div(\b[^>]*\btable-wrap\b[^>]*)>([\s\S]*?)<\/div>/gi,
    (_full, divAttrs: string, inner: string) => {
      const patched = inner.replace(/<a\b([^>]*)>/gi, (aFull, aIn: string) => {
        if (/\bpost-spotlight-btn\b/.test(aIn)) return aFull;
        if (/\bstyle\s*=/i.test(aIn)) return aFull;
        const st = escStyleAttr(
          `color:#c2410c;font-weight:600;text-decoration:underline;text-underline-offset:0.22em`,
        );
        return `<a${aIn} style="${st}">`;
      });
      return `<div${divAttrs}>${patched}</div>`;
    },
  );
}

export function embedInlineArticleVisualStyles(html: string): string {
  let out = fixMalformedPostDividerHr(html);

  const pairs: Array<[string, string]> = [
    ["post", S.post],
    ["post-disclosure", S.disclosure],
    ["post-hero", S.hero],
    ["post-key-summary", S.keySummary],
    ["post-toc", S.toc],
    ["post-pros", S.pros],
    ["post-cons", S.cons],
    ["post-reco-pair", RECO_PAIR_WIDE],
    ["post-reco-yes", S.recoYes],
    ["post-reco-no", S.recoNo],
    ["post-checklist", S.checklist],
    ["post-cta-card", S.ctaCard],
    ["post-spotlight", S.spotlight],
    ["post-callout", S.callout],
    ["post-card-grid", S.cardGrid],
    ["post-mini-card", S.miniCard],
    ["table-wrap", S.tableWrap],
  ];

  for (const [token, css] of pairs) {
    out = injectStyleOnOpenTag(out, ["div"], token, css);
  }

  out = injectStyleOnOpenTag(out, ["p"], "post-lead", S.lead);
  out = injectStyleOnOpenTag(out, ["p"], "post-spotlight-title", S.spotlightTitle);
  out = injectStyleOnOpenTag(out, ["p"], "post-spotlight-desc", S.spotlightDesc);
  out = injectStyleOnOpenTag(out, ["a"], "post-spotlight-btn", S.spotlightBtn);
  out = injectStyleOnOpenTag(out, ["p"], "post-mini-card-title", `font-weight:700;color:#1d4ed8;margin:0 0 0.45rem;font-size:0.9375rem;line-height:1.38`);

  out = stylePostTocInnerContent(out);

  out = injectPostDividerHrStyle(out, S.divider);

  {
    const styleTable = escStyleAttr(
      `width:100%;border-collapse:collapse;font-size:0.93em;margin:0;background:#fff`,
    );
    out = out.replace(/<table(\s[^>]*)>/gi, (full, inner: string) => {
      if (/\bstyle\s*=/i.test(inner)) return full;
      return `<table${inner} style="${styleTable}">`;
    });
  }

  {
    const thStyle = escStyleAttr(
      `background:#f0f7ff;color:#0f172a;font-weight:800;padding:0.75rem 0.65rem;text-align:center;border:1px solid #ddd;font-size:0.95em;vertical-align:middle`,
    );
    out = out.replace(/<th(\s[^>]*)>/gi, (full, inner: string) => {
      if (/\bstyle\s*=/i.test(inner)) return full;
      return `<th${inner} style="${thStyle}">`;
    });
  }

  {
    const tdStyle = escStyleAttr(
      `border:1px solid #ddd;padding:0.72rem 0.65rem;vertical-align:middle;color:#334155;text-align:center;background:#fff`,
    );
    out = out.replace(/<td(\s[^>]*)>/gi, (full, inner: string) => {
      if (/\bstyle\s*=/i.test(inner)) return full;
      return `<td${inner} style="${tdStyle}">`;
    });
  }

  {
    const h2s = escStyleAttr(S.h2);
    out = out.replace(/<h2(\s[^>]*)>/gi, (full, inner: string) => {
      if (/\bstyle\s*=/i.test(inner)) return full;
      return `<h2${inner} style="${h2s}">`;
    });
  }
  {
    const h3s = escStyleAttr(S.h3);
    out = out.replace(/<h3(\s[^>]*)>/gi, (full, inner: string) => {
      if (/\bstyle\s*=/i.test(inner)) return full;
      return `<h3${inner} style="${h3s}">`;
    });
  }

  const imgStyle = escStyleAttr(
    `display:block;width:100%;height:auto;border-radius:10px`,
  );
  out = out.replace(
    /(<div\b[^>]*\bclass\s*=\s*["'][^"']*\bpost-hero\b[^"']*["'][^>]*>[\s\S]*?<img)(?![^>]*\bstyle\s*=)(\s[^>]*>)/gi,
    `$1 style="${imgStyle}"$2`,
  );

  out = styleTableWrapAnchors(out);

  return out;
}
