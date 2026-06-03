import { notFound } from "next/navigation";
import { TimecardApp } from "@/components/TimecardApp";
import { isReservedMemberKey } from "@/lib/reserved-routes";
import { loadInitialTimecardData } from "@/lib/timecard-initial-data";

export default async function EmployeeTimecardPage({
  params,
}: {
  params: Promise<{ employeeKey: string }>;
}) {
  const { employeeKey } = await params;
  const normalizedEmployeeKey = decodeURIComponent(employeeKey).trim();

  if (isReservedMemberKey(normalizedEmployeeKey)) {
    notFound();
  }

  const initial = await loadInitialTimecardData(normalizedEmployeeKey);

  return (
    <TimecardApp
      employeeKey={normalizedEmployeeKey}
      initialData={initial.data}
      initialMessage={initial.message}
    />
  );
}
