import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

type CsvRow = Record<string, string>;
type ImportMember = {
  company_id: string;
  key: string;
  name: string;
  active: boolean;
};
type ImportLog = {
  company_id: string;
  member_id: string;
  date: string;
  work_type: "normal" | "kitchen_car";
  break_flag: boolean;
  clock_in: string | null;
  clock_out: string | null;
  work_minutes: number | null;
  overtime_minutes: number | null;
  note: string;
};
type MemberRecord = {
  id: string;
  company_id: string;
  key: string;
  name: string;
};

loadEnvFile(path.join(process.cwd(), ".env.local"));

const projectRoot = process.cwd();
const dryRun = process.argv.includes("--dry-run");
const companyName = process.env.GAS_IMPORT_COMPANY_NAME || "Default Company";

async function main() {
  const membersPath = path.join(projectRoot, "import", "members.csv");
  const logsPath = path.join(projectRoot, "import", "logs.csv");
  const [memberRows, logRows] = await Promise.all([
    readCsvFile(membersPath),
    readCsvFile(logsPath),
  ]);

  console.log(`Mode: ${dryRun ? "dry-run" : "import"}`);
  console.log(`Company: ${companyName}`);
  console.log(`Input members: ${memberRows.length}`);
  console.log(`Input logs: ${logRows.length}`);

  const supabase = createSupabaseClient();
  const company = await getOrCreateCompany(supabase);
  const memberResult = transformMembers(memberRows, company.id);
  printFailures("members transform", memberResult.failures);

  const importedMembers = dryRun
    ? buildDryRunMembers(memberResult.rows)
    : await upsertMembers(supabase, memberResult.rows, company.id);
  const memberByKey = new Map(importedMembers.map((member) => [member.key, member]));
  const logResult = transformLogs(logRows, company.id, memberByKey);
  printFailures("logs transform", logResult.failures);

  if (dryRun) {
    console.log("Dry-run finished. No database writes were performed.");
    console.log(`Members ready: ${memberResult.rows.length}`);
    console.log(`Logs ready: ${logResult.rows.length}`);
    console.log(
      `Failures: ${memberResult.failures.length + logResult.failures.length}`,
    );
    return;
  }

  const logImport = await upsertLogs(supabase, logResult.rows);

  console.log("Import finished.");
  console.log(`Members success: ${importedMembers.length}`);
  console.log(`Members failed: ${memberResult.failures.length}`);
  console.log(`Logs success: ${logImport.success}`);
  console.log(`Logs failed: ${logResult.failures.length + logImport.failed}`);
}

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;

  const env = readFileSync(filePath, "utf8");
  for (const line of env.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, "");

    process.env[key] ||= value;
  }
}

function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function getOrCreateCompany(
  supabase: ReturnType<typeof createSupabaseClient>,
) {
  const { data: existing, error: selectError } = await supabase
    .from("companies")
    .select("id,name")
    .eq("name", companyName)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string; name: string }>();

  if (selectError) throw selectError;
  if (existing) return existing;

  if (dryRun) {
    return { id: "00000000-0000-0000-0000-000000000000", name: companyName };
  }

  const { data, error } = await supabase
    .from("companies")
    .insert({ name: companyName })
    .select("id,name")
    .single<{ id: string; name: string }>();

  if (error) throw error;
  return data;
}

async function readCsvFile(filePath: string) {
  if (!existsSync(filePath)) {
    throw new Error(`CSV file not found: ${filePath}`);
  }

  return parseCsv(await readFile(filePath, "utf8"));
}

function parseCsv(input: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const text = input.replace(/^\uFEFF/, "");

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  const [headers, ...body] = rows.filter((items) =>
    items.some((item) => item.trim() !== ""),
  );
  if (!headers) return [];

  return body.map((items) =>
    Object.fromEntries(
      headers.map((header, index) => [header.trim(), (items[index] ?? "").trim()]),
    ),
  );
}

function transformMembers(rows: CsvRow[], companyId: string) {
  const failures: string[] = [];
  const members = rows.flatMap((row, index) => {
    try {
      return [
        {
          company_id: companyId,
          key: required(row.key, "key"),
          name: required(row.name, "name"),
          active: parseBoolean(row.active, true),
        },
      ];
    } catch (error) {
      failures.push(formatRowError(index, error));
      return [];
    }
  });

  return { rows: members, failures };
}

function transformLogs(
  rows: CsvRow[],
  companyId: string,
  memberByKey: Map<string, MemberRecord>,
) {
  const failures: string[] = [];
  const logs = rows.flatMap((row, index) => {
    try {
      const key = required(row.key, "key");
      const member = memberByKey.get(key);
      if (!member) throw new Error(`member not found for key: ${key}`);

      const date = parseDateKey(required(row.date, "date"));

      return [
        {
          company_id: companyId,
          member_id: member.id,
          date,
          work_type: parseWorkType(row.workType),
          break_flag: parseBoolean(row.breakFlag, false),
          clock_in: parseDateTime(row.clockIn, date),
          clock_out: parseDateTime(row.clockOut, date),
          work_minutes: parseNullableInteger(row.workMinutes),
          overtime_minutes: parseNullableInteger(row.overtimeMinutes),
          note: row.note?.trim() ?? "",
        },
      ];
    } catch (error) {
      failures.push(formatRowError(index, error));
      return [];
    }
  });

  return { rows: logs, failures };
}

