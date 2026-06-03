import { NextResponse } from "next/server";
import { getBusinessDate } from "@/lib/attendance";
import { createSupabaseAdmin, getAuthenticatedProfile } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const profile = await getAuthenticatedProfile(request);
    if (!profile) {
      return NextResponse.json({ message: "ログインが必要です。" }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();
    const workDate = getBusinessDate();
    const { data: existing, error: existingError } = await supabase
      .from("attendance")
      .select("*")
      .eq("company_id", profile.company_id)
      .eq("user_id", profile.user_id)
      .eq("work_date", workDate)
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing?.clock_in && !existing.clock_out) {
      return NextResponse.json({ message: "すでに出勤中です。" }, { status: 400 });
    }

    const payload = {
      company_id: profile.company_id,
      user_id: profile.user_id,
      profile_id: profile.id,
      store_id: profile.store_id,
      work_date: workDate,
      clock_in: new Date().toISOString(),
      clock_out: null,
    };

    const query = existing
      ? supabase.from("attendance").update(payload).eq("id", existing.id)
      : supabase.from("attendance").insert(payload);
    const { data, error } = await query.select("*").single();

    if (error) throw error;
    return NextResponse.json({ attendance: data });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "出勤処理に失敗しました。" },
      { status: 400 },
    );
  }
}
