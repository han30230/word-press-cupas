import fs from "node:fs";
import path from "node:path";
import { appRootDir } from "../utils/appRoot.js";
import { loadEnv } from "./env.js";
import type { WpPostStatus } from "./env.js";

export const APP_CONFIG_FILE = "data/app-config.json";

export interface GlobalConfig {
  coupangAccessKey: string;
  coupangSecretKey: string;
  coupangSubId: string;
  openaiApiKey: string;
  openaiModel: string;
  minProducts: number;
  maxProducts: number;
}

export interface ScheduleConfig {
  enabled: boolean;
  /** 로컬 시간 "HH:mm" (예: 09:00, 15:30) */
  times: string[];
  /** YYYY-MM-DD */
  startDate: string;
  endDate: string;
  /** 하루 최대 실행 횟수 (수동·예약 합산) */
  maxRunsPerDay: number;
}

/** keywords: keywords.json 순서 / goldbox: 키워드 파일 없이 쿠팡 골드박스(실시간 특가) 상품으로 발행 */
export type TopicSource = "keywords" | "goldbox";

export interface AccountConfig {
  id: string;
  name: string;
  enabled: boolean;
  /** 기본 keywords — 키워드 파일 기반 발행 */
  topicSource: TopicSource;
  wpBaseUrl: string;
  wpUsername: string;
  wpApplicationPassword: string;
  wpcomClientId: string;
  wpcomClientSecret: string;
  wpPostStatus: WpPostStatus;
  keywordsFile: string;
  publishedStateFile: string;
  outputDir: string;
  logFile: string;
  schedule: ScheduleConfig;
}

export interface AppConfigFile {
  version: number;
  global: GlobalConfig;
  accounts: AccountConfig[];
}

function resolvePath(p: string): string {
  if (path.isAbsolute(p)) return p;
  return path.resolve(appRootDir(), p);
}

function emptyGlobal(): GlobalConfig {
  return {
    coupangAccessKey: "",
    coupangSecretKey: "",
    coupangSubId: "my-channel",
    openaiApiKey: "",
    openaiModel: "gpt-4o-mini",
    minProducts: 3,
    maxProducts: 5,
  };
}

function defaultSchedule(): ScheduleConfig {
  return {
    enabled: true,
    times: [
      "08:00",
      "09:00",
      "10:00",
      "11:00",
      "12:00",
      "13:00",
      "14:00",
      "15:00",
      "16:00",
      "17:00",
      "18:00",
      "19:00",
      "20:00",
      "21:00",
      "22:00",
    ],
    startDate: "2020-01-01",
    endDate: "2035-12-31",
    maxRunsPerDay: 500,
  };
}

/** .env 단일 설정 → app-config 형태 (파일 없을 때) */
export function buildDefaultFromEnv(): AppConfigFile {
  const e = loadEnv();
  return {
    version: 1,
    global: {
      coupangAccessKey: e.coupangAccessKey,
      coupangSecretKey: e.coupangSecretKey,
      coupangSubId: e.coupangSubId,
      openaiApiKey: e.openaiApiKey,
      openaiModel: e.openaiModel,
      minProducts: e.minProducts,
      maxProducts: e.maxProducts,
    },
    accounts: [
      {
        id: "default",
        name: "기본 계정",
        enabled: true,
        topicSource: "keywords",
        wpBaseUrl: e.wpBaseUrl,
        wpUsername: e.wpUsername,
        wpApplicationPassword: e.wpApplicationPassword,
        wpcomClientId: e.wpcomClientId,
        wpcomClientSecret: e.wpcomClientSecret,
        wpPostStatus: e.wpPostStatus,
        keywordsFile: "./data/keywords.json",
        publishedStateFile: "./data/published-state.json",
        outputDir: "./output",
        logFile: "./logs/app.log",
        schedule: defaultSchedule(),
      },
    ],
  };
}

function mergeGlobalFromEnv(g: GlobalConfig): GlobalConfig {
  const e = loadEnv();
  return {
    coupangAccessKey: g.coupangAccessKey || e.coupangAccessKey,
    coupangSecretKey: g.coupangSecretKey || e.coupangSecretKey,
    coupangSubId: g.coupangSubId || e.coupangSubId,
    openaiApiKey: g.openaiApiKey || e.openaiApiKey,
    openaiModel: g.openaiModel || e.openaiModel,
    minProducts: g.minProducts ?? e.minProducts,
    maxProducts: g.maxProducts ?? e.maxProducts,
  };
}

