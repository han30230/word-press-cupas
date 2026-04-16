import fs from "node:fs";
import path from "node:path";
import type { Logger } from "../../utils/logger.js";

export interface PublishedRecord {
  keyword: string;
  postId: number;
  title: string;
  slug: string;
  publishedAt: string;
}

export interface KeywordState {
  cursor: number;
  records: PublishedRecord[];
}

export interface KeywordsFile {
  keywords: string[];
}

function defaultState(): KeywordState {
  return { cursor: 0, records: [] };
}

export function loadKeywordsFile(filePath: string): string[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as KeywordsFile;
  if (!parsed || !Array.isArray(parsed.keywords)) {
    throw new Error("keywords.json 형식은 { \"keywords\": [\"...\"] } 이어야 합니다.");
  }
  const list = parsed.keywords.map((k) => String(k).trim()).filter((k) => k.length > 0);
  if (list.length === 0) {
    throw new Error("keywords.json에 유효한 키워드가 없습니다.");
  }
  return list;
}

export function loadState(filePath: string): KeywordState {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as KeywordState;
    if (typeof parsed.cursor !== "number" || !Array.isArray(parsed.records)) {
      return defaultState();
    }
    return {
      cursor: Number.isFinite(parsed.cursor) ? parsed.cursor : 0,
      records: parsed.records.filter(
        (r) =>
          r &&
          typeof r.keyword === "string" &&
          typeof r.postId === "number" &&
          typeof r.title === "string" &&
          typeof r.slug === "string",
      ),
    };
  } catch {
    return defaultState();
  }
}

export function saveState(filePath: string, state: KeywordState): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), "utf8");
}

export function publishedKeywordSet(state: KeywordState): Set<string> {
  return new Set(state.records.map((r) => r.keyword.trim().toLowerCase()));
}

/**
 * cursor부터 순환하며 아직 발행 이력이 없는 키워드를 고릅니다.
 */
export function pickNextKeyword(
  keywords: string[],
  state: KeywordState,
): { keyword: string; index: number } | null {
  const n = keywords.length;
  if (n === 0) return null;
  const used = publishedKeywordSet(state);
  for (let step = 0; step < n; step += 1) {
    const idx = (state.cursor + step) % n;
    const kw = keywords[idx].trim();
    if (!kw) continue;
    if (!used.has(kw.toLowerCase())) {
      return { keyword: kw, index: idx };
    }
  }
  return null;
}

export function advanceCursor(keywordCount: number, usedIndex: number): number {
  if (keywordCount <= 0) return 0;
  return (usedIndex + 1) % keywordCount;
}

export function appendPublication(
  state: KeywordState,
  record: PublishedRecord,
  keywordCount: number,
  usedIndex: number,
): KeywordState {
  return {
    cursor: advanceCursor(keywordCount, usedIndex),
    records: [...state.records, record],
  };
}

export function ensureStateFileDir(filePath: string, logger: Logger): void {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  } catch (e) {
    logger.warn("상태 파일 디렉터리 생성 실패(무시 가능)", { error: String(e) });
  }
}
