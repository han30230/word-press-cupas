import axios, { type AxiosInstance } from "axios";

/** 자체 호스팅 / 플러그인 Jetpack 등: Basic Auth + /wp-json/wp/v2 */
export function createWpClient(
  baseUrl: string,
  username: string,
  applicationPassword: string,
): AxiosInstance {
  return axios.create({
    baseURL: `${baseUrl.replace(/\/+$/, "")}/wp-json/wp/v2`,
    auth: {
      username,
      password: applicationPassword,
    },
    timeout: 60_000,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

/**
 * WordPress.com 호스팅: Bearer 토큰 + public-api.wordpress.com/wp/v2/sites/{도메인}
 */
export function createWpComClient(siteHostname: string, accessToken: string): AxiosInstance {
  const host = siteHostname.replace(/^https?:\/\//, "").split("/")[0];
  return axios.create({
    baseURL: `https://public-api.wordpress.com/wp/v2/sites/${encodeURIComponent(host)}`,
    timeout: 60_000,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
}
