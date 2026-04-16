import axios, { type AxiosInstance } from "axios";
import { buildAuthorizationHeader, getSignedDate } from "./hmac.js";

const COUPANG_HOST = "https://api-gateway.coupang.com";

export function createCoupangAxios(
  accessKey: string,
  secretKey: string,
): AxiosInstance {
  const instance = axios.create({
    baseURL: COUPANG_HOST,
    timeout: 30_000,
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
    },
  });

  instance.interceptors.request.use((config) => {
    const method = (config.method ?? "GET").toUpperCase();
    const urlPath = typeof config.url === "string" ? config.url : "";
    const fullPath = urlPath.startsWith("/") ? urlPath : `/${urlPath}`;
    const [pathOnly, qs] = fullPath.split("?");
    const queryString = qs ?? "";
    const signedDate = getSignedDate();
    const authorization = buildAuthorizationHeader(
      method,
      pathOnly,
      queryString,
      secretKey,
      accessKey,
      signedDate,
    );
    config.headers = config.headers ?? {};
    config.headers.Authorization = authorization;
    return config;
  });

  return instance;
}
