import { app, BrowserWindow, ipcMain, shell, dialog } from "electron";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import cron from "node-cron";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function setAppRoot() {
  const root = app.isPackaged
    ? path.dirname(process.execPath)
    : path.join(__dirname, "..");
  process.env.APP_ROOT = root;
}

let mainWindow = null;
let cronTask = null;
let mod = null;

const runOnceFlag = process.argv.includes("--once");

async function loadBundle() {
  const bundlePath = path.join(__dirname, "publish-bundle.cjs");
  return import(pathToFileURL(bundlePath).href);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 720,
    height: 900,
    minWidth: 420,
    minHeight: 560,
    show: false,
    backgroundColor: "#eef1f6",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: "쿠팡 파트너스 자동 발행",
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

app.whenReady().then(async () => {
  setAppRoot();

  try {
    mod = await loadBundle();
  } catch (e) {
    dialog.showErrorBox(
      "번들 로드 실패",
      e instanceof Error ? e.message : String(e),
    );
    app.quit();
    return;
  }

  if (runOnceFlag) {
    try {
      const r = await mod.runPublishJob({ source: "manual" });
      if (!r.ok && r.error) console.error(r.error);
      app.exit(r.ok ? 0 : 1);
    } catch (e) {
      console.error(e);
      app.exit(1);
    }
    return;
  }

  const {
    loadAppConfig,
    createLogger,
    runPublishJob,
    shouldRunScheduledSlot,
    markScheduledSlotTried,
  } = mod;

  try {
    const cfg = loadAppConfig();
    const firstLog = cfg.accounts[0]?.logFile ?? "./logs/app.log";
    const logger = createLogger(
      path.isAbsolute(firstLog)
        ? firstLog
        : path.join(process.env.APP_ROOT ?? process.cwd(), firstLog),
    );
    cronTask = cron.schedule(
      "* * * * *",
      async () => {
        setAppRoot();
        const config = loadAppConfig();
        const now = new Date();
        let ranAny = false;
        for (const acc of config.accounts) {
          if (!acc.enabled || !acc.schedule.enabled) continue;
          if (!shouldRunScheduledSlot(acc.id, acc.schedule, now)) continue;
          markScheduledSlotTried(acc.id, now);
          ranAny = true;
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
        if (ranAny) {
          mainWindow?.webContents.send("job-finished", { source: "cron" });
        }
      },
      {
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Seoul",
      },
    );
    logger.info(
      "분 단위 스케줄러 등록됨(각 계정의 예약 시각·기간·일일 횟수는 data/app-config.json)",
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    dialog.showErrorBox(
      "설정 오류",
      `${msg}\n\n.exe와 같은 폴더에 .env 및 data/app-config.json(또는 data/keywords.json)을 확인하세요.`,
    );
  }

  createWindow();

  ipcMain.handle("run-once", async (_e, payload) => {
    setAppRoot();
    try {
      const accountId =
        payload && typeof payload.accountId === "string"
          ? payload.accountId
          : undefined;
      const r = await mod.runPublishJob({
        accountId,
        source: "manual",
      });
      return {
        ok: r.ok,
        error: r.ok ? null : (r.error ?? "알 수 없는 오류"),
      };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  });

  ipcMain.handle("get-app-config", async () => {
    setAppRoot();
    try {
      return { ok: true, config: mod.loadAppConfig() };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  });

  ipcMain.handle("save-app-config", async (_e, raw) => {
    setAppRoot();
    try {
      mod.saveAppConfig(raw);
      return { ok: true };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  });

  ipcMain.handle("add-account", async (_e, payload) => {
    setAppRoot();
    try {
      const name =
        payload && typeof payload.name === "string" ? payload.name : "";
      const cfg = mod.loadAppConfig();
      const next = mod.addAccountToConfig(cfg, name);
      mod.saveAppConfig(next);
      return { ok: true, config: next };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  });

  ipcMain.handle("read-log", async (_e, payload) => {
    setAppRoot();
    try {
      const accountId = payload?.accountId;
      const cfg = mod.loadAppConfig();
      const acc = accountId
        ? cfg.accounts.find((a) => a.id === accountId)
        : cfg.accounts.find((a) => a.enabled) ?? cfg.accounts[0];
      if (!acc) return { ok: false, error: "계정 없음", text: "" };
      const text = mod.readAccountLogTail(acc.logFile, payload?.maxLines ?? 400);
      return { ok: true, text, accountId: acc.id, accountName: acc.name };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        text: "",
      };
    }
  });

  ipcMain.handle("open-dashboard", async () => {
    const root = process.env.APP_ROOT ?? process.cwd();
    const p = path.join(root, "output", "reports", "dashboard.html");
    const err = await shell.openPath(p);
    if (err) return { ok: false, error: err };
    return { ok: true };
  });

  ipcMain.handle("open-output", async () => {
    const root = process.env.APP_ROOT ?? process.cwd();
    const err = await shell.openPath(path.join(root, "output"));
    if (err) return { ok: false, error: err };
    return { ok: true };
  });

  ipcMain.handle("open-logs", async () => {
    const root = process.env.APP_ROOT ?? process.cwd();
    const err = await shell.openPath(path.join(root, "logs"));
    if (err) return { ok: false, error: err };
    return { ok: true };
  });

  ipcMain.handle("open-app-folder", async () => {
    const root = process.env.APP_ROOT ?? process.cwd();
    const err = await shell.openPath(root);
    if (err) return { ok: false, error: err };
    return { ok: true };
  });

  ipcMain.handle("get-schedule-hint", async () => {
    try {
      setAppRoot();
      const cfg = mod.loadAppConfig();
      const lines = cfg.accounts
        .filter((a) => a.enabled)
        .map((a) => {
          const s = a.schedule;
          return `${a.name}: ${s.times.join(", ")} · ${s.startDate}~${s.endDate} · 하루 최대 ${s.maxRunsPerDay}회${s.enabled ? "" : " (예약 끔)"}`;
        });
      return {
        cron: "매 분 검사 → 계정별 예약 시각에 실행",
        appRoot: process.env.APP_ROOT ?? "",
        detail: lines.join("\n"),
      };
    } catch (e) {
      return {
        cron: "(설정을 불러올 수 없음)",
        appRoot: process.env.APP_ROOT ?? "",
        detail: "",
        error: e instanceof Error ? e.message : String(e),
      };
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }
  if (process.platform !== "darwin") app.quit();
});
