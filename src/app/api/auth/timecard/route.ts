import { NextResponse } from "next/server";
import { BASIC_WORK_MINUTES, getBusinessDate } from "@/lib/attendance";
import { createSupabaseAdmin, getAuthenticatedProfile } from "@/lib/supabase";
import { Attendance } from "@/lib/types";

export async function GET(request: Request) {
  try {
    const profile = await getAuthenticatedProfile(request);
    if (!profile) {
      return NextResponse.json({ message: "ログインが必要です。" }, { status: 401 });
    }

    const url = new URL(request.url);
    const workDate = getBusinessDate();
    const month = url.searchParams.get("month") || workDate.slice(0, 7);
    const [year, monthNumber] = month.split("-").map(Number);

    if (!year || !monthNumber) {
      return NextResponse.json({ message: "月の指定が正しくありません。" }, { status: 400 });
    }

    const start = `${month}-01`;
    const end = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
    const supabase = createSupabaseAdmin();
    const role = profile.role.trim().toLowerCase();

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id,name,plan")
      .eq("id", profile.company_id)
      .maybeSingle();
    if (companyError) throw companyError;

    let monthQuery = supabase
      .from("attendance")
      .select("*, profiles(name,email,role)")
      .eq("company_id", profile.company_id)
      .gte("work_date", start)
      .lte("work_date", end)
      .order("work_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (role === "staff") {
      monthQuery = monthQuery.eq("user_id", profile.user_id);
    }

    const { data: rows, error: rowsError } = await monthQuery;
    if (rowsError) throw rowsError;

    const attendance = (rows ?? []) as (Attendance & {
      profiles?: { name?: string | null; email?: string | null; role?: string | null } | null;
    })[];
    const todayLog =
      attendance.find((row) => row.work_date === workDate && row.user_id === profile.user_id) ??
      null;
    const ownMonthRows = attendance.filter((row) =>
      role === "staff" ? true : row.user_id === profile.user_id,
    );
    const summaryRows = role === "staff" ? ownMonthRows : attendance;
    const summary = summarize(summaryRows);

    return NextResponse.json({
      profile,
      company,
      workDate,
      selectedMonth: month,
      todayLog,
      attendance,
      ownMonthRows,
      summary,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "勤怠データの取得に失敗しました。",
      },
      { status: 500 },
    );
  }
}

function summarize(rows: Attendance[]) {
  return rows.reduce(
    (summary, row) => {
      const workMinutes = getWorkMinutes(row, row.clock_out ? new Date(row.clock_out) : null);
      const overtimeMinutes = Math.max(0, workMinutes - BASIC_WORK_MINUTES);

      summary.totalWorkMinutes += workMinutes;
      summary.overtimeMinutes += overtimeMinutes;
      if (row.clock_in) summary.workedDays += 1;

      return summary;
    },
    {
      totalWorkMinutes: 0,
      overtimeMinutes: 0,
      workedDays: 0,
    },
  );
}

function getWorkMinutes(row: Attendance, now: Date | null) {
  if (!row.clock_in) return 0;
  const end = row.clock_out ? new Date(row.clock_out) : now;
  if (!end) return 0;
  const raw = Math.floor((end.getTime() - new Date(row.clock_in).getTime()) / 60000);
  return Math.max(0, raw - row.break_minutes);
}
