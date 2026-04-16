import type { AxiosInstance } from "axios";
import axios from "axios";
import type {
  CoupangGoldboxApiResponse,
  CoupangRawProduct,
  CoupangSearchApiResponse,
  NormalizedProduct,
} from "./types.js";
import type { KeywordState } from "../keywords/store.js";
import { publishedKeywordSet } from "../keywords/store.js";

export class CoupangSearchError extends Error {
  constructor(
    message: string,
    public readonly code: "TOO_FEW" | "API_ERROR" | "BAD_RESPONSE",
  ) {
    super(message);
    this.name = "CoupangSearchError";
  }
}

function parsePrice(raw: CoupangRawProduct): number | null {
  if (typeof raw.productPrice === "number" && Number.isFinite(raw.productPrice)) {
    return raw.productPrice;
  }
  if (typeof raw.productPriceString === "string") {
    const digits = raw.productPriceString.replace(/[^\d]/g, "");
    if (digits) return Number.parseInt(digits, 10);
  }
  return null;
}

function parseRating(raw: CoupangRawProduct): number | null {
  const v = raw.rating ?? raw.reviewRating;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

function parseReviewCount(raw: CoupangRawProduct): number | null {
  const v = raw.reviewCount ?? raw.reviewRatingCount ?? raw.ratingCount;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

/** API 버전에 따라 필드명이 다를 수 있어 후보를 순서대로 시도 */
function pickProductImage(raw: CoupangRawProduct): string {
  const keys = [
    "productImage",
    "productImageUrl",
    "imageUrl",
    "thumbnailImage",
    "mainImage",
  ] as const;
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === "string" && /^https?:\/\//i.test(v.trim())) {
      return v.trim();
    }
  }
  const fallback = String(raw.productImage ?? "").trim();
  return /^https?:\/\//i.test(fallback) ? fallback : "";
}

function parseProductId(raw: CoupangRawProduct): number | null {
  const v: unknown = raw.productId;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && /^\d+$/.test(v.trim())) return Number.parseInt(v.trim(), 10);
  return null;
}

