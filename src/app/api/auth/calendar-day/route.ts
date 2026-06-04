import { NextResponse } from "next/server";
import { createSupabaseAdmin, getAuthenticatedProfile } from "@/lib/supabase";

type CalendarDayBody = {
  date?: string;
};

export async function POST(request: Request) {
  try {
    const profile = await getAuthenticatedProfile(request);
    if (!profile) {
      return NextResponse.json({ message: "ログインが必要です。" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as CalendarDayBody;
    const date = body.date?.trim();
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ message: "日付の指定が正しくありません。" }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { data: existing, error: existingError } = await supabase
      .from("attendance")
      .select("*")
      .eq("company_id", profile.company_id)
      .eq("user_id", profile.user_id)
      .eq("work_date", date)
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing?.day_type === "holiday") {
      if (!existing.clock_in && !existing.clock_out) {
        const { error } = await supabase
          .from("attendance")
          .delete()
          .eq("id", existing.id)
          .eq("company_id", profile.company_id)
          .eq("user_id", profile.user_id);
        if (error) throw error;
        return NextResponse.json({ attendance: null, message: `${date}を通常日に戻しました。` });
      }

      const { data, error } = await supabase
        .from("attendance")
        .update({ day_type: "workday" })
        .eq("id", existing.id)
        .eq("company_id", profile.company_id)
        .eq("user_id", profile.user_id)
        .select("*")
        .single();
      if (error) throw error;
      return NextResponse.json({ attendance: data, message: `${date}を通常日に戻しました。` });
    }

    const payload = {
      company_id: profile.company_id,
      user_id: profile.user_id,
      profile_id: profile.id,
      store_id: profile.store_id,
      work_date: date,
      work_type: existing?.work_type ?? "normal",
      break_minutes: existing?.break_minutes ?? 60,
      day_type: "holiday",
    };

    const query = existing
      ? supabase.from("attendance").update(payload).eq("id", existing.id)
      : supabase.from("attendance").insert(payload);
    const { data, error } = await query.select("*").single();

    if (error) throw error;
    return NextResponse.json({ attendance: data, message: `${date}を休日に設定しました。` });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "休日設定に失敗しました。" },
      { status: 400 },
    );
  }
}
