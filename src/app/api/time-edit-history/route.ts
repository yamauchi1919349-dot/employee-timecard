import { NextResponse } from "next/server";
import { getEffectiveTenantRole } from "@/lib/developer-mode";
import { createSupabaseAdmin, getAuthenticatedProfile } from "@/lib/supabase";

const HISTORY_SELECT = "*, profiles!time_edit_histories_profile_id_fkey(name,email,role), editor:profiles!time_edit_histories_edited_by_profile_id_fkey(name,email,role)";

export async function GET(request: Request) {
  try {
    const profile = await getAuthenticatedProfile(request);
    if (!profile) return NextResponse.json({ message: "ログインが必要です。" }, { status: 401 });

    const role = getEffectiveTenantRole(profile);
    const supabase = createSupabaseAdmin();
    let query = supabase
      .from("time_edit_histories")
      .select(HISTORY_SELECT)
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false });

    if (role === "staff") {
      query = query.eq("profile_id", profile.id);
    } else if (role !== "owner") {
      return NextResponse.json({ message: "修正履歴を表示する権限がありません。" }, { status: 403 });
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ histories: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "修正履歴の取得に失敗しました。" },
      { status: 500 },
    );
  }
}
