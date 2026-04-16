/**
 * WordPress에 넣기 전 최소한의 HTML 정리.
 * - script/style 제거
 * - on* 이벤트 속성 제거 (img onerror는 예외적으로 복구)
 */
export function sanitizePostHtml(html: string): string {
  let out = html;
  out = out.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  out = out.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
  out = out.replace(/\son\w+\s*=\s*(["'])[\s\S]*?\1/gi, "");
  out = out.replace(/\son\w+\s*=\s*[^\s>]+/gi, "");

  // img에 onerror 복구 (요구사항)
  out = out.replace(/<img\b([^>]*?)>/gi, (full, inner: string) => {
    if (/\sonerror\s*=/i.test(inner)) {
      return `<img${inner}>`;
    }
    const trimmed = inner.trimEnd();
    const sep = trimmed.length ? " " : "";
    return `<img${trimmed}${sep}onerror="this.style.display='none'">`;
  });

  return out.trim();
}
