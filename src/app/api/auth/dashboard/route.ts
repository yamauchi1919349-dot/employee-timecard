import { NextResponse } from "next/server";
import { getBusinessDate } from "@/lib/attendance";
import { createSupabaseAdmin, getAuthenticatedProfile } from "@/lib/supabase";

export async function GET(request: Request) {
  try {
    const profile = await getAuthenticatedProfile(request);
    if (!profile) {
      return NextResponse.json({ message: "ログインが必要です。" }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();
    const workDate = getBusinessDate();
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id,name,plan,stripe_customer_id,stripe_subscription_id,subscription_status,current_period_end,billing_grace_period_started_at,billing_grace_period_ends_at,billing_email")
      .eq("id", profile.company_id)
      .maybeSingle();

    if (companyError) throw companyError;

    let attendanceQuery = supabase
      .from("attendance")
      .select("*, profiles(name,email,role)")
      .eq("company_id", profile.company_id)
      .eq("work_date", workDate)
      .order("created_at", { ascending: true });

    if (profile.role === "staff") {
      attendanceQuery = attendanceQuery.eq("user_id", profile.user_id);
    }

    const { data: attendance, error: attendanceError } = await attendanceQuery;
    if (attendanceError) throw attendanceError;

    const todayLog =
      profile.role === "staff"
        ? (attendance ?? []).find((row) => row.user_id === profile.user_id) ?? null
        : null;
    let pendingTimeEditRequestCount = 0;

    if (profile.role === "owner") {
      const { count, error: pendingRequestError } = await supabase
        .from("time_edit_requests")
        .select("id", { count: "exact", head: true })
        .eq("company_id", profile.company_id)
        .eq("status", "pending");
      if (pendingRequestError) throw pendingRequestError;
      pendingTimeEditRequestCount = count ?? 0;
    }

    return NextResponse.json({
      profile,
      company,
      workDate,
      todayLog,
      attendance: attendance ?? [],
      pendingTimeEditRequestCount,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "ダッシュボードの取得に失敗しました。",
      },
      { status: 500 },
    );
  }
}
