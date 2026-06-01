import { NextResponse } from "next/server";
import { getTimecardData } from "@/lib/attendance-service";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const key = searchParams.get("k");
  const staffId = searchParams.get("staffId");

  if (!key) {
    return NextResponse.json({ message: "k が必要です。" }, { status: 400 });
  }

  try {
    const data = await getTimecardData(key, { staffId });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "状態取得に失敗しました。",
      },
      { status: 500 },
    );
  }
}

