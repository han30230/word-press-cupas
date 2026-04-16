import fs from "node:fs";
import path from "node:path";
import { ensureWindowsConsoleUtf8 } from "./winConsoleUtf8.js";

export type LogLevel = "info" | "warn" | "error" | "debug";

function timestamp(): string {
  return new Date().toISOString();
}

function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

export function createLogger(logFile: string) {
  ensureWindowsConsoleUtf8();
  ensureDir(logFile);

  function write(level: LogLevel, message: string, meta?: unknown): void {
    const line = meta !== undefined
      ? `[${timestamp()}] [${level.toUpperCase()}] ${message} ${typeof meta === "string" ? meta : JSON.stringify(meta)}\n`
      : `[${timestamp()}] [${level.toUpperCase()}] ${message}\n`;
    try {
      fs.appendFileSync(logFile, line, "utf8");
    } catch {
      // ignore file errors; still log to console
    }
    if (level === "error") {
      console.error(line.trimEnd());
    } else {
      console.log(line.trimEnd());
    }
  }

  return {
    info: (message: string, meta?: unknown) => write("info", message, meta),
    warn: (message: string, meta?: unknown) => write("warn", message, meta),
    error: (message: string, meta?: unknown) => write("error", message, meta),
    debug: (message: string, meta?: unknown) => write("debug", message, meta),
  };
}

export type Logger = ReturnType<typeof createLogger>;
