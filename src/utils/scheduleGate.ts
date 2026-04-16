import fs from "node:fs";
import path from "node:path";
import { appRootDir } from "./appRoot.js";
import type { ScheduleConfig } from "../config/appConfig.js";

const STATE_FILE = "data/schedule-runs.json";

interface DayRec {
  /** 예약 슬롯 HH:mm 이미 시도했는지 (중복 방지) */
  slotTried: Record<string, boolean>;
  /** 그날 성공한 발행 횟수 */
  successCount: number;
}

interface ScheduleState {
  accounts: Record<string, Record<string, DayRec>>;
}

function statePath(): string {
  return path.join(appRootDir(), STATE_FILE);
}

function loadState(): ScheduleState {
  try {
    return JSON.parse(fs.readFileSync(statePath(), "utf8")) as ScheduleState;
  } catch {
    return { accounts: {} };
  }
}

function saveState(s: ScheduleState): void {
  const p = statePath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(s, null, 2), "utf8");
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function localTimeHm(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function isWithinDateRange(now: Date, start: string, end: string): boolean {
  const t = now.getTime();
  return t >= parseYmd(start).getTime() && t <= parseYmd(end).getTime() + 86400000 - 1;
}

function readDay(accountId: string, dk: string): DayRec {
  const s = loadState();
  const d = s.accounts[accountId]?.[dk];
  if (!d) return { slotTried: {}, successCount: 0 };
  return d;
}

/** 예약 실행: 시간 일치 + 기간 + 슬롯 미시도 + 성공 횟수 한도 */
export function shouldRunScheduledSlot(
  accountId: string,
  schedule: ScheduleConfig,
  now: Date,
): boolean {
  if (!schedule.enabled) return false;
  if (!isWithinDateRange(now, schedule.startDate, schedule.endDate)) return false;
  const hm = localTimeHm(now);
  if (!schedule.times.includes(hm)) return false;

  const dk = localDateKey(now);
  const day = readDay(accountId, dk);
  if (day.slotTried[hm]) return false;
  if (day.successCount >= schedule.maxRunsPerDay) return false;
  return true;
}

/** 예약 실행 직전: 슬롯 점유 (같은 분 재실행 방지) */
export function markScheduledSlotTried(accountId: string, now: Date): void {
  const hm = localTimeHm(now);
  const dk = localDateKey(now);
  const s = loadState();
  if (!s.accounts[accountId]) s.accounts[accountId] = {};
  if (!s.accounts[accountId][dk]) {
    s.accounts[accountId][dk] = { slotTried: {}, successCount: 0 };
  }
  s.accounts[accountId][dk].slotTried[hm] = true;
  saveState(s);
}

/** 수동 실행 가능: 기간 + 성공 횟수 한도 */
export function canManualRun(accountId: string, schedule: ScheduleConfig, now: Date): boolean {
  if (!isWithinDateRange(now, schedule.startDate, schedule.endDate)) return false;
  const dk = localDateKey(now);
  const day = readDay(accountId, dk);
  return day.successCount < schedule.maxRunsPerDay;
}

/** 발행 성공 시 호출 */
export function recordPublishSuccess(accountId: string, now: Date): void {
  const dk = localDateKey(now);
  const s = loadState();
  if (!s.accounts[accountId]) s.accounts[accountId] = {};
  if (!s.accounts[accountId][dk]) {
    s.accounts[accountId][dk] = { slotTried: {}, successCount: 0 };
  }
  s.accounts[accountId][dk].successCount += 1;
  saveState(s);
}
