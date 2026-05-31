import { NextResponse } from "next/server";
import { getTimecardData } from "@/lib/attendance-service";

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("k");

  if (!key) {
    return NextResponse.json(
      { message: "URLパラメータ k が必要です。" },
      { status: 400 },
    );
  }

  try {
    const data = await getTimecardData(key);

    if (!data) {
      return NextResponse.json(
        { message: "従業員が見つかりません。" },
        { status: 404 },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}

function handleApiError(error: unknown) {
  return NextResponse.json(
    {
      message:
        error instanceof Error ? error.message : "サーバーエラーが発生しました。",
    },
    { status: 500 },
  );
}

