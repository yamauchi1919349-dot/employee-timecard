import { NextResponse } from "next/server";
import { getBusinessDate } from "@/lib/attendance";
import { normalizeCompanySettings, roundDateToInterval } from "@/lib/admin-settings";
import { getBillingRestrictionMessage, isCompanySubscriptionActive } from "@/lib/billing-status";
import { getEffectiveTenantRole, isDeveloperCompanyProfile, isDeveloperProfile } from "@/lib/developer-mode";
import { createSupabaseAdmin, getAuthenticatedProfile } from "@/lib/supabase";
import { Attendance, CompanySettings } from "@/lib/types";

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
    const developerMode = isDeveloperProfile(profile);
    const developerCompanyMode = await isDeveloperCompanyProfile(profile, supabase);
    const role = getEffectiveTenantRole(profile);

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id,name,plan,subscription_status,billing_grace_period_started_at,billing_grace_period_ends_at,work_rounding_minutes,rounding_method,overtime_threshold_minutes,include_payroll")
      .eq("id", profile.company_id)
      .maybeSingle();
    if (companyError) throw companyError;
    const settings = normalizeCompanySettings(company);

    if (!developerCompanyMode && !isCompanySubscriptionActive(company)) {
      return NextResponse.json({
        profile,
        company,
        developerMode,
        developerCompanyMode,
        billingRestricted: true,
        message: getBillingRestrictionMessage(),
        workDate,
        selectedMonth: month,
        todayLog: null,
        attendance: [],
        calendarRows: [],
        monthlyRows: [],
        ownMonthRows: [],
        summary: summarize([], settings),
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
    const summary = summarize(summaryRows, settings);

    return NextResponse.json({
      profile,
      company,
      developerMode,
      developerCompanyMode,
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

function summarize(rows: Attendance[], settings: CompanySettings) {
  return rows.reduce(
    (summary, row) => {
      const grossMinutes = getGrossMinutes(row);
      const breakMinutes = row.clock_in ? row.break_minutes : 0;
      const workMinutes = getRoundedWorkMinutes(row, settings);
      const overtimeMinutes = Math.max(0, workMinutes - settings.overtime_threshold_minutes);

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

function getRoundedWorkMinutes(row: Attendance, settings: CompanySettings) {
  if (!row.clock_in || !row.clock_out) return 0;
  const roundedIn = roundDateToInterval(
    new Date(row.clock_in),
    settings.work_rounding_minutes,
    settings.rounding_method,
  );
  const roundedOut = roundDateToInterval(
    new Date(row.clock_out),
    settings.work_rounding_minutes,
    settings.rounding_method,
  );
  const rawMinutes = Math.floor((roundedOut.getTime() - roundedIn.getTime()) / 60000);
  return Math.max(0, rawMinutes - row.break_minutes);
}
