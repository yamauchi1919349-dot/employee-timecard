import { TimecardApp } from "@/components/TimecardApp";
import { loadInitialTimecardData } from "@/lib/timecard-initial-data";

export default async function EmployeeTimecardPage({
  params,
}: {
  params: Promise<{ employeeKey: string }>;
}) {
  const { employeeKey } = await params;
  const normalizedEmployeeKey = decodeURIComponent(employeeKey).trim();
  const initial = await loadInitialTimecardData(normalizedEmployeeKey);

  return (
    <TimecardApp
      employeeKey={normalizedEmployeeKey}
      initialData={initial.data}
      initialMessage={initial.message}
    />
  );
}
