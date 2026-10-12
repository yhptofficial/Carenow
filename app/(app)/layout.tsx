import type { ReactNode } from "react";
import { RequireAuth } from "@/components/AppShell";

/**
 * Tab screens share the floating bottom navigation. Detail and flow screens sit
 * outside this group so the consult room and checkout stay distraction-free.
 */
export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth nav skeleton="list">
      {children}
    </RequireAuth>
  );
}
