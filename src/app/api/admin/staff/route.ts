import { NextResponse } from "next/server";
import { requireActiveCompanySubscription } from "@/lib/billing-access";
import { createSupabaseAdmin, getAuthenticatedProfile } from "@/lib/supabase";
import { EmploymentType } from "@/lib/types";

const ADMIN_ROLES = new Set(["owner", "manager", "admin"]);
const EMPLOYMENT_TYPES = new Set(["full_time", "part_time", "contract", "other"]);
const STAFF_SELECT =
  "id,user_id,company_id,store_id,name,email,employee_number,role,employment_type,hourly_wage,fixed_salary,active,created_at";

type StaffUpdateBody = {
  id?: string;
  name?: string;
  employee_number?: string | null;
  employment_type?: EmploymentType | "" | null;
  hourly_wage?: number | string | null;
  fixed_salary?: number | string | null;
  active?: boolean;
};

export async function GET(request: Request) {
  try {
    const profile = await requireAdminProfile(request);
    if (profile instanceof NextResponse) return profile;

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    const supabase = createSupabaseAdmin();
    let query = supabase
      .from("profiles")
      .select(STAFF_SELECT)
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false });

    if (!includeInactive) {
      query = query.eq("active", true);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ staff: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "スタッフ一覧の取得に失敗しました。" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const profile = await requireAdminProfile(request);
    if (profile instanceof NextResponse) return profile;

    const body = (await request.json()) as StaffUpdateBody;
    const staffId = body.id?.trim();
    if (!staffId) {
      return NextResponse.json({ message: "スタッフIDが指定されていません。" }, { status: 400 });
    }

    const updates = buildStaffUpdates(body);
    if (updates instanceof NextResponse) return updates;

    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", staffId)
      .eq("company_id", profile.company_id)
      .select(STAFF_SELECT)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ message: "対象スタッフが見つかりません。" }, { status: 404 });
    }

    return NextResponse.json({ staff: data });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "スタッフ情報の更新に失敗しました。" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const profile = await requireAdminProfile(request);
    if (profile instanceof NextResponse) return profile;

    const { searchParams } = new URL(request.url);
    let staffId = searchParams.get("id")?.trim();
    if (!staffId) {
      const body = (await request.json().catch(() => null)) as { id?: string } | null;
      staffId = body?.id?.trim();
    }
    if (!staffId) {
      return NextResponse.json({ message: "スタッフIDが指定されていません。" }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("profiles")
      .update({ active: false })
      .eq("id", staffId)
      .eq("company_id", profile.company_id)
      .select(STAFF_SELECT)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ message: "対象スタッフが見つかりません。" }, { status: 404 });
    }

    return NextResponse.json({ staff: data });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "スタッフの削除に失敗しました。" },
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
    return NextResponse.json({ message: "スタッフ管理を操作する権限がありません。" }, { status: 403 });
  }
  const billingRestriction = await requireActiveCompanySubscription(profile);
  if (billingRestriction) return billingRestriction;

  return profile;
}

function buildStaffUpdates(body: StaffUpdateBody) {
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ message: "氏名を入力してください。" }, { status: 400 });
  }

  const employmentType = body.employment_type || null;
  if (employmentType && !EMPLOYMENT_TYPES.has(employmentType)) {
    return NextResponse.json({ message: "雇用区分の指定が正しくありません。" }, { status: 400 });
  }

  const employeeNumber = normalizeEmployeeNumber(body.employee_number);
  if (employeeNumber instanceof NextResponse) return employeeNumber;

  const hourlyWage = normalizeMoney(body.hourly_wage, "時給");
  if (hourlyWage instanceof NextResponse) return hourlyWage;

  const fixedSalary = normalizeMoney(body.fixed_salary, "固定給");
  if (fixedSalary instanceof NextResponse) return fixedSalary;

  return {
    name,
    employee_number: employeeNumber,
    employment_type: employmentType,
    hourly_wage: hourlyWage,
    fixed_salary: fixedSalary,
    active: body.active === false ? false : true,
  };
}

function normalizeEmployeeNumber(value: string | null | undefined) {
  const employeeNumber = value?.trim() || null;
  if (employeeNumber && employeeNumber.length > 64) {
    return NextResponse.json({ message: "社員番号は64文字以内で入力してください。" }, { status: 400 });
  }
  return employeeNumber;
}

function normalizeMoney(value: number | string | null | undefined, label: string) {
  if (value === null || value === undefined || value === "") return null;
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount < 0 || !Number.isInteger(amount)) {
    return NextResponse.json({ message: `${label}は0以上の整数で入力してください。` }, { status: 400 });
  }
  return amount;
}
