import { getMemberRuntimeConfig } from "./tenant-config";

export function getGroupStaffConfigs(employeeKey: string) {
  return getMemberRuntimeConfig(employeeKey)?.groupStaff ?? null;
}

export function getGroupStaffConfig(employeeKey: string, staffId?: string | null) {
  if (!staffId) return null;
  return getGroupStaffConfigs(employeeKey)?.find((staff) => staff.id === staffId) ?? null;
}
