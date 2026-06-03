const RESERVED_MEMBER_KEYS = new Set([
  "admin",
  "api",
  "dashboard",
  "favicon.ico",
  "forgot-password",
  "icon.png",
  "login",
  "manifest.json",
  "reset-password",
]);

export function isReservedMemberKey(value?: string | null) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase().replace(/^\/+|\/+$/g, "");
  const firstSegment = normalized.split("/")[0];
  return RESERVED_MEMBER_KEYS.has(firstSegment);
}
