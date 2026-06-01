import { TimecardApp } from "@/components/TimecardApp";
import { loadInitialTimecardData } from "@/lib/timecard-initial-data";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ k?: string }>;
}) {
  const { k } = await searchParams;
  const employeeKey = k?.trim() || null;
  const initial = await loadInitialTimecardData(employeeKey ?? undefined);
  return (
    <TimecardApp
      employeeKey={employeeKey}
      initialData={initial.data}
      initialMessage={initial.message}
    />
  );
}
