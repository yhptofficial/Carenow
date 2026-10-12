"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCareNow } from "@/lib/store";
import { Skeleton } from "./ui";
import { BottomNav } from "./BottomNav";

/**
 * Client gate for every signed-in screen.
 *
 * The store reads localStorage, so the very first render is always "not ready".
 * We render a skeleton for that single frame rather than an empty state, which
 * avoids a flash of "no bookings yet" for people who do have bookings.
 */
export function RequireAuth({
  children,
  nav = false,
  skeleton = "default",
}: {
  children: ReactNode;
  /** Show the floating bottom navigation (the four tab screens do). */
  nav?: boolean;
  skeleton?: "default" | "list" | "detail";
}) {
  const { ready, session } = useCareNow();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!ready || session) return;
    // Preserve the query string so a shared deep link survives sign-in.
    const search = typeof window === "undefined" ? "" : window.location.search;
    router.replace(`/onboarding?next=${encodeURIComponent(`${pathname}${search}`)}`);
  }, [ready, session, router, pathname]);

  if (!ready || !session) {
    return (
      <>
        <ScreenSkeleton variant={skeleton} />
        {nav ? <BottomNav /> : null}
      </>
    );
  }

  return (
    <>
      {children}
      {nav ? <BottomNav /> : null}
    </>
  );
}

function ScreenSkeleton({ variant }: { variant: "default" | "list" | "detail" }) {
  return (
    <div className="app-scroll pt-[max(20px,var(--safe-t))]" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-44" />
      </div>
      {variant !== "detail" ? <Skeleton className="mb-5 h-12 w-full rounded-pill" /> : null}
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="card p-card">
            <div className="flex items-center gap-3">
              <Skeleton className="h-11 w-11 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-4 w-28 rounded-pill" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Sticky footer used by the booking flow, sitting above the safe area.
 */
export function StickyFooter({ children }: { children: ReactNode }) {
  return (
    <div
      className="sticky bottom-0 z-30 mt-auto border-t border-line bg-canvas/95 px-gutter pt-3 backdrop-blur-md"
      style={{ paddingBottom: "calc(12px + var(--safe-b))" }}
    >
      {children}
    </div>
  );
}
