import { NextResponse } from "next/server";
import { clockIn, getTimecardData } from "@/lib/attendance-service";
import { WorkType } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      employeeKey?: string;
      key?: string;
      workType?: WorkType;
      breakFlag?: boolean;
      staffId?: string;
      staffIds?: string[];
      staffName?: string;
    };
    const key = body.key ?? body.employeeKey;

    if (!key) {
      return NextResponse.json({ message: "key が必要です。" }, { status: 400 });
    }

    if (body.staffIds?.length) {
      const clockedInNames: string[] = [];

      for (const staffId of body.staffIds) {
        const current = await getTimecardData(key, { staffId });
        if (!current || current.status !== "not_clocked_in") continue;

        await clockIn({
          key,
          workType: body.workType ?? "normal",
          breakFlag: Boolean(body.breakFlag),
          staffId,
          staffName: current.selectedStaff?.name,
        });
        clockedInNames.push(current.selectedStaff?.name ?? staffId);
      }

      return NextResponse.json({
        ...(await getTimecardData(key, { staffId: body.staffIds[0] })),
        message: clockedInNames.length
          ? `${clockedInNames.join("、")}を出勤しました`
          : "出勤対象がありません",
      });
    }

    await clockIn({
      key,
      workType: body.workType ?? "normal",
      breakFlag: Boolean(body.breakFlag),
      staffId: body.staffId,
      staffName: body.staffName,
    });

    return NextResponse.json(await getTimecardData(key, { staffId: body.staffId }));
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "出勤処理に失敗しました。",
      },
      { status: 400 },
    );
  }
}
