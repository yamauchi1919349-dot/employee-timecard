import { NextResponse } from "next/server";
import { requireActiveCompanySubscription } from "@/lib/billing-access";
import { parseDateTimeLocal, SALES_WORK_TYPES, normalizeRole } from "@/lib/time-edit";
import { createSupabaseAdmin, getAuthenticatedProfile } from "@/lib/supabase";
import { Attendance, SalesWorkType } from "@/lib/types";

type DirectBody = {
  profileId?: string;
  targetDate?: string;
  clockIn?: string | null;
  clockOut?: string | null;
  breakMinutes?: number | string;
  workType?: SalesWorkType;
  reason?: string;
};

export async function POST(request: Request) {
  try {
    const owner = await getAuthenticatedProfile(request);
    if (!owner) return NextResponse.json({ message: "ログインが必要です。" }, { status: 401 });
    if (normalizeRole(owner.role) !== "owner") {
      return NextResponse.json({ message: "owner権限が必要です。" }, { status: 403 });
    }
    const billingRestriction = await requireActiveCompanySubscription(owner);
    if (billingRestriction) return billingRestriction;

    const body = (await request.json()) as DirectBody;
    const profileId = body.profileId?.trim();
    const targetDate = body.targetDate?.trim();
    const reason = body.reason?.trim();
    if (!profileId || !targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      return NextResponse.json({ message: "対象スタッフと対象日を指定してください。" }, { status: 400 });
    }
    if (!reason) return NextResponse.json({ message: "直接修正には理由が必要です。" }, { status: 400 });

    const breakMinutes = Number(body.breakMinutes);
    if (!Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes > 240) {
      return NextResponse.json({ message: "休憩時間は0分以上240分以内で指定してください。" }, { status: 400 });
    }
    const workType = SALES_WORK_TYPES.includes(body.workType ?? "normal") ? body.workType ?? "normal" : "normal";

    const supabase = createSupabaseAdmin();
    const { data: staffProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id,user_id,company_id,store_id,name")
      .eq("id", profileId)
      .eq("company_id", owner.company_id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!staffProfile) return NextResponse.json({ message: "対象スタッフが見つかりません。" }, { status: 404 });

    const { data: existing, error: existingError } = await supabase
      .from("attendance")
      .select("*")
      .eq("company_id", owner.company_id)
      .eq("profile_id", staffProfile.id)
      .eq("work_date", targetDate)
      .limit(1)
      .maybeSingle<Attendance>();
    if (existingError) throw existingError;

    const payload = {
      company_id: owner.company_id,
      user_id: staffProfile.user_id,
      profile_id: staffProfile.id,
      store_id: staffProfile.store_id,
      work_date: targetDate,
      day_type: existing?.day_type ?? "workday",
      clock_in: parseDateTimeLocal(targetDate, body.clockIn),
      clock_out: parseDateTimeLocal(targetDate, body.clockOut),
      break_minutes: breakMinutes,
      work_type: workType,
    };

    const query = existing
      ? supabase.from("attendance").update(payload).eq("id", existing.id)
      : supabase.from("attendance").insert(payload);
    const { data: attendance, error: writeError } = await query.select("*").single<Attendance>();
    if (writeError) throw writeError;

    const { data: history, error: historyError } = await supabase
      .from("time_edit_histories")
      .insert({
        company_id: owner.company_id,
        attendance_id: attendance.id,
        profile_id: staffProfile.id,
        edited_by_profile_id: owner.id,
        request_id: null,
        edit_type: "direct",
        before_clock_in: existing?.clock_in ?? null,
        before_clock_out: existing?.clock_out ?? null,
        before_break_minutes: existing?.break_minutes ?? null,
        before_work_type: existing?.work_type ?? null,
        after_clock_in: attendance.clock_in,
        after_clock_out: attendance.clock_out,
        after_break_minutes: attendance.break_minutes,
        after_work_type: attendance.work_type,
        reason,
        owner_comment: null,
        source: "direct",
      })
      .select("*")
      .single();
    if (historyError) throw historyError;

    const { error: notificationError } = await supabase.from("app_notifications").insert({
      company_id: owner.company_id,
      profile_id: staffProfile.id,
      title: "打刻が修正されました",
      body: `${targetDate} の打刻をownerが修正しました。`,
      type: "time_edit_direct",
      related_history_id: history.id,
    });
    if (notificationError) throw notificationError;

    return NextResponse.json({ attendance, history });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "打刻の直接修正に失敗しました。" },
      { status: 500 },
    );
  }
}
