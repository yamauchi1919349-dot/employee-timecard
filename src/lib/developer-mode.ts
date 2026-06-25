import { createSupabaseAdmin, type AuthProfile } from "@/lib/supabase";

type DeveloperProfile = Pick<AuthProfile, "company_id" | "email" | "role" | "is_developer" | "auth_email">;

export function isDeveloperProfile(
  profile: Pick<AuthProfile, "role" | "is_developer" | "auth_email"> | null | undefined,
) {
  const developerEmail = process.env.DEVELOPER_EMAIL?.trim().toLowerCase();
  const userEmail = profile?.auth_email?.trim().toLowerCase();
  const role = profile?.role?.trim().toLowerCase();

  return profile?.is_developer === true && role === "owner" && Boolean(developerEmail) && userEmail === developerEmail;
}

export function getEffectiveTenantRole(profile: Pick<AuthProfile, "role" | "is_developer" | "auth_email"> | null | undefined) {
  if (isDeveloperProfile(profile)) return "owner";
  return profile?.role?.trim().toLowerCase() ?? "";
}

export async function isDeveloperCompanyProfile(
  profile: DeveloperProfile | null | undefined,
  supabase = createSupabaseAdmin(),
) {
  if (!profile) return false;
  if (isDeveloperProfile(profile)) return true;

  const developerEmail = process.env.DEVELOPER_EMAIL?.trim().toLowerCase();
  if (!developerEmail || !profile.company_id) return false;

  const { data, error } = await supabase
    .from("profiles")
    .select("id,user_id,company_id,email,role,is_developer")
    .eq("company_id", profile.company_id)
    .eq("role", "owner")
    .eq("is_developer", true)
    .eq("active", true);

  if (error) throw error;

  for (const ownerProfile of data ?? []) {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.admin.getUserById(ownerProfile.user_id);

    if (userError) throw userError;
    if (user?.email?.trim().toLowerCase() === developerEmail) return true;
  }

  return false;
}
