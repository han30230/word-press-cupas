import path from "node:path";
import { isWordPressComSite } from "../modules/wordpress/host.js";
import type { AppEnv, WpPostStatus } from "./env.js";
import type { AccountConfig, GlobalConfig } from "./appConfig.js";
import { appRootDir } from "../utils/appRoot.js";

function resolvePath(p: string): string {
  if (path.isAbsolute(p)) return p;
  return path.resolve(appRootDir(), p);
}

export function resolveEnvForAccount(global: GlobalConfig, account: AccountConfig): AppEnv {
  const wpBaseUrl = account.wpBaseUrl.replace(/\/+$/, "");
  const wpUsername = account.wpUsername.trim();
  const wpApplicationPassword = account.wpApplicationPassword.trim();
  const wpEnabled = Boolean(wpBaseUrl && wpUsername && wpApplicationPassword);
  const wpcomClientId = account.wpcomClientId.trim();
  const wpcomClientSecret = account.wpcomClientSecret.trim();

  if (wpEnabled && isWordPressComSite(wpBaseUrl)) {
    if (!wpcomClientId || !wpcomClientSecret) {
      throw new Error(
        `계정 "${account.name}": WordPress.com 은 WPCOM_CLIENT_ID / SECRET 이 필요합니다.`,
      );
    }
  }

  const wpStatus = account.wpPostStatus as WpPostStatus;
  if (wpStatus !== "draft" && wpStatus !== "publish") {
    throw new Error(`계정 "${account.name}": wpPostStatus 오류`);
  }

  const minP = global.minProducts;
  const maxP = global.maxProducts;
  if (minP < 1 || maxP < minP || maxP > 10) {
    throw new Error("minProducts/maxProducts 범위 오류");
  }

  return {
    coupangAccessKey: global.coupangAccessKey,
    coupangSecretKey: global.coupangSecretKey,
    coupangSubId: global.coupangSubId,
    openaiApiKey: global.openaiApiKey,
    openaiModel: global.openaiModel,
    wpEnabled,
    wpBaseUrl,
    wpUsername,
    wpApplicationPassword,
    wpcomClientId,
    wpcomClientSecret,
    wpPostStatus: wpStatus,
    keywordsFile: resolvePath(account.keywordsFile),
    publishedStateFile: resolvePath(account.publishedStateFile),
    minProducts: minP,
    maxProducts: maxP,
    logFile: resolvePath(account.logFile),
    outputDir: resolvePath(account.outputDir),
    cronSchedule: "0 9 * * *",
    accountId: account.id,
    accountName: account.name,
  };
}
