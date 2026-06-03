import { TimecardApp } from "@/components/TimecardApp";
import { isReservedMemberKey } from "@/lib/reserved-routes";
import { loadInitialTimecardData } from "@/lib/timecard-initial-data";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ k?: string }>;
}) {
  const { k } = await searchParams;
  const requestedKey = k?.trim() || null;
  const employeeKey =
    requestedKey && !isReservedMemberKey(requestedKey) ? requestedKey : null;
  const initial = await loadInitialTimecardData(employeeKey ?? undefined);
  return (
    <TimecardApp
      employeeKey={employeeKey}
      initialData={initial.data}
      initialMessage={initial.message}
    />
  );
}