async function upsertMembers(
  supabase: ReturnType<typeof createSupabaseClient>,
  members: ImportMember[],
  companyId: string,
) {
  if (members.length > 0) {
    const { error } = await supabase.from("members").upsert(members, {
      onConflict: "company_id,key",
    });

    if (error) throw error;
  }

  const keys = members.map((member) => member.key);
  if (keys.length === 0) return [];

  const { data, error } = await supabase
    .from("members")
    .select("id,company_id,key,name")
    .eq("company_id", companyId)
    .in("key", keys)
    .returns<MemberRecord[]>();

  if (error) throw error;
  return data ?? [];
}

async function upsertLogs(
  supabase: ReturnType<typeof createSupabaseClient>,
  logs: ImportLog[],
) {
  if (logs.length === 0) return { success: 0, failed: 0 };

  const { error } = await supabase.from("attendance_logs").upsert(logs, {
    onConflict: "member_id,date",
  });

  if (error) {
    console.error(`attendance_logs upsert failed: ${error.message}`);
    return { success: 0, failed: logs.length };
  }

  return { success: logs.length, failed: 0 };
}

function buildDryRunMembers(members: ImportMember[]): MemberRecord[] {
  return members.map((member) => ({
    id: `dry-run-${member.key}`,
    company_id: member.company_id,
    key: member.key,
    name: member.name,
  }));
}

function parseWorkType(value: string | undefined): "normal" | "kitchen_car" {
  const normalized = (value ?? "").trim().toLowerCase();

  if (["normal", "regular", "通常勤務", "通常", "一般"].includes(normalized)) {
    return "normal";
  }

  if (
    [
      "kitchen_car",
      "kitchen-car",
      "kitchen car",
      "キッチンカー",
      "ｷｯﾁﾝｶｰ",
    ].includes(normalized)
  ) {
    return "kitchen_car";
  }

  throw new Error(`unknown workType: ${value}`);
}

function parseBoolean(value: string | undefined, defaultValue: boolean) {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) return defaultValue;
  if (["true", "t", "1", "yes", "y", "on", "あり", "有効"].includes(normalized)) {
    return true;
  }
  if (["false", "f", "0", "no", "n", "off", "なし", "無効"].includes(normalized)) {
    return false;
  }
  throw new Error(`invalid boolean: ${value}`);
}

function parseNullableInteger(value: string | undefined) {
  const normalized = (value ?? "").trim();
  if (!normalized) return null;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`invalid number: ${value}`);
  }

  return Math.trunc(parsed);
}

function parseDateKey(value: string) {
  const normalized = value.trim();

  if (/^\d+(\.\d+)?$/.test(normalized)) {
    return dateKeyFromExcelSerial(Number(normalized));
  }

  const match = normalized.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (!match) throw new Error(`invalid date: ${value}`);

  const [, year, month, day] = match;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function parseDateTime(value: string | undefined, dateKey: string) {
  const normalized = (value ?? "").trim();
  if (!normalized) return null;

  if (/^\d+(\.\d+)?$/.test(normalized)) {
    return isoFromExcelSerial(Number(normalized));
  }

  const timeOnly = normalized.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeOnly) {
    const [, hour, minute, second = "00"] = timeOnly;
    return japaneseLocalToIso(dateKey, hour, minute, second);
  }

  const dateTime = normalized.match(
    /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[ T]+)(\d{1,2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (dateTime) {
    const [, year, month, day, hour, minute, second = "00"] = dateTime;
    return japaneseLocalToIso(
      `${year}-${pad2(month)}-${pad2(day)}`,
      hour,
      minute,
      second,
    );
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`invalid datetime: ${value}`);
  }

  return parsed.toISOString();
}

function japaneseLocalToIso(
  dateKey: string,
  hour: string,
  minute: string,
  second: string,
) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      Number(hour) - 9,
      Number(minute),
      Number(second),
    ),
  ).toISOString();
}

function dateKeyFromExcelSerial(serial: number) {
  return isoFromExcelSerial(serial).slice(0, 10);
}

function isoFromExcelSerial(serial: number) {
  const excelEpoch = Date.UTC(1899, 11, 30);
  return new Date(excelEpoch + serial * 24 * 60 * 60 * 1000).toISOString();
}

function required(value: string | undefined, label: string) {
  const normalized = (value ?? "").trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function pad2(value: string | number) {
  return String(value).padStart(2, "0");
}

function formatRowError(index: number, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return `row ${index + 2}: ${message}`;
}

function printFailures(label: string, failures: string[]) {
  if (failures.length === 0) return;

  console.log(`${label} failures: ${failures.length}`);
  for (const failure of failures.slice(0, 20)) {
    console.log(`- ${failure}`);
  }
  if (failures.length > 20) {
    console.log(`- ...and ${failures.length - 20} more`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
