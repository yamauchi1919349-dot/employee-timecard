import { NextResponse } from "next/server";
import { clockOut, getTimecardData } from "@/lib/attendance-service";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      employeeKey?: string;
      key?: string;
      clockIn?: string;
      clockOut?: string;
      staffId?: string;
      staffIds?: string[];
    };
    const key = body.key ?? body.employeeKey;

    if (!key) {
      return NextResponse.json({ message: "key が必要です。" }, { status: 400 });
    }

    if (body.staffIds?.length) {
      const clockedOutNames: string[] = [];

      for (const staffId of body.staffIds) {
        const current = await getTimecardData(key, { staffId });
        if (!current || current.status !== "working") continue;

        await clockOut({ key, staffId });
        clockedOutNames.push(current.selectedStaff?.name ?? staffId);
      }

      return NextResponse.json({
        ...(await getTimecardData(key, { staffId: body.staffIds[0] })),
        message: clockedOutNames.length
          ? `${clockedOutNames.join("、")}を退勤しました`
          : "退勤対象がありません",
      });
    }

    await clockOut({
      key,
      clockIn: body.clockIn,
      clockOut: body.clockOut,
      staffId: body.staffId,
    });

    return NextResponse.json(await getTimecardData(key, { staffId: body.staffId }));
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "退勤処理に失敗しました。",
      },
      { status: 400 },
    );
  }
}
