import { NextResponse } from "next/server";
import {
  getAvailableMonths,
  getMemberByKey,
} from "@/lib/attendance-service";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("k");

  if (!key) {
    return NextResponse.json({ message: "k が必要です。" }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdmin();
    const member = await getMemberByKey(supabase, key);

    if (!member) {
      return NextResponse.json(
        { message: "従業員が見つかりません。" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      months: await getAvailableMonths(supabase, member.id),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "月一覧取得に失敗しました。",
      },
      { status: 500 },
    );
  }
}

