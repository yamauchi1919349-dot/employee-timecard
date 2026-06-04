import { Suspense } from "react";
import {
  RootEntryLoading,
  RootEntryRedirect,
} from "@/components/RootEntryRedirect";

export default function Home() {
  return (
    <Suspense fallback={<RootEntryLoading />}>
      <RootEntryRedirect />
    </Suspense>
  );
}
