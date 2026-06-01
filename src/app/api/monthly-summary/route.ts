import { NextResponse } from "next/server";
import { formatMinutes, summarizeMonthlyLogs } from "@/lib/attendance";
import { getMonthlyLogs } from "@/lib/attendance-service";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const key = searchParams.get("k");
  const month = searchParams.get("month");

  if (!key || !month) {
    return NextResponse.json({ message: "k と month が必要です。" }, { status: 400 });
  }

  try {
    const { logs } = await getMonthlyLogs({ key, month });
    const summary = summarizeMonthlyLogs(logs);
    const overtimeMinutes =
      summary.normalOvertimeMinutes + summary.kitchenCarOvertimeMinutes;

    return NextResponse.json({
      workedDays: summary.workedDays,
      totalWorkMinutes: summary.totalWorkMinutes,
      overtimeMinutes,
      totalWorkLabel: formatMinutes(summary.totalWorkMinutes),
      overtimeLabel: formatMinutes(overtimeMinutes),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "月間サマリーの取得に失敗しました。",
      },
      { status: 500 },
    );
  }
}
