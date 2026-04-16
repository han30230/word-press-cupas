import { randomBytes } from "node:crypto";
import type { AxiosInstance } from "axios";
import type { WpPostStatus } from "../../config/env.js";
import type { Logger } from "../../utils/logger.js";

export interface WpPostPayload {
  title: string;
  content: string;
  excerpt: string;
  status: WpPostStatus;
}

export interface WpPostCreated {
  id: number;
  url: string;
  slug: string;
  title: string;
}

interface WpPostResponse {
  id: number;
  link: string;
  slug: string;
  title?: { rendered?: string };
}

function stripHtmlTitle(s: string): string {
  return s.replace(/<[^>]+>/g, "").trim();
}

interface WpErrorResponse {
  code?: string;
  message?: string;
  data?: { status?: number };
}

function buildSlugBase(title: string, keyword: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  if (base.length >= 3) return base;
  const safe = keyword
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  if (safe.length >= 2) return `${safe}-guide`;
  return "post";
}

/**
 * GET /posts 로 중복 검사하지 않음(일부 서버에서 search/slug 조회가 404).
 * 슬러그에 시간·랜덤을 붙여 충돌을 피합니다.
 */
function buildUniqueSlug(title: string, keyword: string): string {
  const base = buildSlugBase(title, keyword);
  const suffix = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
  const combined = `${base}-${suffix}`;
  return combined.slice(0, 180);
}

export async function createWordPressPost(
  client: AxiosInstance,
  logger: Logger,
  payload: WpPostPayload,
  keyword: string,
): Promise<WpPostCreated> {
  const title = payload.title.trim();
  const slug = buildUniqueSlug(title, keyword);

  const body = {
    title,
    slug,
    content: payload.content,
    excerpt: payload.excerpt,
    status: payload.status,
  };

  try {
    const res = await client.post<WpPostResponse>("/posts", body);
    const data = res.data;
    const titleRendered = data.title?.rendered
      ? stripHtmlTitle(data.title.rendered)
      : title;
    return {
      id: data.id,
      url: data.link,
      slug: data.slug,
      title: titleRendered || title,
    };
  } catch (e: unknown) {
    if (e && typeof e === "object" && "response" in e) {
      const ax = e as {
        response?: { status?: number; data?: WpErrorResponse };
        message?: string;
      };
      const status = ax.response?.status;
      const data = ax.response?.data;
      const detail = {
        httpStatus: status,
        wpCode: data?.code,
        wpMessage: data?.message,
        wpDataStatus: data?.data?.status,
      };
      logger.error("WordPress 글 생성 실패", detail);
      throw new Error(
        `WordPress 업로드 실패: HTTP ${status ?? "?"} ${data?.message ?? ax.message ?? ""}`,
      );
    }
    logger.error("WordPress 글 생성 실패(알 수 없는 오류)", { error: String(e) });
    throw e instanceof Error ? e : new Error(String(e));
  }
}
