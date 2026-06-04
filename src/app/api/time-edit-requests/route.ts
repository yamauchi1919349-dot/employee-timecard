import { NextResponse } from "next/server";
import { parseDateTimeLocal, TIME_EDIT_REQUEST_TYPES, normalizeRole } from "@/lib/time-edit";
import { createSupabaseAdmin, getAuthenticatedProfile } from "@/lib/supabase";
import { TimeEditRequestType } from "@/lib/types";

type RequestBody = {
  targetDate?: string;
  requestType?: TimeEditRequestType;
  requestedClockIn?: string | null;
  requestedClockOut?: string | null;
  requestedBreakMinutes?: number | string | null;
  reason?: string;
};

type SupabaseLikeError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

const REQUEST_SELECT =
  "*, profiles:profiles!time_edit_requests_profile_id_fkey(name,email,role), attendance:attendance!time_edit_requests_attendance_id_fkey(id,clock_in,clock_out,break_minutes,work_type)";

export async function GET(request: Request) {
  try {
    const profile = await getAuthenticatedProfile(request);
    if (!profile) return NextResponse.json({ message: "ログインが必要です。" }, { status: 401 });

    const role = normalizeRole(profile.role);
    const supabase = createSupabaseAdmin();
    let query = supabase
      .from("time_edit_requests")
      .select(REQUEST_SELECT)
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false });

    if (role === "staff") {
      query = query.eq("profile_id", profile.id);
    } else if (role !== "owner") {
      return NextResponse.json({ message: "打刻修正依頼を表示する権限がありません。" }, { status: 403 });
    }

    const { data, error } = await query;
    if (error) {
      return supabaseErrorResponse("time_edit_requests_select_failed", "打刻修正依頼の取得に失敗しました。", error, 500);
    }

    return NextResponse.json({ requests: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "打刻修正依頼の取得に失敗しました。", error: "unexpected_error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const profile = await getAuthenticatedProfile(request);
    if (!profile) {
      return NextResponse.json(
        { message: "ログイン中のstaff profileを取得できませんでした。", error: "authenticated_profile_not_found" },
        { status: 401 },
      );
    }

    const role = normalizeRole(profile.role);
    if (role !== "staff") {
      return NextResponse.json({ message: "staffのみ修正依頼を作成できます。", error: "forbidden_role" }, { status: 403 });
    }

    const body = (await request.json()) as RequestBody;
    const targetDate = body.targetDate?.trim();
    const reason = body.reason?.trim();
    const requestType = body.requestType;

    if (!targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      return NextResponse.json({ message: "対象日を指定してください。", error: "invalid_target_date" }, { status: 400 });
    }
    if (!requestType || !TIME_EDIT_REQUEST_TYPES.includes(requestType)) {
      return NextResponse.json({ message: "修正種別を指定してください。", error: "invalid_request_type" }, { status: 400 });
    }
    if (!reason) {
      return NextResponse.json({ message: "理由を入力してください。", error: "missing_reason" }, { status: 400 });
    }

    const requestedBreakMinutes = normalizeBreakMinutes(body.requestedBreakMinutes);
    if (requestedBreakMinutes instanceof NextResponse) return requestedBreakMinutes;

    const supabase = createSupabaseAdmin();
    const { data: attendance, error: attendanceError } = await supabase
      .from("attendance")
      .select("id")
      .eq("company_id", profile.company_id)
      .eq("profile_id", profile.id)
      .eq("work_date", targetDate)
      .limit(1)
      .maybeSingle();

    if (attendanceError) {
      return supabaseErrorResponse("attendance_lookup_failed", "対象日の勤怠確認に失敗しました。", attendanceError);
    }

    const payload = {
      company_id: profile.company_id,
      profile_id: profile.id,
      attendance_id: attendance?.id ?? null,
      target_date: targetDate,
      request_type: requestType,
      requested_clock_in: parseDateTimeLocal(targetDate, body.requestedClockIn),
      requested_clock_out: parseDateTimeLocal(targetDate, body.requestedClockOut),
      requested_break_minutes: requestedBreakMinutes,
      reason,
      status: "pending",
    };

    const { data, error } = await supabase
      .from("time_edit_requests")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      return supabaseErrorResponse("time_edit_request_insert_failed", "打刻修正依頼の保存に失敗しました。", error);
    }

    return NextResponse.json({ request: data });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "打刻修正依頼の送信に失敗しました。",
        error: "unexpected_error",
      },
      { status: 400 },
    );
  }
}

function normalizeBreakMinutes(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const minutes = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 240) {
    return NextResponse.json(
      { message: "希望休憩時間は0分以上240分以内で指定してください。", error: "invalid_break_minutes" },
      { status: 400 },
    );
  }
  return minutes;
}

function supabaseErrorResponse(code: string, message: string, error: SupabaseLikeError, status = 400) {
  return NextResponse.json(
    {
      message,
      error: code,
      detail: error.message,
      supabaseCode: error.code,
      supabaseDetails: error.details,
      supabaseHint: error.hint,
    },
    { status },
  );
}
