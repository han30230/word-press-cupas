import type { AxiosInstance } from "axios";
import type { AppEnv } from "../../config/env.js";
import { createWpClient, createWpComClient } from "./client.js";
import { isWordPressComSite, wpComSiteHostname } from "./host.js";
import { fetchWpComAccessToken } from "./wpcomAuth.js";

export { isWordPressComSite };

export async function createWordPressHttpClient(env: AppEnv): Promise<AxiosInstance> {
  if (!env.wpEnabled) {
    throw new Error("WordPress가 비활성화되어 있습니다.");
  }

  if (isWordPressComSite(env.wpBaseUrl)) {
    const token = await fetchWpComAccessToken({
      clientId: env.wpcomClientId,
      clientSecret: env.wpcomClientSecret,
      username: env.wpUsername,
      password: env.wpApplicationPassword,
    });
    const host = wpComSiteHostname(env.wpBaseUrl);
    return createWpComClient(host, token);
  }

  return createWpClient(env.wpBaseUrl, env.wpUsername, env.wpApplicationPassword);
}
