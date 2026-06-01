import { GroupStaffConfig } from "./types";

export const groupStaffConfigs: Record<string, GroupStaffConfig[]> = {
  pato: [
    { id: "P001", name: "田中" },
    { id: "P002", name: "佐藤" },
    { id: "P003", name: "鈴木" },
  ],
};

export function getGroupStaffConfigs(employeeKey: string) {
  return groupStaffConfigs[employeeKey] ?? null;
}

export function getGroupStaffConfig(employeeKey: string, staffId?: string | null) {
  if (!staffId) return null;
  return getGroupStaffConfigs(employeeKey)?.find((staff) => staff.id === staffId) ?? null;
}
