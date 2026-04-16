/**
 * Windows에서 Electron/Node가 콘솔에 UTF-8을 쓸 때 글자가 깨지지 않도록
 * 가장 먼저 코드 페이지를 UTF-8(65001)로 맞춥니다.
 * (그 다음에 main.mjs 로드)
 */
import { execSync } from "node:child_process";

if (process.platform === "win32") {
  try {
    execSync("cmd /c chcp 65001 >nul 2>&1", { stdio: "ignore" });
  } catch {
    /* 무시 */
  }
}

await import("./main.mjs");
