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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 게이트웨이/과부하/레이트리밋 등 일시적 오류 — 재시도 대상 */
function isRetryableOpenAiRequestError(e: unknown): boolean {
  if (!axios.isAxiosError(e)) return false;
  const status = e.response?.status;
  if (status === 429) return true;
  if (status === 502 || status === 503 || status === 504) return true;
  const code = e.code;
  if (code === "ECONNRESET" || code === "ETIMEDOUT" || code === "ECONNABORTED") return true;
  if (e.message.includes("timeout")) return true;
  return false;
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
    temperature: 0.58,
    /** 장문 HTML(매거진형 본문) 생성 시 잘림 방지 — articlePrompt 분량(만 자 단위 텍스트)에 맞춤 */
    max_tokens: 14000,
    response_format: { type: "json_object" as const },
  };

  const maxAttempts = 5;
  let res: { data: OpenAIChatCompletionResponse } | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      res = await axios.post<OpenAIChatCompletionResponse>(
        "https://api.openai.com/v1/chat/completions",
        body,
        {
          headers: {
            Authorization: `Bearer ${params.apiKey}`,
            "Content-Type": "application/json",
          },
          /** 긴 JSON·HTML(만 자 단위) 생성 시 API 응답이 2분을 넘기는 경우가 있어 여유 있게 둡니다. */
          timeout: 300_000,
        },
      );
      break;
    } catch (e: unknown) {
      const retryable = isRetryableOpenAiRequestError(e);
      const willRetry = retryable && attempt < maxAttempts;
      if (willRetry) {
        const waitMs = Math.min(2000 * 2 ** (attempt - 1), 30_000);
        await sleep(waitMs);
        continue;
      }
      if (axios.isAxiosError(e)) {
        const status = e.response?.status;
        const data = e.response?.data as { error?: { message?: string } } | undefined;
        const apiMsg = data?.error?.message;
        if (apiMsg) {
          throw new Error(`OpenAI API 오류: ${apiMsg}`);
        }
        if (status) {
          throw new Error(
            `OpenAI API 오류: Request failed with status code ${status}${status === 502 ? " (서버 일시 오류 — 잠시 뒤 다시 시도해 주세요)" : ""}`,
          );
        }
      }
      throw e instanceof Error ? e : new Error(String(e));
    }
  }

  if (!res) {
    throw new Error("OpenAI 요청이 반복 실패했습니다.");
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
