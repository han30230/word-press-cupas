import axios, { type AxiosInstance } from "axios";
import { randomBytes } from "node:crypto";
import type { Logger } from "../../utils/logger.js";
import type { NormalizedProduct } from "../coupang/types.js";

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 60_000;

/**
 * 쿠팡 등 쇼핑 CDN의 외부 이미지 URL을 <img src>로만 붙이면, 브라우저·WP 테마/플러그인 정책에 따라
 * (Referer/핫링크 차단, img-src CSP, 403) 그림이 뜨지 않거나 썸네일/본문에서만 깨질 수 있습니다.
 * 같은 이미지를 /media 로 올려 wp에서 제공하는 source_url을 쓰면 같은 퍼머링크/도메인에 맞아 안정적입니다.
 */

interface WpMediaRestResponse {
  id: number;
  source_url?: string;
  /** 일부 응답 */
  url?: string;
  guid?: { rendered?: string };
  mime_type?: string;
}

function pickMediaSourceUrl(data: WpMediaRestResponse): string | null {
  const u = data.source_url ?? data.url ?? data.guid?.rendered;
  if (u && typeof u === "string" && /^https?:\/\//i.test(u.trim())) {
    return u.trim();
  }
  return null;
}

function htmlDecodeBasic(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function encodeUrlForHtmlAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

export function buildDownloadHeaders(targetUrl: string): Record<string, string> {
  let origin = "";
  try {
    origin = new URL(targetUrl).origin;
  } catch {
    // ignore
  }
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    ...(origin ? { Referer: `${origin}/` } : {}),
  };
}

function extensionFromPath(pathname: string): string | null {
  const base = pathname.split("/").pop() ?? "";
  const m = /^[^?#]+\.([a-z0-9]+)$/i.exec(base);
  return m ? m[1].toLowerCase() : null;
}

function mimeFromExt(ext: string | null): string | null {
  if (!ext) return null;
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    avif: "image/avif",
  };
  return map[ext] ?? null;
}

function sniffImageMimeFromBuffer(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
  if (buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return "image/webp";
  return null;
}

function parseImageContentTypeHeader(raw: string | undefined): string | null {
  if (!raw) return null;
  const main = raw.split(";")[0]?.trim().toLowerCase() ?? "";
  if (main.startsWith("image/")) return main;
  return null;
}

function resolveMimeType(
  contentType: string | undefined,
  requestUrl: string,
  body: Buffer,
): string {
  const fromHeader = parseImageContentTypeHeader(contentType);
  if (fromHeader) return fromHeader;
  let pathname = "";
  try {
    pathname = new URL(requestUrl).pathname;
  } catch {
    // ignore
  }
  const fromUrl = mimeFromExt(extensionFromPath(pathname));
  if (fromUrl) return fromUrl;
  const fromMagic = sniffImageMimeFromBuffer(body);
  if (fromMagic) return fromMagic;
  return "image/jpeg";
}

function sanitizeImageFilenameForDisposition(name: string, mime: string): string {
  const extFromMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/avif": "avif",
  };
  const ext = extFromMime[mime] ?? "jpg";
  const cleaned = name
    .replace(/\.[a-z0-9]+$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "");
  const base = cleaned.length > 0 && cleaned.length < 60 ? cleaned : `coupang-img`;
  return `${base}-${randomBytes(4).toString("hex")}.${ext}`;
}

function inferFilename(requestUrl: string, mime: string): string {
  let pathname = "";
  try {
    pathname = new URL(requestUrl).pathname;
  } catch {
    // ignore
  }
  const last = (pathname.split("/").pop() ?? "").split("?")[0] || "";
  if (last && /^[a-z0-9._-]+\.(jpe?g|png|gif|webp|avif)$/i.test(last)) {
    return sanitizeImageFilenameForDisposition(last, mime);
  }
  return sanitizeImageFilenameForDisposition("product-image", mime);
}

/**
 * <img> 태그의 src만 대상으로, fromUrl(및 &amp; 인코딩된 동일 URL)을 toUrl(속성에 맞게 &amp; 처리)로 바꿉니다.
 * 전역 문자열 replace로 본문·링크·스크립트를 건드리지 않습니다.
 */
