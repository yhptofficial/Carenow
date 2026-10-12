"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "./ui";
import { ChevronLeftIcon } from "./Icons";
import type { ReactNode } from "react";

/**
 * Header.
 *
 * Two shapes, both following the style guide:
 *  - `ScreenHeader` — small location label above a bold page title, user
 *    initials avatar top-right. Used on the four tab screens.
 *  - `DetailHeader` — back chevron, centred title, optional trailing action.
 */

export function ScreenHeader({
  context,
  title,
  initials,
  accent = "teal",
  avatarHref = "/profile",
  sticky = false,
}: {
  /** Small secondary line above the title, e.g. "Lagos · Good morning". */
  context?: ReactNode;
  title: string;
  initials?: string;
  accent?: "teal" | "blue" | "purple";
  avatarHref?: string | null;
  sticky?: boolean;
}) {
  return (
    <header
      className={[
        "flex items-start justify-between gap-4 px-gutter pb-4",
        sticky ? "sticky top-0 z-30 bg-canvas/95 backdrop-blur-md pt-[max(20px,var(--safe-t))]" : "pt-[max(20px,var(--safe-t))]",
      ].join(" ")}
    >
      <div className="min-w-0">
        {context ? <p className="text-context text-ink-muted">{context}</p> : null}
        <h1 className="text-screen font-bold text-ink">{title}</h1>
      </div>
      {avatarHref && initials ? (
        <Link
          href={avatarHref}
          className="mt-0.5 rounded-full pressable"
          aria-label="Your profile"
        >
          <Avatar initials={initials} accent={accent} size={32} />
        </Link>
      ) : null}
    </header>
  );
}

export function DetailHeader({
  title,
  subtitle,
  trailing,
  backHref,
  onBack,
}: {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  /** Falls back to browser history when omitted. */
  backHref?: string;
  onBack?: () => void;
}) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 bg-canvas/95 px-gutter pb-3 pt-[max(16px,var(--safe-t))] backdrop-blur-md">
      {backHref ? (
        <Link
          href={backHref}
          aria-label="Go back"
          className="-ml-2 grid h-10 w-10 place-items-center rounded-full text-ink pressable hover:bg-surface"
        >
          <ChevronLeftIcon size={22} />
        </Link>
      ) : (
        <button
          type="button"
          aria-label="Go back"
          onClick={onBack ?? (() => router.back())}
          className="-ml-2 grid h-10 w-10 place-items-center rounded-full text-ink pressable hover:bg-surface"
        >
          <ChevronLeftIcon size={22} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] font-bold leading-5 text-ink">{title}</p>
        {subtitle ? <p className="truncate text-sub text-ink-muted">{subtitle}</p> : null}
      </div>
      {trailing}
    </header>
  );
}
