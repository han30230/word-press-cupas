import type { NormalizedProduct } from "../coupang/types.js";
import { sanitizePostHtml } from "../../utils/sanitize.js";
import { isArticleInlineStylesEnabled } from "../../utils/articleStylePolicy.js";
import { embedInlineArticleVisualStyles } from "../wordpress/inlineArticleStyles.js";

function escAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/**
 * LLM이 실수로 본문에 ```html / ``` 를 섞을 때 제거( n8n 워크플로의 .replace(/```html/) 와 동일 목적).
 */
export function stripCodeFencesFromHtmlString(html: string): string {
  let s = html.trim();
  s = s.replace(/^```(?:html|HTML)?\s*/m, "");
  s = s.replace(/\s*```\s*$/m, "");
  return s.trim();
}

/**
 * WordPress REST `content`로 보내기 직전: style·script·위험 on* 제거 후 img 속성 보강.
 * WordPress.com 무료 플랜은 추가 CSS 불가 → 기본으로 인라인 style 주입(embedInlineArticleVisualStyles).
 * 유료·자체 호스팅에서 끄려면 WP_ARTICLE_INLINE_STYLES=false
 */
export function prepareWordPressPostContent(html: string): string {
  let s = sanitizePostHtml(html.trim());
  if (isArticleInlineStylesEnabled()) {
    s = embedInlineArticleVisualStyles(s);
  }
  s = ensureImgTagAttributesInPost(s);
  return s;
}

/**
 * n8n · 프롬프트 요구: img 에 loading, onerror(숨김), decoding
 */
export function ensureImgTagAttributesInPost(html: string): string {
  return html.replace(/<img\b([^>]*)>/gi, (_full, inner: string) => {
    const base = inner.trim();
    const parts: string[] = [];
    if (base) parts.push(` ${base}`);
    if (!/\bloading\s*=/i.test(inner)) parts.push(' loading="lazy"');
    if (!/\bdecoding\s*=/i.test(inner)) parts.push(' decoding="async"');
    if (!/\bonerror\s*=/i.test(inner)) {
      parts.push(` onerror="this.style.display=\'none\'"`);
    }
    return `<img${parts.join("")}>`;
  });
}

/**
 * 본문에 `<img>`가 전혀 없을 때만, 대표 이미지를 `.post` 직후에 넣는다.
 */
export function insertRepresentativeHeroIfNoImg(html: string, rep: NormalizedProduct): string {
  const url = rep.productImage?.trim() ?? "";
  if (!url || !/^https?:\/\//i.test(url)) return html;
  if (/<img\b/i.test(html)) return html;
  const alt = escAttr(rep.productName || "상품");
  const src = escAttr(url);
  const block = `\n<div class="post-hero"><p class="img-cap">아래는 대표 상품 이미지입니다. 실제 색상·구성은 판매 페이지를 참고해 주시기 바랍니다.</p><p class="hero-img"><img src="${src}" alt="${alt}" loading="lazy" decoding="async" onerror="this.style.display='none'" /></p></div>\n`;
  return html.replace(
    /(<div\b[^>]*\bclass\s*=\s*["']post["'][^>]*>)/i,
    `$1${block}`,
  );
}
