import Link from "next/link";
import { formatLocalDateTime, formatMinutes, getWorkTypeLabel } from "@/lib/attendance";
import { createSupabaseAdmin } from "@/lib/supabase";
import { AttendanceLog, Member } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const result = await loadAdminData();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">確認用</p>
            <h1 className="text-2xl font-bold">簡易管理画面</h1>
          </div>
          <Link
            href="/"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold"
          >
            タイムカード
          </Link>
        </header>

        {result.error ? (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
            {result.error}
          </section>
        ) : (
          <>
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold">members</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">name</th>
                      <th className="py-2 pr-4">key</th>
                      <th className="py-2 pr-4">active</th>
                      <th className="py-2 pr-4">company_id</th>
                      <th className="py-2 pr-4">created_at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.members.map((member) => (
                      <tr key={member.id} className="border-b border-slate-100">
                        <td className="py-3 pr-4 font-semibold">{member.name}</td>
                        <td className="py-3 pr-4">{member.key}</td>
                        <td className="py-3 pr-4">{member.active ? "true" : "false"}</td>
                        <td className="py-3 pr-4 font-mono text-xs">{member.company_id}</td>
                        <td className="py-3 pr-4">{formatLocalDateTime(member.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold">attendance_logs</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">date</th>
                      <th className="py-2 pr-4">member</th>
                      <th className="py-2 pr-4">type</th>
                      <th className="py-2 pr-4">break</th>
                      <th className="py-2 pr-4">clock_in</th>
                      <th className="py-2 pr-4">clock_out</th>
                      <th className="py-2 pr-4">work</th>
                      <th className="py-2 pr-4">overtime</th>
                      <th className="py-2 pr-4">note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.logs.map((log) => (
                      <tr key={log.id} className="border-b border-slate-100">
                        <td className="py-3 pr-4 font-semibold">{log.date}</td>
                        <td className="py-3 pr-4">{log.members?.name ?? log.member_id}</td>
                        <td className="py-3 pr-4">{getWorkTypeLabel(log.work_type)}</td>
                        <td className="py-3 pr-4">{log.break_flag ? "あり" : "なし"}</td>
                        <td className="py-3 pr-4">{formatLocalDateTime(log.clock_in)}</td>
                        <td className="py-3 pr-4">{formatLocalDateTime(log.clock_out)}</td>
                        <td className="py-3 pr-4">{formatMinutes(log.work_minutes)}</td>
                        <td className="py-3 pr-4">{formatMinutes(log.overtime_minutes)}</td>
                        <td className="max-w-xs py-3 pr-4">{log.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

async function loadAdminData(): Promise<
  | { members: Member[]; logs: AttendanceLog[]; error: null }
  | { members: []; logs: []; error: string }
> {
  try {
    const supabase = createSupabaseAdmin();
    const [membersResult, logsResult] = await Promise.all([
      supabase
        .from("members")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("attendance_logs")
        .select("*, members(name, key)")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    if (membersResult.error) throw membersResult.error;
    if (logsResult.error) throw logsResult.error;

    return {
      members: (membersResult.data ?? []) as Member[],
      logs: (logsResult.data ?? []) as AttendanceLog[],
      error: null,
    };
  } catch (error) {
    return {
      members: [],
      logs: [],
      error:
        error instanceof Error
          ? error.message
          : "管理画面データの取得に失敗しました。",
    };
  }
}

