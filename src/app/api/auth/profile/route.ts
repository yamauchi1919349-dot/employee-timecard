import { NextResponse } from "next/server";
import { getAuthenticatedProfile } from "@/lib/supabase";

export async function GET(request: Request) {
  try {
    const profile = await getAuthenticatedProfile(request);

    if (!profile) {
      return NextResponse.json(
        { message: "ログイン情報またはプロフィールが見つかりません。" },
        { status: 401 },
      );
    }

    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "プロフィールの取得に失敗しました。",
      },
      { status: 500 },
    );
  }
}
