import type { AuthProfile } from "@/lib/supabase";

export function isDeveloperProfile(profile: Pick<AuthProfile, "is_developer" | "auth_email"> | null | undefined) {
  const developerEmail = process.env.DEVELOPER_EMAIL?.trim().toLowerCase();
  const userEmail = profile?.auth_email?.trim().toLowerCase();

  return profile?.is_developer === true && Boolean(developerEmail) && userEmail === developerEmail;
}

export function getEffectiveTenantRole(profile: Pick<AuthProfile, "role" | "is_developer" | "auth_email"> | null | undefined) {
  if (isDeveloperProfile(profile)) return "owner";
  return profile?.role?.trim().toLowerCase() ?? "";
}
