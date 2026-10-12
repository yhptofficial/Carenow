import type { Metadata } from "next";
import Link from "next/link";
import { AlertIcon } from "@/components/Icons";

export const metadata: Metadata = {
  title: "You're offline",
  robots: { index: false },
};

/**
 * Offline fallback served by the service worker when a navigation fails and
 * there is no cached copy of that screen. Written as a static page so it is
 * guaranteed to be in the precache.
 */
export default function OfflinePage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-gutter text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-primary-tint text-primary-dark">
        <AlertIcon size={28} />
      </span>
      <h1 className="mt-5 text-screen font-bold text-ink">You&apos;re offline</h1>
      <p className="mt-2 max-w-[320px] text-[13px] leading-6 text-ink-muted">
        CareNow needs a connection to load your records and open a consultation room. Anything already
        open on screen still works.
      </p>

      <ul className="mt-6 w-full max-w-[340px] space-y-2.5 text-left">
        {[
          "Check your mobile data or Wi-Fi.",
          "If you're mid-consultation, reconnect on Wi-Fi — video tolerates a brief drop.",
          "Your booking is still held; nothing is cancelled by losing signal.",
        ].map((t) => (
          <li key={t} className="card px-4 py-3 text-[12px] leading-5 text-ink-muted">
            {t}
          </li>
        ))}
      </ul>

      <Link
        href="/"
        className="mt-6 inline-flex h-11 items-center rounded-pill bg-primary px-6 text-[14px] font-semibold text-white pressable"
      >
        Try again
      </Link>
    </div>
  );
}
