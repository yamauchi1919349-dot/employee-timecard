import { NextResponse } from "next/server";
import { getRequestTypeLabel, normalizeRole } from "@/lib/time-edit";
import { createSupabaseAdmin, getAuthenticatedProfile } from "@/lib/supabase";
import { Attendance } from "@/lib/types";

const REQUEST_SELECT =
  "*, profiles:profiles!time_edit_requests_profile_id_fkey(name,email,role), attendance:attendance!time_edit_requests_attendance_id_fkey(id,clock_in,clock_out,break_minutes,work_type,work_date)";

type ReviewBody = {
  id?: string;
  action?: "approve" | "reject";
  ownerComment?: string;
};

export async function GET(request: Request) {
  try {
    const owner = await requireOwner(request);
    if (owner instanceof NextResponse) return owner;

    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("time_edit_requests")
      .select(REQUEST_SELECT)
      .eq("company_id", owner.company_id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ requests: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "打刻修正依頼の取得に失敗しました。" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const owner = await requireOwner(request);
    if (owner instanceof NextResponse) return owner;

    const body = (await request.json()) as ReviewBody;
    const requestId = body.id?.trim();
    if (!requestId || (body.action !== "approve" && body.action !== "reject")) {
      return NextResponse.json({ message: "処理対象と操作を指定してください。" }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { data: editRequest, error: requestError } = await supabase
      .from("time_edit_requests")
      .select("*")
      .eq("id", requestId)
      .eq("company_id", owner.company_id)
      .maybeSingle();
    if (requestError) throw requestError;
    if (!editRequest) return NextResponse.json({ message: "修正依頼が見つかりません。" }, { status: 404 });
    if (editRequest.status !== "pending") {
      return NextResponse.json({ message: "処理済みの修正依頼です。" }, { status: 400 });
    }

    if (body.action === "reject") {
      const { data, error } = await supabase
        .from("time_edit_requests")
        .update({
          status: "rejected",
          owner_comment: body.ownerComment?.trim() || null,
          reviewed_by_profile_id: owner.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", editRequest.id)
        .select(REQUEST_SELECT)
        .single();
      if (error) throw error;
      await createNotification(supabase, {
        companyId: owner.company_id,
        profileId: editRequest.profile_id,
        title: "打刻修正依頼が却下されました",
        body: body.ownerComment?.trim() || "申請内容を確認してください。",
        type: "time_edit_rejected",
        requestId: editRequest.id,
      });
      return NextResponse.json({ request: data });
    }

    const { data: staffProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id,user_id,company_id,store_id")
      .eq("id", editRequest.profile_id)
      .eq("company_id", owner.company_id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!staffProfile) return NextResponse.json({ message: "対象スタッフが見つかりません。" }, { status: 404 });

    const { attendance, history } = await applyAttendanceEdit(supabase, {
      companyId: owner.company_id,
      staffProfile,
      editorProfileId: owner.id,
      targetDate: editRequest.target_date,
      requestId: editRequest.id,
      editType: editRequest.request_type,
      reason: editRequest.reason,
      ownerComment: body.ownerComment?.trim() || null,
      source: "request",
      nextClockIn: editRequest.requested_clock_in,
      nextClockOut: editRequest.requested_clock_out,
      nextBreakMinutes: editRequest.requested_break_minutes,
      nextWorkType: null,
    });

    const { data, error } = await supabase
      .from("time_edit_requests")
      .update({
        status: "approved",
        attendance_id: attendance.id,
        owner_comment: body.ownerComment?.trim() || null,
        reviewed_by_profile_id: owner.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", editRequest.id)
      .select(REQUEST_SELECT)
      .single();
    if (error) throw error;

    await createNotification(supabase, {
      companyId: owner.company_id,
      profileId: editRequest.profile_id,
      title: "打刻修正依頼が承認されました",
      body: `${editRequest.target_date} の${getRequestTypeLabel(editRequest.request_type)}が承認されました。`,
      type: "time_edit_approved",
      requestId: editRequest.id,
      historyId: history.id,
    });

    return NextResponse.json({ request: data, attendance, history });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "打刻修正依頼の処理に失敗しました。" },
      { status: 500 },
    );
  }
}

async function requireOwner(request: Request) {
  const profile = await getAuthenticatedProfile(request);
  if (!profile) return NextResponse.json({ message: "ログインが必要です。" }, { status: 401 });
  if (normalizeRole(profile.role) !== "owner") {
    return NextResponse.json({ message: "owner権限が必要です。" }, { status: 403 });
  }
  return profile;
}

async function applyAttendanceEdit(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  params: {
    companyId: string;
    staffProfile: { id: string; user_id: string; store_id: string | null };
    editorProfileId: string;
    targetDate: string;
    requestId: string | null;
    editType: string;
    reason: string;
    ownerComment: string | null;
    source: "request" | "direct";
    nextClockIn: string | null;
    nextClockOut: string | null;
    nextBreakMinutes: number | null;
    nextWorkType: string | null;
  },
) {
  const { data: existing, error: existingError } = await supabase
    .from("attendance")
    .select("*")
    .eq("company_id", params.companyId)
    .eq("profile_id", params.staffProfile.id)
    .eq("work_date", params.targetDate)
    .limit(1)
    .maybeSingle<Attendance>();
  if (existingError) throw existingError;

  const payload = {
    company_id: params.companyId,
    user_id: params.staffProfile.user_id,
    profile_id: params.staffProfile.id,
    store_id: params.staffProfile.store_id,
    work_date: params.targetDate,
    day_type: existing?.day_type ?? "workday",
    clock_in: params.nextClockIn ?? existing?.clock_in ?? null,
    clock_out: params.nextClockOut ?? existing?.clock_out ?? null,
    break_minutes: params.nextBreakMinutes ?? existing?.break_minutes ?? 60,
    work_type: params.nextWorkType ?? existing?.work_type ?? "normal",
  };

  const query = existing
    ? supabase.from("attendance").update(payload).eq("id", existing.id)
    : supabase.from("attendance").insert(payload);
  const { data: attendance, error: writeError } = await query.select("*").single<Attendance>();
  if (writeError) throw writeError;

  const { data: history, error: historyError } = await supabase
    .from("time_edit_histories")
    .insert({
      company_id: params.companyId,
      attendance_id: attendance.id,
      profile_id: params.staffProfile.id,
      edited_by_profile_id: params.editorProfileId,
      request_id: params.requestId,
      edit_type: params.editType,
      before_clock_in: existing?.clock_in ?? null,
      before_clock_out: existing?.clock_out ?? null,
      before_break_minutes: existing?.break_minutes ?? null,
      before_work_type: existing?.work_type ?? null,
      after_clock_in: attendance.clock_in,
      after_clock_out: attendance.clock_out,
      after_break_minutes: attendance.break_minutes,
      after_work_type: attendance.work_type,
      reason: params.reason,
      owner_comment: params.ownerComment,
      source: params.source,
    })
    .select("*")
    .single();
  if (historyError) throw historyError;

  return { attendance, history };
}

async function createNotification(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  params: {
    companyId: string;
    profileId: string;
    title: string;
    body: string;
    type: string;
    requestId?: string | null;
    historyId?: string | null;
  },
) {
  const { error } = await supabase.from("app_notifications").insert({
    company_id: params.companyId,
    profile_id: params.profileId,
    title: params.title,
    body: params.body,
    type: params.type,
    related_request_id: params.requestId ?? null,
    related_history_id: params.historyId ?? null,
  });
  if (error) throw error;
}
