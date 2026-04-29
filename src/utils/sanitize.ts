/**
 * WordPress 본문에 넣기 전 HTML 정리.
 * - `<style>…</style>` 제거(WordPress.com 등에서 본문 `<style>`이 불안정하거나 내용이 그대로 노출되는 경우 대비)
 * - `<script>` 제거
 * - `on*` 이벤트 제거 — 업로드 직전 `ensureImgTagAttributesInPost` 등으로 img `onerror` 재부착 권장
 */
export function stripStyleTagsFromHtml(html: string): string {
  return html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "").trim();
}

export function sanitizePostHtml(html: string): string {
  let out = stripStyleTagsFromHtml(html);
  out = out.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  out = out.replace(/\son\w+\s*=\s*(["'])[\s\S]*?\1/gi, "");
  out = out.replace(/\son\w+\s*=\s*[^\s>]+/gi, "");
  return out.trim();
}
