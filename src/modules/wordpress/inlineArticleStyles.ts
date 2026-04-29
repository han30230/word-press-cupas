/**
 * WordPress.com(무료) 등에서 추가 CSS 없이도 본문이 읽기 좋게 보이도록
 * 시맨틱 블록에 **차분한** 인라인 style 만 붙입니다. (무지개·강한 그라데이션 없음)
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
  post: `font-family:'Pretendard Variable',Pretendard,system-ui,sans-serif;font-size:1.05rem;line-height:1.75;color:#1e293b;max-width:44rem;margin:0 auto;word-break:keep-all`,
  disclosure: `font-size:0.875rem;color:#475569;line-height:1.6;padding:0.85rem 1rem;margin:0 0 1.25rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;border-left:3px solid #64748b`,
  hero: `margin:1.2rem 0 1.4rem;padding:0;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden`,
  keySummary: `border:1px solid #e2e8f0;border-radius:12px;padding:1.1rem 1.2rem;margin:1.3rem 0;background:#fafafa`,
  toc: `margin:1.25rem 0;padding:1rem 1.2rem 1.05rem;background:#f8fafc;border:1px solid #cbd5e1;border-radius:12px;border-left:4px solid #0f766e;box-shadow:0 1px 2px rgba(15,23,42,.04)`,
  pros: `border-radius:12px;padding:1.1rem 1.2rem;margin:1.1rem 0;background:#f0fdf4;border:1px solid #bbf7d0`,
  cons: `border-radius:12px;padding:1.1rem 1.2rem;margin:1.1rem 0;background:#fffbeb;border:1px solid #fde68a`,
  recoYes: `border-radius:12px;padding:1.1rem 1.15rem;margin:0.85rem 0;background:#f8fafc;border:1px solid #e2e8f0;border-top:3px solid #0f766e`,
  recoNo: `border-radius:12px;padding:1.1rem 1.15rem;margin:0.85rem 0;background:#fefce8;border:1px solid #e7e5e4;border-top:3px solid #78716c`,
  checklist: `border:1px solid #e2e8f0;border-radius:12px;padding:1.1rem 1.2rem;margin:1.3rem 0;background:#fff`,
  ctaCard: `border-radius:12px;padding:1.2rem 1.25rem;margin:1.65rem 0;background:#f8fafc;border:1px solid #cbd5e1`,
  tableWrap: `overflow-x:auto;margin:1.35rem 0;border-radius:12px;border:1px solid #cbd5e1;background:#fff;box-shadow:0 2px 8px rgba(15,23,42,.06)`,
  divider: `border:0;margin:1.75rem 0;padding:0;height:1px;background:#e2e8f0`,
  h2: `font-size:1.38rem;font-weight:800;line-height:1.32;color:#0f172a;margin:2.1rem 0 0.7rem 0;padding:0 0 0.5rem 0;border-bottom:2px solid #0f766e;letter-spacing:-0.02em`,
  h3: `font-size:1.1rem;font-weight:700;line-height:1.4;color:#1e293b;margin:1.4rem 0 0.45rem 0`,
};

const RECO_PAIR_WIDE = `display:grid;gap:1rem;margin:1rem 0;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))`;

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
          `margin:0 0 0.4rem;font-size:0.82rem;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#0f766e`,
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

function stripeTableBodyRows(html: string): string {
  return html.replace(/(<tbody\b[^>]*>)([\s\S]*?)(<\/tbody>)/gi, (_full, open: string, body: string, close: string) => {
    let i = 0;
    const inner = body.replace(/<tr\b([^>]*)>/gi, (trFull, innerAttrs: string) => {
      if (/\bstyle\s*=/i.test(innerAttrs)) return trFull;
      const bg = i % 2 === 1 ? "#f8fafc" : "#ffffff";
      i += 1;
      const st = escStyleAttr(`background:${bg}`);
      return `<tr${innerAttrs} style="${st}">`;
    });
    return open + inner + close;
  });
}

export function embedInlineArticleVisualStyles(html: string): string {
  let out = html;

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
    ["table-wrap", S.tableWrap],
  ];

  for (const [token, css] of pairs) {
    out = injectStyleOnOpenTag(out, ["div"], token, css);
  }

  out = stylePostTocInnerContent(out);

  out = injectStyleOnOpenTag(out, ["hr"], "post-divider", S.divider);

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
      `background:linear-gradient(180deg,#f1f5f9 0%,#e2e8f0 100%);color:#0f172a;font-weight:800;padding:0.72rem 0.85rem;text-align:left;border:1px solid #cbd5e1;font-size:0.95em`,
    );
    out = out.replace(/<th(\s[^>]*)>/gi, (full, inner: string) => {
      if (/\bstyle\s*=/i.test(inner)) return full;
      return `<th${inner} style="${thStyle}">`;
    });
  }

  {
    const tdStyle = escStyleAttr(
      `border:1px solid #e2e8f0;padding:0.68rem 0.8rem;vertical-align:top;color:#334155`,
    );
    out = out.replace(/<td(\s[^>]*)>/gi, (full, inner: string) => {
      if (/\bstyle\s*=/i.test(inner)) return full;
      return `<td${inner} style="${tdStyle}">`;
    });
  }

  out = stripeTableBodyRows(out);

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

  const aStyle = escStyleAttr(
    `display:inline-block;margin-top:0.35rem;padding:0.55rem 1.15rem;border-radius:8px;font-weight:600;font-size:0.875rem;text-decoration:none !important;color:#fff !important;background:#0f766e;border:1px solid #0d9488`,
  );
  out = out.replace(
    /(<div\b[^>]*\bclass\s*=\s*["'][^"']*\bpost-cta-card\b[^"']*["'][^>]*>[\s\S]*?<a)(?![^>]*\bstyle\s*=)(\s[^>]*>)/gi,
    `$1 style="${aStyle}"$2`,
  );

  const imgStyle = escStyleAttr(
    `display:block;width:100%;height:auto;border-radius:10px`,
  );
  out = out.replace(
    /(<div\b[^>]*\bclass\s*=\s*["'][^"']*\bpost-hero\b[^"']*["'][^>]*>[\s\S]*?<img)(?![^>]*\bstyle\s*=)(\s[^>]*>)/gi,
    `$1 style="${imgStyle}"$2`,
  );

  return out;
}
