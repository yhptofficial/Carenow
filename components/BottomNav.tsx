"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, FindIcon, HomeIcon, ProfileIcon } from "./Icons";

/**
 * Floating bottom navigation.
 *
 * Four items. The active tab is a teal filled pill holding a white icon *and*
 * its label; inactive tabs are grey outline icons only. Inset from the screen
 * edges with a stronger shadow than a card.
 */

const ITEMS = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/find", label: "Find", Icon: FindIcon },
  { href: "/bookings", label: "Bookings", Icon: CalendarIcon },
  { href: "/profile", label: "Profile", Icon: ProfileIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 z-40 flex justify-center px-3"
      style={{ bottom: "calc(var(--nav-inset) + var(--safe-b))" }}
    >
      <ul className="flex w-full max-w-[416px] items-center justify-between gap-1 rounded-nav bg-surface p-1.5 shadow-nav">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="min-w-0 flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={label}
                className={[
                  "flex h-12 items-center justify-center rounded-nav pressable",
                  active
                    ? "gap-2 bg-primary px-4 text-white"
                    : "text-ink-muted hover:text-ink",
                ].join(" ")}
              >
                <Icon size={22} />
                {active ? (
                  <span className="text-chip font-medium whitespace-nowrap">{label}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
