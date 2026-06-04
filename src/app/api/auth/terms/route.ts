import { NextResponse } from "next/server";
import { createSupabaseAdmin, getAuthenticatedProfile } from "@/lib/supabase";

export async function PATCH(request: Request) {
  try {
    const profile = await getAuthenticatedProfile(request);
    if (!profile) {
      return NextResponse.json({ message: "ログインが必要です。" }, { status: 401 });
    }

    const role = profile.role?.trim().toLowerCase();
    if (role !== "owner") {
      return NextResponse.json({ message: "利用規約同意はownerのみが対象です。" }, { status: 403 });
    }

    const acceptedAt = new Date().toISOString();
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("profiles")
      .update({ terms_accepted_at: acceptedAt })
      .eq("id", profile.id)
      .eq("company_id", profile.company_id)
      .eq("user_id", profile.user_id)
      .select("id,terms_accepted_at")
      .single();

    if (error) {
      return NextResponse.json(
        { message: "利用規約への同意状態を保存できませんでした。", detail: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ profile: data });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "利用規約への同意状態を保存できませんでした。" },
      { status: 500 },
    );
  }
}
