import path from "node:path";
import cron from "node-cron";
import { loadAppConfig } from "./config/appConfig.js";
import { runPublishJob } from "./jobs/publishJob.js";
import { createLogger } from "./utils/logger.js";
import { shouldRunScheduledSlot, markScheduledSlotTried } from "./utils/scheduleGate.js";
import { appRootDir } from "./utils/appRoot.js";

const once = process.argv.includes("--once");

function resolveLogPath(p: string): string {
  if (path.isAbsolute(p)) return p;
  return path.resolve(appRootDir(), p);
}

if (once) {
  void runPublishJob({ source: "manual" }).then((r) => {
    if (!r.ok && r.error) console.error(r.error);
    process.exit(r.ok ? 0 : 1);
  });
} else {
  let logger;
  try {
    const cfg = loadAppConfig();
    const firstLog = cfg.accounts[0]?.logFile ?? "./logs/app.log";
    logger = createLogger(resolveLogPath(firstLog));
  } catch (e) {
    console.error("[config]", e instanceof Error ? e.message : String(e));
    process.exit(1);
  }

  logger.info(
    "스케줄러: 매 분 검사 → data/app-config.json 계정별 예약 시각·기간·일일 횟수 적용",
  );

  cron.schedule(
    "* * * * *",
    async () => {
      const config = loadAppConfig();
      const now = new Date();
      for (const acc of config.accounts) {
        if (!acc.enabled || !acc.schedule.enabled) continue;
        if (!shouldRunScheduledSlot(acc.id, acc.schedule, now)) continue;
        markScheduledSlotTried(acc.id, now);
        logger.info(
          `예약 실행: 계정=${acc.name} (${acc.id}) 시각=${now.toISOString()}`,
        );
        try {
          await runPublishJob({ accountId: acc.id, source: "scheduled" });
        } catch (e) {
          logger.error("예약 작업 예외", {
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }
    },
    {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Seoul",
    },
  );

  logger.info("스케줄러가 실행 중입니다. (Ctrl+C로 종료)");
}
