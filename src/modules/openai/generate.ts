import axios from "axios";
import type { NormalizedProduct } from "../coupang/types.js";
import {
  ARTICLE_SYSTEM_INSTRUCTION,
  buildArticleUserPrompt,
  type ArticlePromptInput,
} from "./prompts/articlePrompt.js";
import { sanitizePostHtml } from "../../utils/sanitize.js";

export interface GeneratedArticle {
  title: string;
  excerpt: string;
  html: string;
}

interface OpenAIChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string; type?: string; code?: string };
}

function extractJsonText(text: string): string {
  const trimmed = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(trimmed);
  if (fence) return fence[1].trim();
  return trimmed;
}

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/**
 * 모델이 <img>를 빼먹거나, 프롬프트에 빈 productImage만 넘어간 경우에도
 * 쿠팡에서 받은 대표 상품 이미지 URL이 있으면 본문에 한 장 넣습니다.
 */
function ensureRepresentativeProductImage(html: string, rep: NormalizedProduct): string {
  const url = rep.productImage.trim();
  if (!url || !/^https?:\/\//i.test(url)) return html;
  if (/<img\b/i.test(html)) return html;
  const alt = escapeHtmlAttr(rep.productName || "상품");
  const src = escapeHtmlAttr(url);
  const block = `<p class="hero-img"><img src="${src}" alt="${alt}" loading="lazy" decoding="async" /></p>`;
  return html.replace(
    /(<div\b[^>]*\bclass\s*=\s*["']post["'][^>]*>)/i,
    `$1${block}`,
  );
}

export async function generateArticleHtml(params: {
  apiKey: string;
  model: string;
  blogTopic: string;
  products: NormalizedProduct[];
  representative: NormalizedProduct;
}): Promise<GeneratedArticle> {
  const promptInput: ArticlePromptInput = {
    blogTopic: params.blogTopic,
    products: params.products,
    representative: params.representative,
  };

  const userPrompt = buildArticleUserPrompt(promptInput);

  const body = {
    model: params.model,
    messages: [
      { role: "system" as const, content: ARTICLE_SYSTEM_INSTRUCTION },
      { role: "user" as const, content: userPrompt },
    ],
    temperature: 0.55,
    response_format: { type: "json_object" as const },
  };

  let res;
  try {
    res = await axios.post<OpenAIChatCompletionResponse>(
      "https://api.openai.com/v1/chat/completions",
      body,
      {
        headers: {
          Authorization: `Bearer ${params.apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 120_000,
      },
    );
  } catch (e: unknown) {
    if (axios.isAxiosError(e) && e.response?.data) {
      const data = e.response.data as { error?: { message?: string } };
      const msg = data.error?.message ?? e.message;
      throw new Error(`OpenAI API 오류: ${msg}`);
    }
    throw e instanceof Error ? e : new Error(String(e));
  }

  const err = res.data.error;
  if (err?.message) {
    throw new Error(`OpenAI API 오류: ${err.message}`);
  }

  const text = res.data.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) {
    throw new Error("OpenAI 응답에 텍스트가 없습니다.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonText(text));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`OpenAI JSON 파싱 실패: ${msg}`);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("OpenAI 응답 JSON 형식이 올바르지 않습니다.");
  }

  const obj = parsed as Record<string, unknown>;
  const title = typeof obj.title === "string" ? obj.title.trim() : "";
  const excerpt = typeof obj.excerpt === "string" ? obj.excerpt.trim() : "";
  const html = typeof obj.html === "string" ? obj.html.trim() : "";

  if (!title || !html) {
    throw new Error("OpenAI 응답에 title 또는 html이 비어 있습니다.");
  }

  if (!/<div\b[^>]*\bclass\s*=\s*["']post["'][^>]*>/i.test(html)) {
    throw new Error('본문 HTML은 <div class="post"> 를 포함해야 합니다.');
  }

  const htmlWithImage = ensureRepresentativeProductImage(html, params.representative);
  const safeHtml = sanitizePostHtml(htmlWithImage);

  return {
    title,
    excerpt: excerpt || title.slice(0, 160),
    html: safeHtml,
  };
}
