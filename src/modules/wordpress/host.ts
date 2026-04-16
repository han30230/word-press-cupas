/** *.wordpress.com 또는 wordpress.com 호스트 */
export function isWordPressComSite(baseUrl: string): boolean {
  try {
    const url = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;
    const h = new URL(url).hostname.toLowerCase();
    return h === "wordpress.com" || h.endsWith(".wordpress.com");
  } catch {
    return false;
  }
}

export function wpComSiteHostname(baseUrl: string): string {
  const url = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;
  return new URL(url).hostname;
}
