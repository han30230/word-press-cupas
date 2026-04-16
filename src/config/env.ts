import dotenv from "dotenv";
import path from "node:path";
import { appRootDir } from "../utils/appRoot.js";
import { isWordPressComSite } from "../modules/wordpress/host.js";

dotenv.config({ path: path.join(appRootDir(), ".env") });
dotenv.config();

function resolvePath(p: string): string {
  if (path.isAbsolute(p)) return p;
  return path.resolve(appRootDir(), p);
}

function required(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v.trim();
}

function optional(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : fallback;
}

/** 비어 있으면 "" — WordPress 등 선택 설정용 */
function optionalEmpty(name: string): string {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : "";
}

function optionalInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v || !v.trim()) return fallback;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

export type WpPostStatus = "draft" | "publish";

export interface AppEnv {
  coupangAccessKey: string;
  coupangSecretKey: string;
  coupangSubId: string;
  openaiApiKey: string;
  openaiModel: string;
  /** WP_BASE_URL·WP_USERNAME·WP_APPLICATION_PASSWORD 가 모두 있을 때만 true */
  wpEnabled: boolean;
  wpBaseUrl: string;
  wpUsername: string;
  wpApplicationPassword: string;
  /** WordPress.com OAuth 앱 (developer.wordpress.com/apps) — *.wordpress.com 일 때 필수 */
  wpcomClientId: string;
  wpcomClientSecret: string;
  wpPostStatus: WpPostStatus;
  keywordsFile: string;
  publishedStateFile: string;
  minProducts: number;
  maxProducts: number;
  logFile: string;
  /** 생성 본문 HTML 저장 폴더 */
  outputDir: string;
  cronSchedule: string;
  /** app-config 다중 계정용(선택) */
  accountId?: string;
  accountName?: string;
}

export function loadEnv(): AppEnv {
  const wpStatus = optional("WP_POST_STATUS", "draft") as WpPostStatus;
  if (wpStatus !== "draft" && wpStatus !== "publish") {
    throw new Error("WP_POST_STATUS must be 'draft' or 'publish'");
  }

  const minP = optionalInt("MIN_PRODUCTS", 3);
  const maxP = optionalInt("MAX_PRODUCTS", 5);
  if (minP < 1 || maxP < minP || maxP > 10) {
    throw new Error("MIN_PRODUCTS/MAX_PRODUCTS must satisfy 1 <= MIN <= MAX <= 10");
  }

  const wpBaseUrl = optionalEmpty("WP_BASE_URL").replace(/\/+$/, "");
  const wpUsername = optionalEmpty("WP_USERNAME");
  const wpApplicationPassword = optionalEmpty("WP_APPLICATION_PASSWORD");
  const wpEnabled = Boolean(wpBaseUrl && wpUsername && wpApplicationPassword);
  const wpcomClientId = optionalEmpty("WPCOM_CLIENT_ID");
  const wpcomClientSecret = optionalEmpty("WPCOM_CLIENT_SECRET");

  if (wpEnabled && isWordPressComSite(wpBaseUrl)) {
    if (!wpcomClientId || !wpcomClientSecret) {
      throw new Error(
        "WordPress.com 주소(*.wordpress.com)는 WPCOM_CLIENT_ID, WPCOM_CLIENT_SECRET 이 필요합니다. https://developer.wordpress.com/apps/ 에서 앱을 등록한 뒤 .env에 넣으세요.",
      );
    }
  }

  return {
    coupangAccessKey: required("COUPANG_ACCESS_KEY"),
    coupangSecretKey: required("COUPANG_SECRET_KEY"),
    coupangSubId: optional("COUPANG_SUB_ID", "default-channel"),
    openaiApiKey: required("OPENAI_API_KEY"),
    openaiModel: optional("OPENAI_MODEL", "gpt-4o-mini"),
    wpEnabled,
    wpBaseUrl,
    wpUsername,
    wpApplicationPassword,
    wpcomClientId,
    wpcomClientSecret,
    wpPostStatus: wpStatus,
    keywordsFile: resolvePath(optional("KEYWORDS_FILE", "./data/keywords.json")),
    publishedStateFile: resolvePath(optional("PUBLISHED_STATE_FILE", "./data/published-state.json")),
    minProducts: minP,
    maxProducts: maxP,
    logFile: resolvePath(optional("LOG_FILE", "./logs/app.log")),
    outputDir: resolvePath(optional("OUTPUT_DIR", "./output")),
    cronSchedule: optional("CRON_SCHEDULE", "0 9,15,21 * * *"),
  };
}
