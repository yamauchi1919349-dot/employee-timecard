import { NextResponse } from "next/server";
import { clockIn, getTimecardData } from "@/lib/attendance-service";
import { WorkType } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      key?: string;
      workType?: WorkType;
      breakFlag?: boolean;
    };

    if (!body.key) {
      return NextResponse.json({ message: "key が必要です。" }, { status: 400 });
    }

    await clockIn({
      key: body.key,
      workType: body.workType ?? "normal",
      breakFlag: Boolean(body.breakFlag),
    });

    return NextResponse.json(await getTimecardData(body.key));
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "出勤処理に失敗しました。",
      },
      { status: 400 },
    );
  }
}

