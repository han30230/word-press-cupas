import axios from "axios";

interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

/**
 * WordPress.com OAuth2 — Password Grant (개발/본인 계정용).
 * @see https://developer.wordpress.com/docs/oauth2/
 */
export async function fetchWpComAccessToken(params: {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
}): Promise<string> {
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    grant_type: "password",
    username: params.username,
    password: params.password,
  });

  const res = await axios.post<TokenResponse>(
    "https://public-api.wordpress.com/oauth2/token",
    body.toString(),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 45_000,
      validateStatus: () => true,
    },
  );

  if (res.status !== 200 || !res.data.access_token) {
    const msg =
      res.data.error_description ??
      res.data.error ??
      (typeof res.data === "object" ? JSON.stringify(res.data) : String(res.data));
    const hint =
      /two step|application-specific|application specific/i.test(String(msg))
        ? "\n\n[해결] 2단계 인증이 켜져 있으면 로그인 비밀번호가 아니라, WordPress.com 계정에서 발급한 「애플리케이션 비밀번호」를 써야 합니다.\n" +
          "  https://wordpress.com/me/security → Two-Step Authentication → Application passwords → 새 비밀번호 생성 후,\n" +
          "  그 16자리를 .env 의 WP_APPLICATION_PASSWORD 에 넣으세요."
        : "";
    throw new Error(`WordPress.com 토큰 발급 실패 (HTTP ${res.status}): ${msg}${hint}`);
  }

  return res.data.access_token;
}
