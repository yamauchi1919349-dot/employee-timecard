import { TimecardApp } from "@/components/TimecardApp";
import { getTimecardData } from "@/lib/attendance-service";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ k?: string }>;
}) {
  const { k } = await searchParams;
  const initial = await loadInitialData(k);
  return (
    <TimecardApp
      employeeKey={k ?? null}
      initialData={initial.data}
      initialMessage={initial.message}
    />
  );
}

async function loadInitialData(key?: string) {
  if (!key) return { data: null, message: "" };

  try {
    const data = await getTimecardData(key);
    return {
      data,
      message: data ? "" : "従業員が見つかりません。",
    };
  } catch (error) {
    return {
      data: null,
      message:
        error instanceof Error ? error.message : "初期表示データの取得に失敗しました。",
    };
  }
}
