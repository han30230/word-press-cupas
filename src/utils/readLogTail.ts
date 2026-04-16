import fs from "node:fs";

/** 파일 끝에서 최대 maxLines 줄 (UTF-8) */
export function readLogTail(filePath: string, maxLines = 400): string {
  try {
    if (!fs.existsSync(filePath)) return "";
    const raw = fs.readFileSync(filePath, "utf8");
    const lines = raw.split(/\r?\n/);
    if (lines.length <= maxLines) return raw.trimEnd();
    return lines.slice(-maxLines).join("\n").trimEnd();
  } catch {
    return "";
  }
}
