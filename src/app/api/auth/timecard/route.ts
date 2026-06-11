import { NextResponse } from "next/server";
import { BASIC_WORK_MINUTES, getBusinessDate } from "@/lib/attendance";
import { getBillingRestrictionMessage, isCompanySubscriptionActive } from "@/lib/billing-status";
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
      .select("id,name,plan,subscription_status,billing_grace_period_started_at,billing_grace_period_ends_at")
      .eq("id", profile.company_id)
      .maybeSingle();
    if (companyError) throw companyError;

    if (!isCompanySubscriptionActive(company)) {
      return NextResponse.json({
        profile,
        company,
        billingRestricted: true,
        message: getBillingRestrictionMessage(),
        workDate,
        selectedMonth: month,
        todayLog: null,
        attendance: [],
        calendarRows: [],
        monthlyRows: [],
        ownMonthRows: [],
        summary: summarize([]),
      });
    }

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
    const scopedRows =
      role === "staff"
        ? attendance
        : attendance.filter((row) => row.user_id === profile.user_id);
    const monthlyRows = scopedRows.filter((row) => Boolean(row.clock_in));
    const todayLog =
      scopedRows.find((row) => row.work_date === workDate && row.user_id === profile.user_id) ??
      null;
    const ownMonthRows = monthlyRows;
    const summaryRows = role === "staff" ? monthlyRows : attendance.filter((row) => Boolean(row.clock_in));
    const summary = summarize(summaryRows);

    return NextResponse.json({
      profile,
      company,
      workDate,
      selectedMonth: month,
      todayLog,
      attendance,
      calendarRows: scopedRows,
      monthlyRows,
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
      const grossMinutes = getGrossMinutes(row);
      const breakMinutes = row.clock_in ? row.break_minutes : 0;
      const workMinutes = getWorkMinutes(row);
      const overtimeMinutes = Math.max(0, workMinutes - BASIC_WORK_MINUTES);

      summary.totalGrossMinutes += grossMinutes;
      summary.totalBreakMinutes += breakMinutes;
      summary.totalWorkMinutes += workMinutes;
      summary.overtimeMinutes += overtimeMinutes;
      if (row.clock_in) summary.workedDays += 1;

      return summary;
    },
    {
      totalGrossMinutes: 0,
      totalBreakMinutes: 0,
      totalWorkMinutes: 0,
      overtimeMinutes: 0,
      workedDays: 0,
    },
  );
}

function getGrossMinutes(row: Attendance) {
  if (!row.clock_in || !row.clock_out) return 0;
  return Math.max(
    0,
    Math.floor((new Date(row.clock_out).getTime() - new Date(row.clock_in).getTime()) / 60000),
  );
}

function getWorkMinutes(row: Attendance) {
  if (!row.clock_in || !row.clock_out) return 0;
  const end = new Date(row.clock_out);
  const raw = Math.floor((end.getTime() - new Date(row.clock_in).getTime()) / 60000);
  return Math.max(0, raw - row.break_minutes);
}
