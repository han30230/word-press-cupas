/** esbuild 번들용 진입점 — Electron 메인 프로세스에서 동적 import */
export { runPublishJob } from "../jobs/publishJob.js";
export { loadEnv } from "../config/env.js";
export { createLogger } from "../utils/logger.js";
export { loadAppConfig, saveAppConfig, addAccountToConfig } from "../config/appConfig.js";
import { readLogTail } from "../utils/readLogTail.js";
import path from "node:path";
import { appRootDir } from "../utils/appRoot.js";
import {
  shouldRunScheduledSlot,
  markScheduledSlotTried,
} from "../utils/scheduleGate.js";

export function readAccountLogTail(accountLogFile: string, maxLines?: number): string {
  const p = path.isAbsolute(accountLogFile)
    ? accountLogFile
    : path.resolve(appRootDir(), accountLogFile);
  return readLogTail(p, maxLines ?? 400);
}

export { shouldRunScheduledSlot, markScheduledSlotTried };
