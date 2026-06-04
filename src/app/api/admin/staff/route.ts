import { NextResponse } from "next/server";
import { createSupabaseAdmin, getAuthenticatedProfile } from "@/lib/supabase";

export async function GET(request: Request) {
  try {
    const profile = await getAuthenticatedProfile(request);
    if (!profile) {
      return NextResponse.json({ message: "ログインが必要です。" }, { status: 401 });
    }
    const role = profile.role?.trim().toLowerCase();
    if (!["owner", "manager", "admin"].includes(role)) {
      return NextResponse.json({ message: "スタッフ一覧を表示する権限がありません。" }, { status: 403 });
    }

    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("profiles")
      .select("id,user_id,company_id,store_id,name,email,role,created_at")
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ staff: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "スタッフ一覧の取得に失敗しました。" },
      { status: 500 },
    );
  }
}
