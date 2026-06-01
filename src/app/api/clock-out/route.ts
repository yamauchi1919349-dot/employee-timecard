import { NextResponse } from "next/server";
import { clockOut, getTimecardData } from "@/lib/attendance-service";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      key?: string;
      clockIn?: string;
      clockOut?: string;
      staffId?: string;
    };

    if (!body.key) {
      return NextResponse.json({ message: "key が必要です。" }, { status: 400 });
    }

    await clockOut({
      key: body.key,
      clockIn: body.clockIn,
      clockOut: body.clockOut,
      staffId: body.staffId,
    });

    return NextResponse.json(await getTimecardData(body.key, { staffId: body.staffId }));
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "退勤処理に失敗しました。",
      },
      { status: 400 },
    );
  }
}

