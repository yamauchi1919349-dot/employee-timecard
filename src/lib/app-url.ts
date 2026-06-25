const LOCAL_APP_URL = "http://localhost:3000";

export function getAppBaseUrl() {
  return normalizeAppUrl(process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? LOCAL_APP_URL);
}

function normalizeAppUrl(value: string) {
  const url = value.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("APP_URL or NEXT_PUBLIC_APP_URL must be an absolute http or https URL.");
  }
  return url;
}
