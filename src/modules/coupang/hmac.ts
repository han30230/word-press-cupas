import crypto from "node:crypto";

/**
 * Coupang Partners Open API signed-date (GMT, YYMMDDTHHMMSSZ)
 */
export function getSignedDate(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const yy = String(now.getUTCFullYear()).slice(2);
  const MM = pad(now.getUTCMonth() + 1);
  const dd = pad(now.getUTCDate());
  const hh = pad(now.getUTCHours());
  const mm = pad(now.getUTCMinutes());
  const ss = pad(now.getUTCSeconds());
  return `${yy}${MM}${dd}T${hh}${mm}${ss}Z`;
}

/**
 * message = signedDate + method + path + queryString (query는 '?' 없이)
 * Authorization: CEA algorithm=HmacSHA256, access-key=..., signed-date=..., signature=...
 */
export function buildAuthorizationHeader(
  method: string,
  path: string,
  queryString: string,
  secretKey: string,
  accessKey: string,
  signedDate: string,
): string {
  const message = `${signedDate}${method}${path}${queryString}`;
  const signature = crypto.createHmac("sha256", secretKey).update(message, "utf8").digest("hex");
  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${signedDate}, signature=${signature}`;
}