function syntheticIdFromUrl(url: string): string {
  let h = 2166136261;
  for (let i = 0; i < url.length; i += 1) {
    h ^= url.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return String(Math.abs(h >>> 0));
}

export function normalizeProducts(rawList: CoupangRawProduct[]): NormalizedProduct[] {
  return rawList.map((raw, idx) => ({
    productId: parseProductId(raw),
    productName: String(raw.productName ?? "").trim() || `상품 ${idx + 1}`,
    productImage: pickProductImage(raw),
    productUrl: String(raw.productUrl ?? "").trim(),
    price: parsePrice(raw),
    rating: parseRating(raw),
    reviewCount: parseReviewCount(raw),
    isRocket: Boolean(raw.isRocket),
    isFreeShipping: Boolean(raw.isFreeShipping),
    rank: typeof raw.rank === "number" ? raw.rank : idx + 1,
  }));
}

/**
 * 쿠팡 파트너스 상품 검색
 * @param pathOnly API path (no host), e.g. /v2/providers/.../products/search
 */
export async function searchProductsByKeyword(
  client: AxiosInstance,
  pathOnly: string,
  params: {
    keyword: string;
    limit: number;
    subId: string;
  },
): Promise<NormalizedProduct[]> {
  const query = new URLSearchParams({
    keyword: params.keyword,
    limit: String(params.limit),
    subId: params.subId,
    imageSize: "512x512",
    srpLinkOnly: "false",
  });

  const url = `${pathOnly}?${query.toString()}`;
  const res = await client.get<CoupangSearchApiResponse>(url);
  const body = res.data;

  if (!body || typeof body.rCode !== "string") {
    throw new CoupangSearchError("쿠팡 검색 응답 형식이 올바르지 않습니다.", "BAD_RESPONSE");
  }

  if (body.rCode !== "0") {
    throw new CoupangSearchError(
      `쿠팡 검색 API 오류: rCode=${body.rCode}, rMessage=${body.rMessage ?? ""}`,
      "API_ERROR",
    );
  }

  const rawList = body.data?.productData ?? [];
  return normalizeProducts(rawList);
}

function extractGoldboxRawList(body: CoupangGoldboxApiResponse): CoupangRawProduct[] {
  const d = body.data;
  if (Array.isArray(d)) return d;
  if (d && typeof d === "object" && "productData" in d && Array.isArray(d.productData)) {
    return d.productData;
  }
  return [];
}

async function fetchGoldboxProductsOnce(
  client: AxiosInstance,
  pathOnly: string,
  params: { subId: string; limit: number; imageSize?: string },
): Promise<NormalizedProduct[]> {
  const query = new URLSearchParams({
    subId: params.subId,
    limit: String(Math.min(Math.max(params.limit, 1), 20)),
    imageSize: params.imageSize ?? "512x512",
  });
  const url = `${pathOnly}?${query.toString()}`;
  const res = await client.get<CoupangGoldboxApiResponse>(url);
  const body = res.data;

  if (!body || typeof body.rCode !== "string") {
    throw new CoupangSearchError("쿠팡 골드박스 응답 형식이 올바르지 않습니다.", "BAD_RESPONSE");
  }

  if (body.rCode !== "0") {
    throw new CoupangSearchError(
      `쿠팡 골드박스 API 오류: rCode=${body.rCode}, rMessage=${body.rMessage ?? ""}`,
      "API_ERROR",
    );
  }

  const rawList = extractGoldboxRawList(body);
  return normalizeProducts(rawList);
}

/**
 * 골드박스(오늘의 특가) 상품 목록. 키워드 없이 실시간 특가 기반으로 글을 쓸 때 사용.
 * API 경로는 계정/버전에 따라 다를 수 있어 후보를 순서대로 시도합니다.
 */
export async function fetchGoldboxProducts(
  client: AxiosInstance,
  params: {
    subId: string;
    limit: number;
    imageSize?: string;
  },
): Promise<NormalizedProduct[]> {
  let last: Error | null = null;
  for (const pathOnly of COUPANG_GOLDBOX_PATHS) {
    try {
      return await fetchGoldboxProductsOnce(client, pathOnly, params);
    } catch (e) {
      last = e instanceof Error ? e : new Error(String(e));
      if (axios.isAxiosError(e) && e.response?.status === 404) continue;
      throw e;
    }
  }
  throw last ?? new CoupangSearchError("골드박스 API를 호출할 수 없습니다.", "API_ERROR");
}

/** 골드박스 모드 발행 시 이미 쓴 상품(productId/url 해시)은 건너뜀 */
export function pickGoldboxPublication(
  products: NormalizedProduct[],
  state: KeywordState,
  min: number,
  max: number,
): { keyword: string; products: NormalizedProduct[]; representative: NormalizedProduct } | null {
  const used = publishedKeywordSet(state);

  const dedupeKey = (p: NormalizedProduct): string => {
    if (p.productId != null) return `goldbox:${p.productId}`;
    if (p.productUrl) return `goldbox:url:${syntheticIdFromUrl(p.productUrl)}`;
    return "";
  };

  const valid = products.filter(
    (p) =>
      p.productName.trim().length > 0 &&
      p.productUrl.length > 0 &&
      /^https?:\/\//i.test(p.productUrl),
  );
  if (valid.length < min) return null;

  for (let i = 0; i < valid.length; i += 1) {
    const key = dedupeKey(valid[i]);
    if (!key || used.has(key.toLowerCase())) continue;
    const slice = valid.slice(i);
    try {
      const picked = pickProductsForArticle(slice, min, max);
      return { keyword: key, products: picked, representative: picked[0] };
    } catch {
      /* 슬라이스 부족 → 다음 i */
    }
  }
  return null;
}

export const COUPANG_SEARCH_PATH =
  "/v2/providers/affiliate_open_api/apis/openapi/v1/products/search";

/** 검색 API와 동일 openapi 세션의 골드박스 (v1) */
export const COUPANG_GOLDBOX_PATHS: readonly string[] = [
  "/v2/providers/affiliate_open_api/apis/openapi/v1/products/goldbox",
  "/v2/providers/affiliate_open_api/apis/openapi/products/goldbox",
];

export function pickProductsForArticle(
  products: NormalizedProduct[],
  min: number,
  max: number,
): NormalizedProduct[] {
  const valid = products.filter(
    (p) =>
      p.productName.trim().length > 0 &&
      p.productUrl.length > 0 &&
      /^https?:\/\//i.test(p.productUrl),
  );
  if (valid.length < min) {
    throw new CoupangSearchError(
      `유효한 상품이 부족합니다. (필요 ${min}개 이상, 실제 ${valid.length}개)`,
      "TOO_FEW",
    );
  }
  const n = Math.min(max, valid.length);
  return valid.slice(0, n);
}
