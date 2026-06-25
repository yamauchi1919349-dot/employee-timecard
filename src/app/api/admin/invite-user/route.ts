import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/app-url";
import { requireActiveCompanySubscription } from "@/lib/billing-access";
import { getEffectiveTenantRole } from "@/lib/developer-mode";
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
    const inviterRole = getEffectiveTenantRole(inviter);
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
    const billingRestriction = await requireActiveCompanySubscription(inviter);
    if (billingRestriction) return billingRestriction;

    const supabase = createSupabaseAdmin();
    const { data: existingProfile, error: duplicateError } = await supabase
      .from("profiles")
      .select("id")
      .eq("company_id", inviter.company_id)
      .ilike("email", email)
      .limit(1)
      .maybeSingle();

    if (duplicateError) {
      console.error("[invite-user] duplicate profile check failed", toLogError(duplicateError));
      throw duplicateError;
    }
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

      if (storeError) {
        console.error("[invite-user] store check failed", toLogError(storeError));
        throw storeError;
      }
      if (!store) {
        return NextResponse.json({ message: "指定された店舗が見つかりません。" }, { status: 400 });
      }
    }

    const appUrl = getAppBaseUrl();
    const redirectTo = `${appUrl}/reset-password`;
    const { data: inviteData, error: inviteError } =
      await supabase.auth.admin.inviteUserByEmail(email, {
        data: {
          name,
          company_id: inviter.company_id,
          role,
        },
        redirectTo,
      });

    if (inviteError) {
      console.error("[invite-user] inviteUserByEmail failed", toLogError(inviteError));
      return NextResponse.json(
        withDevError(
          { message: `招待メールの送信に失敗しました: ${inviteError.message}` },
          "inviteUserByEmail",
          inviteError,
          { redirectTo },
        ),
        { status: 400 },
      );
    }
    if (!inviteData.user?.id) {
      console.error("[invite-user] inviteUserByEmail returned no user id", {
        hasUser: Boolean(inviteData.user),
        redirectTo,
      });
      return NextResponse.json(
        withDevError(
          { message: "招待ユーザーの作成に失敗しました。" },
          "inviteUserByEmail",
          new Error("Supabase invite response did not include user.id."),
          { redirectTo },
        ),
        { status: 500 },
      );
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
      .select("id,user_id,company_id,store_id,name,email,employee_number,role,employment_type,hourly_wage,fixed_salary,active,is_developer,created_at")
      .single();

    if (profileError) {
      console.error("[invite-user] profile insert failed", toLogError(profileError));
      return NextResponse.json(
        withDevError(
          { message: `プロフィール作成に失敗しました: ${profileError.message}` },
          "profile insert",
          profileError,
        ),
        { status: 400 },
      );
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("[invite-user] unexpected failure", toLogError(error));
    return NextResponse.json(
      withDevError(
        { message: error instanceof Error ? error.message : "招待処理に失敗しました。" },
        "unexpected",
        error,
      ),
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

function withDevError<T extends Record<string, unknown>>(
  payload: T,
  source: string,
  error: unknown,
  extra?: Record<string, unknown>,
) {
  if (process.env.NODE_ENV === "production") return payload;
  return {
    ...payload,
    debug: {
      source,
      error: toLogError(error),
      ...extra,
    },
  };
}

function toLogError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
    };
  }

  if (error && typeof error === "object") {
    const payload = error as {
      name?: unknown;
      message?: unknown;
      code?: unknown;
      status?: unknown;
      details?: unknown;
      hint?: unknown;
    };
    return {
      name: typeof payload.name === "string" ? payload.name : undefined,
      message: typeof payload.message === "string" ? payload.message : undefined,
      code: typeof payload.code === "string" ? payload.code : undefined,
      status: typeof payload.status === "number" || typeof payload.status === "string" ? payload.status : undefined,
      details: typeof payload.details === "string" ? payload.details : undefined,
      hint: typeof payload.hint === "string" ? payload.hint : undefined,
    };
  }

  return { message: String(error) };
}
