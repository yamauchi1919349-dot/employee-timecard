import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

type SignupCompanyBody = {
  companyName?: string;
  adminName?: string;
  email?: string;
  password?: string;
  acceptedTerms?: boolean;
};

export async function POST(request: Request) {
  let createdUserId: string | null = null;
  let createdCompanyId: string | null = null;

  try {
    const body = (await request.json().catch(() => ({}))) as SignupCompanyBody;
    const companyName = body.companyName?.trim();
    const adminName = body.adminName?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";

    if (!companyName || !adminName || !email || !password) {
      return NextResponse.json({ message: "会社名、管理者名、メールアドレス、パスワードを入力してください。" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ message: "メールアドレスの形式が正しくありません。" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ message: "パスワードは8文字以上で入力してください。" }, { status: 400 });
    }
    if (body.acceptedTerms !== true) {
      return NextResponse.json({ message: "利用規約とプライバシーポリシーへの同意が必要です。" }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: adminName,
        company_name: companyName,
        role: "owner",
      },
    });

    if (userError) {
      return NextResponse.json({ message: toSignupErrorMessage(userError.message) }, { status: 400 });
    }
    if (!userData.user?.id) {
      return NextResponse.json({ message: "ユーザー作成に失敗しました。" }, { status: 500 });
    }
    createdUserId = userData.user.id;

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .insert({ name: companyName })
      .select("id,name")
      .single();

    if (companyError) throw new Error(`会社情報の作成に失敗しました: ${companyError.message}`);
    createdCompanyId = company.id;

    const acceptedAt = new Date().toISOString();
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .insert({
        user_id: createdUserId,
        company_id: createdCompanyId,
        store_id: null,
        name: adminName,
        email,
        role: "owner",
        active: true,
        terms_accepted_at: acceptedAt,
      })
      .select("id,user_id,company_id,name,email,role,terms_accepted_at")
      .single();

    if (profileError) throw new Error(`管理者プロフィールの作成に失敗しました: ${profileError.message}`);

    return NextResponse.json({ company, profile });
  } catch (error) {
    await cleanupSignup(createdUserId, createdCompanyId);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "新規登録に失敗しました。" },
      { status: 500 },
    );
  }
}

function toSignupErrorMessage(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("already") || lower.includes("registered") || lower.includes("exists")) {
    return "このメールアドレスはすでに登録されています。ログインまたはパスワード再設定をご利用ください。";
  }
  if (lower.includes("password")) {
    return "パスワードの条件を満たしていません。8文字以上で入力してください。";
  }
  return `ユーザー作成に失敗しました: ${message}`;
}

async function cleanupSignup(userId: string | null, companyId: string | null) {
  const supabase = createSupabaseAdmin();

  if (companyId) {
    await supabase.from("companies").delete().eq("id", companyId);
  }
  if (userId) {
    await supabase.auth.admin.deleteUser(userId);
  }
}
