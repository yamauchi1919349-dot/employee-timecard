import { NextResponse } from "next/server";
import { createSupabaseAdmin, getAuthenticatedProfile, TenantRole } from "@/lib/supabase";

type InviteBody = {
  name?: string;
  email?: string;
  employee_number?: string | null;
  role?: TenantRole;
  storeId?: string | null;
};

const INVITABLE_ROLES: TenantRole[] = ["owner", "manager", "staff"];

export async function POST(request: Request) {
  try {
    const inviter = await getAuthenticatedProfile(request);
    if (!inviter) {
      return NextResponse.json({ message: "ログインが必要です。" }, { status: 401 });
    }
    const inviterRole = inviter.role?.trim().toLowerCase();
    if (!["owner", "manager"].includes(inviterRole)) {
      return NextResponse.json({ message: "招待する権限がありません。" }, { status: 403 });
    }

    const body = (await request.json()) as InviteBody;
    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const employeeNumber = normalizeEmployeeNumber(body.employee_number);
    if (employeeNumber instanceof NextResponse) return employeeNumber;
    const role = body.role ?? "staff";
    const storeId = body.storeId?.trim() || null;

    if (!name || !email) {
      return NextResponse.json({ message: "氏名とメールアドレスを入力してください。" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ message: "メールアドレスの形式が正しくありません。" }, { status: 400 });
    }
    if (!INVITABLE_ROLES.includes(role)) {
      return NextResponse.json({ message: "指定された権限が正しくありません。" }, { status: 400 });
    }
    if (inviterRole === "manager" && role === "owner") {
      return NextResponse.json({ message: "manager は owner を招待できません。" }, { status: 403 });
    }

    const supabase = createSupabaseAdmin();
    const { data: existingProfile, error: duplicateError } = await supabase
      .from("profiles")
      .select("id")
      .eq("company_id", inviter.company_id)
      .ilike("email", email)
      .limit(1)
      .maybeSingle();

    if (duplicateError) throw duplicateError;
    if (existingProfile) {
      return NextResponse.json({ message: "同じ企業内に同じメールアドレスが登録済みです。" }, { status: 409 });
    }

    if (storeId) {
      const { data: store, error: storeError } = await supabase
        .from("stores")
        .select("id")
        .eq("id", storeId)
        .eq("company_id", inviter.company_id)
        .maybeSingle();

      if (storeError) throw storeError;
      if (!store) {
        return NextResponse.json({ message: "指定された店舗が見つかりません。" }, { status: 400 });
      }
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
    const { data: inviteData, error: inviteError } =
      await supabase.auth.admin.inviteUserByEmail(email, {
        data: {
          name,
          company_id: inviter.company_id,
          role,
        },
        redirectTo: `${siteUrl}/reset-password`,
      });

    if (inviteError) {
      return NextResponse.json(
        { message: `招待メールの送信に失敗しました: ${inviteError.message}` },
        { status: 400 },
      );
    }
    if (!inviteData.user?.id) {
      return NextResponse.json({ message: "招待ユーザーの作成に失敗しました。" }, { status: 500 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .insert({
        user_id: inviteData.user.id,
        company_id: inviter.company_id,
        store_id: storeId,
        name,
        email,
        employee_number: employeeNumber,
        role,
        active: true,
      })
      .select("id,user_id,company_id,store_id,name,email,employee_number,role,employment_type,hourly_wage,fixed_salary,active,created_at")
      .single();

    if (profileError) {
      return NextResponse.json(
        { message: `プロフィール作成に失敗しました: ${profileError.message}` },
        { status: 400 },
      );
    }

    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "招待処理に失敗しました。" },
      { status: 500 },
    );
  }
}

function normalizeEmployeeNumber(value: string | null | undefined) {
  const employeeNumber = value?.trim() || null;
  if (employeeNumber && employeeNumber.length > 64) {
    return NextResponse.json({ message: "社員番号は64文字以内で入力してください。" }, { status: 400 });
  }
  return employeeNumber;
}
