/**
 * WordPress REST 인증만 확인합니다 (쿠팡/OpenAI 불필요).
 * 사용: npm run test:wp
 */
import dotenv from "dotenv";
import path from "node:path";
import axios from "axios";
import { appRootDir } from "../utils/appRoot.js";

dotenv.config({ path: path.join(appRootDir(), ".env") });
dotenv.config();
import { isWordPressComSite, wpComSiteHostname } from "../modules/wordpress/host.js";
import { fetchWpComAccessToken } from "../modules/wordpress/wpcomAuth.js";

async function main(): Promise<void> {
  const baseUrl = process.env.WP_BASE_URL?.replace(/\/+$/, "").trim();
  const username = process.env.WP_USERNAME?.trim();
  const password = process.env.WP_APPLICATION_PASSWORD?.trim();

  if (!baseUrl || !username || !password) {
    console.error(
      ".env에 다음을 모두 채워 주세요: WP_BASE_URL, WP_USERNAME, WP_APPLICATION_PASSWORD",
    );
    process.exit(1);
  }

  if (isWordPressComSite(baseUrl)) {
    const clientId = process.env.WPCOM_CLIENT_ID?.trim();
    const clientSecret = process.env.WPCOM_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      console.error(
        "WordPress.com은 WPCOM_CLIENT_ID, WPCOM_CLIENT_SECRET 이 필요합니다.\n" +
          "https://developer.wordpress.com/apps/ 에서 앱을 만든 뒤 .env에 넣으세요.",
      );
      process.exit(1);
    }

    const token = await fetchWpComAccessToken({
      clientId,
      clientSecret,
      username,
      password,
    });

    const res = await axios.get<{ ID?: number; display_name?: string; username?: string }>(
      "https://public-api.wordpress.com/rest/v1.1/me",
      {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true,
      },
    );

    if (res.status !== 200) {
      console.error("WordPress.com /me 실패:", res.status, res.data);
      process.exit(1);
    }

    console.log("WordPress.com 연결 OK (OAuth 토큰)");
    console.log(`  사이트: ${wpComSiteHostname(baseUrl)}`);
    console.log(`  계정: ${res.data.display_name ?? res.data.username ?? "?"} (ID: ${res.data.ID ?? "?"})`);
    return;
  }

  const client = axios.create({
    baseURL: `${baseUrl}/wp-json/wp/v2`,
    auth: { username, password },
    timeout: 30_000,
    headers: { Accept: "application/json" },
    validateStatus: () => true,
  });

  const res = await client.get<{ id?: number; name?: string; slug?: string }>("/users/me");

  if (res.status !== 200) {
    console.error("WordPress 인증 실패:", res.status, res.data);
    process.exit(1);
  }

  const u = res.data;
  console.log("WordPress 연결 OK (자체 호스팅 /wp-json)");
  console.log(`  사용자: ${u.name ?? u.slug ?? "?"} (id: ${u.id ?? "?"})`);
}

void main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
