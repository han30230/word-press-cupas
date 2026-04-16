import path from "node:path";

/**
 * Electron 메인에서 APP_ROOT 설정 → .env·data 위치
 * pkg exe일 때는 실행 파일 폴더, 그 외 cwd
 */
export function appRootDir(): string {
  if (process.env.APP_ROOT?.trim()) {
    return path.resolve(process.env.APP_ROOT.trim());
  }
  const proc = process as NodeJS.Process & { pkg?: unknown };
  if (proc.pkg !== undefined) {
    return path.dirname(process.execPath);
  }
  return process.cwd();
}
