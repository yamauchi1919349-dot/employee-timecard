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
          { id: "P001", name: "守屋モリエ" },
          { id: "P002", name: "長谷川恵子" },
          { id: "P003", name: "佐々木美和" },
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
