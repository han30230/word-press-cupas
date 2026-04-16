import { execSync } from "node:child_process";

let applied = false;

/** Windows CMD/PowerShell에서 한글 로그가 깨질 때 UTF-8 코드 페이지로 전환 */
export function ensureWindowsConsoleUtf8(): void {
  if (applied || process.platform !== "win32") return;
  applied = true;
  try {
    execSync("cmd /c chcp 65001 >nul 2>&1", { stdio: "ignore" });
  } catch {
    /* 무시 */
  }
}