function normalizeAccount(a: Partial<AccountConfig>, idx: number): AccountConfig {
  const id = typeof a.id === "string" && a.id.trim() ? a.id.trim() : `acc-${idx + 1}`;
  const sch = a.schedule;
  const ts = a.topicSource === "goldbox" ? "goldbox" : "keywords";
  return {
    id,
    name: typeof a.name === "string" && a.name.trim() ? a.name.trim() : `계정 ${idx + 1}`,
    enabled: Boolean(a.enabled),
    topicSource: ts,
    wpBaseUrl: String(a.wpBaseUrl ?? "").replace(/\/+$/, ""),
    wpUsername: String(a.wpUsername ?? ""),
    wpApplicationPassword: String(a.wpApplicationPassword ?? ""),
    wpcomClientId: String(a.wpcomClientId ?? ""),
    wpcomClientSecret: String(a.wpcomClientSecret ?? ""),
    wpPostStatus: (a.wpPostStatus === "publish" ? "publish" : "draft") as WpPostStatus,
    keywordsFile: String(a.keywordsFile ?? "./data/keywords.json"),
    publishedStateFile: String(a.publishedStateFile ?? "./data/published-state.json"),
    outputDir: String(a.outputDir ?? "./output"),
    logFile: String(a.logFile ?? "./logs/app.log"),
    schedule: {
      enabled: sch?.enabled !== false,
      times: Array.isArray(sch?.times) && sch.times.length ? sch.times.map(String) : defaultSchedule().times,
      startDate: String(sch?.startDate ?? defaultSchedule().startDate),
      endDate: String(sch?.endDate ?? defaultSchedule().endDate),
      maxRunsPerDay:
        typeof sch?.maxRunsPerDay === "number" && sch.maxRunsPerDay >= 1
          ? sch.maxRunsPerDay
          : defaultSchedule().maxRunsPerDay,
    },
  };
}

export function loadAppConfig(): AppConfigFile {
  const p = resolvePath(APP_CONFIG_FILE);
  if (!fs.existsSync(p)) {
    return buildDefaultFromEnv();
  }
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as Partial<AppConfigFile>;
    const accounts = Array.isArray(raw.accounts) ? raw.accounts : [];
    const global = mergeGlobalFromEnv({
      ...emptyGlobal(),
      ...(raw.global ?? {}),
    } as GlobalConfig);
    const normAccounts = accounts.length
      ? accounts.map((a, i) => normalizeAccount(a as Partial<AccountConfig>, i))
      : buildDefaultFromEnv().accounts;
    return {
      version: typeof raw.version === "number" ? raw.version : 1,
      global,
      accounts: normAccounts,
    };
  } catch {
    return buildDefaultFromEnv();
  }
}

export function saveAppConfig(config: AppConfigFile): void {
  const p = resolvePath(APP_CONFIG_FILE);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(config, null, 2), "utf8");
}

/** 파일 경로용: id에서 안전한 슬러그 */
function accountPathSlug(id: string): string {
  const s = id.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-");
  return s.length ? s.slice(0, 48) : "account";
}

/**
 * 새 계정을 목록 끝에 추가합니다. 키워드·발행상태·출력·로그 경로는 계정별로 분리됩니다.
 */
export function addAccountToConfig(
  config: AppConfigFile,
  displayName: string,
): AppConfigFile {
  const existingIds = new Set(config.accounts.map((a) => a.id));
  let n = config.accounts.length + 1;
  let id = `acc-${n}`;
  while (existingIds.has(id)) {
    n += 1;
    id = `acc-${n}`;
  }
  const slug = accountPathSlug(id);
  const name = displayName.trim() || `계정 ${n}`;
  const draft: Partial<AccountConfig> = {
    id,
    name,
    enabled: true,
    wpBaseUrl: "",
    wpUsername: "",
    wpApplicationPassword: "",
    wpcomClientId: "",
    wpcomClientSecret: "",
    wpPostStatus: "draft",
    keywordsFile: `./data/keywords-${slug}.json`,
    publishedStateFile: `./data/published-state-${slug}.json`,
    outputDir: `./output/${slug}`,
    logFile: `./logs/${slug}.log`,
    schedule: defaultSchedule(),
  };
  const newAcc = normalizeAccount(draft, config.accounts.length);
  return {
    ...config,
    accounts: [...config.accounts, newAcc],
  };
}
