import { NextResponse } from "next/server";
import {
  isRoundingMethod,
  isValidOvertimeThreshold,
  isWorkRoundingMinutes,
  normalizeCompanySettings,
} from "@/lib/admin-settings";
import { requireActiveCompanySubscription } from "@/lib/billing-access";
import { createSupabaseAdmin, getAuthenticatedProfile } from "@/lib/supabase";

const ADMIN_ROLES = new Set(["owner", "manager", "admin"]);
const SETTINGS_SELECT = "work_rounding_minutes,rounding_method,overtime_threshold_minutes,include_payroll";

type SettingsBody = {
  work_rounding_minutes?: number | string;
  rounding_method?: string;
  overtime_threshold_minutes?: number | string;
  include_payroll?: boolean;
};

export async function GET(request: Request) {
  try {
    const profile = await requireAdminProfile(request);
    if (profile instanceof NextResponse) return profile;

    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("companies")
      .select(SETTINGS_SELECT)
      .eq("id", profile.company_id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ message: "会社設定が見つかりません。" }, { status: 404 });
    }

    return NextResponse.json({ settings: normalizeCompanySettings(data) });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "管理設定の取得に失敗しました。" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const profile = await requireAdminProfile(request);
    if (profile instanceof NextResponse) return profile;

    const body = (await request.json()) as SettingsBody;
    const updates = validateSettingsBody(body);
    if (updates instanceof NextResponse) return updates;

    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("companies")
      .update(updates)
      .eq("id", profile.company_id)
      .select(SETTINGS_SELECT)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ message: "会社設定が見つかりません。" }, { status: 404 });
    }

    return NextResponse.json({ settings: normalizeCompanySettings(data) });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "管理設定の保存に失敗しました。" },
      { status: 500 },
    );
  }
}

async function requireAdminProfile(request: Request) {
  const profile = await getAuthenticatedProfile(request);
  if (!profile) {
    return NextResponse.json({ message: "ログインが必要です。" }, { status: 401 });
  }

  const role = profile.role?.trim().toLowerCase();
  if (!ADMIN_ROLES.has(role)) {
    return NextResponse.json({ message: "管理設定を操作する権限がありません。" }, { status: 403 });
  }
  const billingRestriction = await requireActiveCompanySubscription(profile);
  if (billingRestriction) return billingRestriction;

  return profile;
}

function validateSettingsBody(body: SettingsBody) {
  const workRoundingMinutes = Number(body.work_rounding_minutes);
  if (!isWorkRoundingMinutes(workRoundingMinutes)) {
    return NextResponse.json({ message: "労働時間計算ルールの指定が正しくありません。" }, { status: 400 });
  }

  if (!isRoundingMethod(body.rounding_method)) {
    return NextResponse.json({ message: "丸め方式の指定が正しくありません。" }, { status: 400 });
  }

  const overtimeThresholdMinutes = Number(body.overtime_threshold_minutes);
  if (!isValidOvertimeThreshold(overtimeThresholdMinutes)) {
    return NextResponse.json({ message: "残業開始時間は1時間以上24時間以内で指定してください。" }, { status: 400 });
  }

  return {
    work_rounding_minutes: workRoundingMinutes,
    rounding_method: body.rounding_method,
    overtime_threshold_minutes: overtimeThresholdMinutes,
    include_payroll: body.include_payroll === true,
  };
}