export function replaceExternalImageSrcInHtml(html: string, fromUrl: string, toUrl: string): string {
  if (!fromUrl || !toUrl || fromUrl === toUrl) return html;
  const fromTrim = fromUrl.trim();
  const fromDecoded = htmlDecodeBasic(fromTrim);
  const toForDoubleQuote = encodeUrlForHtmlAttr(toUrl);
  const toForSingle = toUrl.replace(/'/g, "&#39;").replace(/&/g, "&amp;");

  return html.replace(/<img\b[^>]*?>/gi, (tag) => {
    return tag.replace(/\bsrc\s*=\s*(["'])([^"']*)\1/i, (full, q: string, srcVal: string) => {
      const decoded = htmlDecodeBasic(srcVal);
      if (decoded !== fromDecoded && srcVal !== fromTrim) return full;
      const out = q === '"' ? toForDoubleQuote : toForSingle;
      return `src=${q}${out}${q}`;
    });
  });
}

/**
 * 외부 이미지를 받아 WordPress /media에 업로드하고 id·source_url을 돌려줍니다.
 * self-hosted( Basic Auth + /wp/v2 )·WordPress.com( Bearer + public API ) 모두 동일 client 경로로 동작합니다.
 */
export async function uploadImageFromUrlToWordPress(
  client: AxiosInstance,
  imageUrl: string,
  logger: Logger,
): Promise<{ id: number; sourceUrl: string; mimeType?: string } | null> {
  const u = imageUrl.trim();
  if (!u || !/^https?:\/\//i.test(u)) {
    logger.warn("WordPress 미디어 업로드 생략: URL이 http(s)가 아닙니다.", { imageUrl: u });
    return null;
  }

  let body: Buffer;
  let contentTypeFromDownload: string | undefined;
  try {
    const res = await axios.get<ArrayBuffer>(u, {
      responseType: "arraybuffer",
      timeout: DOWNLOAD_TIMEOUT_MS,
      maxContentLength: MAX_IMAGE_BYTES,
      maxBodyLength: MAX_IMAGE_BYTES,
      validateStatus: (s) => s === 200,
      headers: buildDownloadHeaders(u),
    });
    const buf = Buffer.from(res.data);
    if (buf.length === 0) {
      logger.warn("WordPress 미디어 업로드 실패: 다운로드한 본문이 비어 있음", { imageUrl: u });
      return null;
    }
    if (buf.length > MAX_IMAGE_BYTES) {
      logger.warn("WordPress 미디어 업로드 실패: 용량 초과", {
        imageUrl: u,
        bytes: buf.length,
        max: MAX_IMAGE_BYTES,
      });
      return null;
    }
    body = buf;
    contentTypeFromDownload =
      typeof res.headers["content-type"] === "string" ? res.headers["content-type"] : undefined;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = axios.isAxiosError(e) ? e.response?.status : undefined;
    logger.warn("WordPress 미디어: 외부 이미지 다운로드 실패(본문은 원본 URL로 발행 시도)", {
      imageUrl: u,
      message: msg,
      httpStatus: status,
    });
    return null;
  }

  const mime = resolveMimeType(contentTypeFromDownload, u, body);
  if (!mime.startsWith("image/")) {
    logger.warn("WordPress 미디어 업로드 생략: image/* MIME이 아님", { imageUrl: u, mime });
    return null;
  }

  const filename = inferFilename(u, mime);
  const dispo = `attachment; filename="${filename.replace(/"/g, "_")}"`;

  try {
    const res = await client.post<WpMediaRestResponse>("/media", body, {
      headers: {
        "Content-Disposition": dispo,
        "Content-Type": mime,
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    const data = res.data;
    const sourceUrl = pickMediaSourceUrl(data);
    if (typeof data.id !== "number" || !sourceUrl) {
      logger.error("WordPress /media 응답에 id·이미지 URL(source_url·url·guid)이 없습니다.", {
        data,
      });
      return null;
    }
    logger.info("WordPress 미디어 업로드 완료", {
      id: data.id,
      sourceUrl,
      mime: data.mime_type ?? mime,
    });
    return {
      id: data.id,
      sourceUrl,
      mimeType: data.mime_type ?? mime,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (e && typeof e === "object" && "response" in e) {
      const ax = e as { response?: { status?: number; data?: { message?: string; code?: string } } };
      const status = ax.response?.status;
      const wp = ax.response?.data;
      logger.warn("WordPress /media 업로드 실패(원본 URL로 본문 발행은 계속)", {
        imageUrl: u,
        httpStatus: status,
        wpCode: wp?.code,
        wpMessage: wp?.message,
        message: msg,
      });
    } else {
      logger.warn("WordPress /media 업로드 실패(알 수 없는 오류)", { imageUrl: u, message: msg });
    }
    return null;
  }
}

/**
 * 글에 등장할 수 있는 모든 상품 이미지 URL(중복 제거)을 미디어로 올리고, 본문 src를 사이트 URL로 맞춥니다.
 * 대표 상품(representative)의 업로드가 성공한 경우에만 featuredMediaId를 넣을 수 있게 id를 기록합니다.
 */
export async function uploadProductImagesAndReplaceInHtml(
  client: AxiosInstance,
  products: readonly NormalizedProduct[],
  representative: NormalizedProduct,
  html: string,
  logger: Logger,
): Promise<{ html: string; featuredMediaId?: number }> {
  const repU = representative.productImage?.trim() ?? "";
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const p of products) {
    const u = p.productImage?.trim();
    if (u && /^https?:\/\//i.test(u) && !seen.has(u)) {
      seen.add(u);
      urls.push(u);
    }
  }
  if (urls.length === 0) {
    logger.debug("상품 이미지 URL 없음: 미디어 업로드·치환 생략");
    return { html };
  }
  const ordered = repU && seen.has(repU) ? [repU, ...urls.filter((x) => x !== repU)] : urls;
  let out = html;
  let featuredMediaId: number | undefined;
  for (const u of ordered) {
    const uploaded = await uploadImageFromUrlToWordPress(client, u, logger);
    if (uploaded) {
      out = replaceExternalImageSrcInHtml(out, u, uploaded.sourceUrl);
      if (u === repU) {
        featuredMediaId = uploaded.id;
      }
    }
  }
  if (out !== html) {
    logger.info("본문 <img>의 외부 이미지 URL을 WordPress 미디어 URL로 치환했습니다.", {
      urlsTried: ordered.length,
      featuredMediaId: featuredMediaId ?? null,
    });
  }
  return { html: out, featuredMediaId };
}
