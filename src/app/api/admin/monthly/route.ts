import { NextResponse } from "next/server";
import { APP_TIME_ZONE } from "@/lib/attendance";
import { normalizeCompanySettings, roundDateToInterval } from "@/lib/admin-settings";
import { createSupabaseAdmin, getAuthenticatedProfile } from "@/lib/supabase";
import { Attendance, CompanySettings } from "@/lib/types";

type AttendanceWithProfile = Attendance & {
  profiles?: {
    id?: string | null;
    name?: string | null;
    email?: string | null;
    role?: string | null;
    hourly_wage?: number | null;
    fixed_salary?: number | null;
  } | null;
};

type MonthlyRow = ReturnType<typeof toMonthlyRow>;

export async function GET(request: Request) {
  try {
    const profile = await getAuthenticatedProfile(request);
    if (!profile) {
      return NextResponse.json({ message: "ログインが必要です。" }, { status: 401 });
    }

    const role = profile.role?.trim().toLowerCase();
    if (!["owner", "manager", "admin"].includes(role)) {
      return NextResponse.json(
        { message: "月次集計を表示する権限がありません。" },
        { status: 403 },
      );
    }

    const url = new URL(request.url);
    const month = url.searchParams.get("month") || getCurrentMonth();
    const profileId = url.searchParams.get("profileId")?.trim() || "";
    const monthRange = getMonthRange(month);

    if (!monthRange) {
      return NextResponse.json({ message: "月の指定が正しくありません。" }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { data: companySettingsData, error: companySettingsError } = await supabase
      .from("companies")
      .select("work_rounding_minutes,rounding_method,overtime_threshold_minutes,include_payroll")
      .eq("id", profile.company_id)
      .maybeSingle();

    if (companySettingsError) throw companySettingsError;
    const settings = normalizeCompanySettings(companySettingsData);

    let selectedProfileUserId = "";

    if (profileId) {
      const { data: selectedProfile, error: selectedProfileError } = await supabase
        .from("profiles")
        .select("id,user_id,company_id")
        .eq("id", profileId)
        .eq("company_id", profile.company_id)
        .maybeSingle();

      if (selectedProfileError) throw selectedProfileError;
      if (!selectedProfile) {
        return NextResponse.json(
          { message: "指定されたスタッフが見つかりません。" },
          { status: 404 },
        );
      }
      selectedProfileUserId = selectedProfile.user_id;
    }

    let query = supabase
      .from("attendance")
      .select("*, profiles(id,name,email,role,hourly_wage,fixed_salary)")
      .eq("company_id", profile.company_id)
      .gte("work_date", monthRange.start)
      .lte("work_date", monthRange.end)
      .not("clock_in", "is", null)
      .order("work_date", { ascending: true })
      .order("clock_in", { ascending: true });

    if (selectedProfileUserId) {
      query = query.eq("user_id", selectedProfileUserId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = ((data ?? []) as AttendanceWithProfile[]).map((row) => toMonthlyRow(row, settings));
    const estimatedPayrollTotal = settings.include_payroll ? calculateEstimatedPayrollTotal(rows) : null;
    const summary = rows.reduce(
      (current, row) => {
        current.workedDays += 1;
        if (row.workType === "paid_leave") current.holidayDays += 1;
        current.totalWorkMinutes += row.roundedWorkMinutes;
        current.overtimeMinutes += row.overtimeMinutes;
        return current;
      },
      {
        workedDays: 0,
        holidayDays: 0,
        totalWorkMinutes: 0,
        overtimeMinutes: 0,
        estimatedPayrollTotal,
      },
    );

    return NextResponse.json({
      selectedMonth: month,
      selectedProfileId: profileId || null,
      settings,
      summary,
      rows,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "月次集計の取得に失敗しました。",
      },
      { status: 500 },
    );
  }
}

function toMonthlyRow(row: AttendanceWithProfile, settings: CompanySettings) {
  const roundedWorkMinutes = getRoundedWorkMinutes(row, settings);
  const hourlyWage = row.profiles?.hourly_wage ?? null;
  const fixedSalary = row.profiles?.fixed_salary ?? null;
  const payrollSource = fixedSalary && fixedSalary > 0 ? "fixed" : hourlyWage && hourlyWage > 0 ? "hourly" : "none";

  return {
    id: row.id,
    profileId: row.profile_id,
    userId: row.user_id,
    staffName: row.profiles?.name ?? "未登録スタッフ",
    staffEmail: row.profiles?.email ?? null,
    hourlyWage,
    fixedSalary,
    workDate: row.work_date,
    clockIn: row.clock_in,
    clockOut: row.clock_out,
    workType: row.work_type,
    breakMinutes: row.break_minutes ?? 0,
    roundedWorkMinutes,
    overtimeMinutes: Math.max(0, roundedWorkMinutes - settings.overtime_threshold_minutes),
    payrollSource,
    estimatedPayroll:
      payrollSource === "hourly" && hourlyWage ? Math.round((roundedWorkMinutes / 60) * hourlyWage) : null,
  };
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
  return Math.max(0, rawMinutes - (row.break_minutes ?? 0));
}

function calculateEstimatedPayrollTotal(rows: MonthlyRow[]) {
  const fixedSalaryProfileIds = new Set<string>();
  return rows.reduce((total, row) => {
    if (row.payrollSource === "fixed" && row.fixedSalary && row.profileId && !fixedSalaryProfileIds.has(row.profileId)) {
      fixedSalaryProfileIds.add(row.profileId);
      return total + row.fixedSalary;
    }

    if (row.payrollSource === "hourly" && row.estimatedPayroll) {
      return total + row.estimatedPayroll;
    }

    return total;
  }, 0);
}

function getMonthRange(month: string) {
  const match = month.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]);
  if (!year || monthIndex < 1 || monthIndex > 12) return null;
  const start = `${month}-01`;
  const end = new Date(Date.UTC(year, monthIndex, 0)).toISOString().slice(0, 10);
  return { start, end };
}

function getCurrentMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}
