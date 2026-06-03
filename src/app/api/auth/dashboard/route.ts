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
      .select("id,name,plan")
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

    return NextResponse.json({
      profile,
      company,
      workDate,
      todayLog,
      attendance: attendance ?? [],
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
