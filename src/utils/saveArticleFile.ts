import fs from "node:fs";
import path from "node:path";

export interface ArticleForFile {
  title: string;
  excerpt: string;
  html: string;
}

function safeFileSegment(s: string, max = 48): string {
  const t = s.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/\s+/g, " ").trim();
  return (t.slice(0, max) || "post").replace(/[. ]+$/g, "");
}

/**
 * 생성한 글을 본문 확인용 HTML 파일로 저장합니다.
 * @returns 저장된 절대 경로
 */
export function saveGeneratedArticleHtml(
  outputDir: string,
  keyword: string,
  article: ArticleForFile,
): string {
  fs.mkdirSync(outputDir, { recursive: true });
  const iso = new Date().toISOString().replace(/[:.]/g, "-");
  const kw = safeFileSegment(keyword);
  const name = `${iso}-${kw}.html`;
  const filePath = path.join(outputDir, name);
  const esc = (s: string) => s.replace(/-->/g, "");
  const header = `<!-- generated: ${iso} -->\n<!-- keyword: ${esc(keyword)} -->\n<!-- title: ${esc(article.title)} -->\n<!-- excerpt: ${esc(article.excerpt)} -->\n\n`;
  fs.writeFileSync(filePath, header + article.html, "utf8");
  return path.resolve(filePath);
}
