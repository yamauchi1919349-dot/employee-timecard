import { createClient } from "@supabase/supabase-js";

export type TenantRole = "owner" | "manager" | "staff" | "admin";
export type EmploymentType = "full_time" | "part_time" | "contract" | "other";

export type AuthProfile = {
  id: string;
  user_id: string;
  company_id: string;
  store_id: string | null;
  name: string;
  email: string | null;
  role: TenantRole;
  employment_type: EmploymentType | null;
  hourly_wage: number | null;
  fixed_salary: number | null;
  active: boolean;
  created_at: string;
};

export function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase environment variables are missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function createSupabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    if (typeof window === "undefined") {
      return createClient("https://example.supabase.co", "build-placeholder-anon-key");
    }

    throw new Error(
      "Supabase browser environment variables are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return createClient(url, anonKey);
}

export function isLegacyKeyAccessAllowed() {
  return process.env.ENABLE_LEGACY_KEY_ACCESS !== "false";
}

export function assertLegacyKeyAccessAllowed() {
  if (!isLegacyKeyAccessAllowed()) {
    throw new Error("販売版ではログインが必要です。");
  }
}

export async function getAuthenticatedProfile(request: Request) {
  const token = getBearerToken(request);
  if (!token) return null;

  const supabase = createSupabaseAdmin();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id,user_id,company_id,store_id,name,email,role,employment_type,hourly_wage,fixed_salary,active,created_at")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle<AuthProfile>();

  if (error) {
    throw new Error(`profiles lookup failed: ${error.message}`);
  }

  return data;
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

