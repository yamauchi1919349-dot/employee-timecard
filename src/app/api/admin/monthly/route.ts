import { NextResponse } from "next/server";
import { BASIC_WORK_MINUTES, APP_TIME_ZONE } from "@/lib/attendance";
import { createSupabaseAdmin, getAuthenticatedProfile } from "@/lib/supabase";
import { Attendance } from "@/lib/types";

type AttendanceWithProfile = Attendance & {
  profiles?: {
    id?: string | null;
    name?: string | null;
    email?: string | null;
    role?: string | null;
  } | null;
};

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
      .select("*, profiles(id,name,email,role)")
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

    const rows = ((data ?? []) as AttendanceWithProfile[]).map(toMonthlyRow);
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
      },
    );

    return NextResponse.json({
      selectedMonth: month,
      selectedProfileId: profileId || null,
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

function toMonthlyRow(row: AttendanceWithProfile) {
  const roundedWorkMinutes = getRoundedWorkMinutes(row);
  return {
    id: row.id,
    profileId: row.profile_id,
    userId: row.user_id,
    staffName: row.profiles?.name ?? "未登録スタッフ",
    staffEmail: row.profiles?.email ?? null,
    workDate: row.work_date,
    clockIn: row.clock_in,
    clockOut: row.clock_out,
    workType: row.work_type,
    breakMinutes: row.break_minutes ?? 0,
    roundedWorkMinutes,
    overtimeMinutes: Math.max(0, roundedWorkMinutes - BASIC_WORK_MINUTES),
  };
}

function getRoundedWorkMinutes(row: Attendance) {
  if (!row.clock_in || !row.clock_out) return 0;
  const roundedIn = ceilToInterval(new Date(row.clock_in), 15);
  const roundedOut = floorToInterval(new Date(row.clock_out), 15);
  const rawMinutes = Math.floor((roundedOut.getTime() - roundedIn.getTime()) / 60000);
  return Math.max(0, rawMinutes - (row.break_minutes ?? 0));
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

function ceilToInterval(date: Date, minutes: number) {
  const intervalMs = minutes * 60 * 1000;
  return new Date(Math.ceil(date.getTime() / intervalMs) * intervalMs);
}

function floorToInterval(date: Date, minutes: number) {
  const intervalMs = minutes * 60 * 1000;
  return new Date(Math.floor(date.getTime() / intervalMs) * intervalMs);
}
