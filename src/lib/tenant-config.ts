import { GroupStaffConfig } from "./types";

export type MemberRuntimeConfig = {
  groupStaff?: GroupStaffConfig[];
};

export type CompanyRuntimeConfig = {
  companyKey: string;
  members: Record<string, MemberRuntimeConfig>;
};

export const companyRuntimeConfigs: CompanyRuntimeConfig[] = [
  {
    companyKey: "default",
    members: {
      pato: {
        groupStaff: [
          { id: "P001", name: "田中" },
          { id: "P002", name: "佐藤" },
          { id: "P003", name: "鈴木" },
        ],
      },
    },
  },
];

export function getMemberRuntimeConfig(employeeKey: string) {
  for (const companyConfig of companyRuntimeConfigs) {
    const memberConfig = companyConfig.members[employeeKey];
    if (memberConfig) return memberConfig;
  }

  return null;
}
