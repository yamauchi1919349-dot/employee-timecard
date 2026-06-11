import { NextResponse } from "next/server";
import { getBusinessDate } from "@/lib/attendance";
import { requireActiveCompanySubscription } from "@/lib/billing-access";
import { createSupabaseAdmin, getAuthenticatedProfile } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      breakMinutes?: number;
    };
    const profile = await getAuthenticatedProfile(request);
    if (!profile) {
      return NextResponse.json({ message: "ログインが必要です。" }, { status: 401 });
    }
    const billingRestriction = await requireActiveCompanySubscription(profile);
    if (billingRestriction) return billingRestriction;

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
    if (!existing?.clock_in) {
      return NextResponse.json({ message: "出勤記録がありません。" }, { status: 400 });
    }
    if (existing.clock_out) {
      return NextResponse.json({ message: "すでに退勤済みです。" }, { status: 400 });
    }

    const breakMinutes =
      typeof body.breakMinutes === "number" && body.breakMinutes >= 0 && body.breakMinutes <= 240
        ? body.breakMinutes
        : existing.break_minutes;

    const { data, error } = await supabase
      .from("attendance")
      .update({ clock_out: new Date().toISOString(), break_minutes: breakMinutes })
      .eq("id", existing.id)
      .eq("company_id", profile.company_id)
      .eq("user_id", profile.user_id)
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ attendance: data });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "退勤処理に失敗しました。" },
      { status: 400 },
    );
  }
}
