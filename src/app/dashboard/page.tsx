"use client";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { SalesTimecardApp } from "@/components/SalesTimecardApp";

export default function DashboardPage() {
  return (
    <RequireAuth>
      <SalesTimecardApp />
    </RequireAuth>
  );
}
