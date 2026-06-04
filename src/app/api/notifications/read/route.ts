import { NextResponse } from "next/server";
import { normalizeRole } from "@/lib/time-edit";
import { createSupabaseAdmin, getAuthenticatedProfile } from "@/lib/supabase";

export async function PATCH(request: Request) {
  try {
    const profile = await getAuthenticatedProfile(request);
    if (!profile) return NextResponse.json({ message: "ログインが必要です。" }, { status: 401 });
    if (normalizeRole(profile.role) !== "staff") {
      return NextResponse.json({ message: "通知はstaffのみ更新できます。" }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as { id?: string };
    const id = body.id?.trim();
    if (!id) return NextResponse.json({ message: "通知IDを指定してください。" }, { status: 400 });

    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("app_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("company_id", profile.company_id)
      .eq("profile_id", profile.id)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ message: "通知が見つかりません。" }, { status: 404 });
    return NextResponse.json({ notification: data });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "通知の既読処理に失敗しました。" },
      { status: 500 },
    );
  }
}
