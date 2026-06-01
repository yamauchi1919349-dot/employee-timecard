import { getTimecardData } from "@/lib/attendance-service";

export async function loadInitialTimecardData(key?: string) {
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
