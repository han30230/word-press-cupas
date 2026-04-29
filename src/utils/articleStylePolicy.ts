/**
 * WordPress.com 무료 플랜은 «추가 CSS» 불가 → 테마 CSS 없이 글이 밋밋해 보임.
 * 기본값: 본문 시맨틱 블록에 인라인 style 을 넣어 바로 반영되게 함.
 * 유료·자체 호스팅에서 전역 CSS만 쓰려면: WP_ARTICLE_INLINE_STYLES=false
 */
export function isArticleInlineStylesEnabled(): boolean {
  const v = process.env.WP_ARTICLE_INLINE_STYLES?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  return true;
}
