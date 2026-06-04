import { NextResponse } from "next/server";
import { normalizeRole } from "@/lib/time-edit";
import { createSupabaseAdmin, getAuthenticatedProfile } from "@/lib/supabase";

export async function GET(request: Request) {
  try {
    const profile = await getAuthenticatedProfile(request);
    if (!profile) return NextResponse.json({ message: "ログインが必要です。" }, { status: 401 });
    if (normalizeRole(profile.role) !== "staff") {
      return NextResponse.json({ message: "通知はstaffのみ表示できます。" }, { status: 403 });
    }

    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("app_notifications")
      .select("*")
      .eq("company_id", profile.company_id)
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    return NextResponse.json({ notifications: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "通知の取得に失敗しました。" },
      { status: 500 },
    );
  }
}
