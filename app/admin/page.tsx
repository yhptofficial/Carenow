"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCareNow, useStore, type AccountRow } from "@/lib/store";
import { Avatar, Button, Card, Notice } from "@/components/ui";
import { CareNowLogo } from "@/components/Logo";
import { AlertIcon, ChevronRightIcon, ShieldIcon } from "@/components/Icons";
import { initialsOf } from "@/lib/db";

/**
 * Operations sign-in.
 *
 * The third door into the app. Patients come in at `/onboarding`, clinicians at
 * `/doctor`, and CareNow staff here — same app, three different jobs. In
 * production this is a Supabase Auth sign-in whose JWT claim `role = 'admin'`
 * is what the `is_admin()` policies in `supabase/schema.sql` key off.
 *
 * One admin role, no tiers: an account either holds a seat or it does not, and
 * holding one is sufficient for everything the console does. So this screen
 * lists every seat in the system rather than a privileged subset, and any of
 * them will do.
 */
export default function AdminSignInPage() {
  const store = useStore();
  const { ready } = useCareNow();
  const router = useRouter();
  const [picking, setPicking] = useState(false);

  const seat = store.adminSession;
  const seats = store.accountDirectory().filter((row) => row.admin);

  if (!ready) return <div className="min-h-[100dvh]" />;

  return (
    <div className="flex min-h-[100dvh] flex-col px-gutter pt-[max(28px,var(--safe-t))]">
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <CareNowLogo />
          <span className="rounded-pill bg-ink px-3 py-1.5 text-[11px] font-semibold text-white">
            Operations
          </span>
        </div>

        <div className="mt-8">
          <h1 className="text-screen font-bold text-ink">Admin console</h1>
          <p className="mt-2 text-[13px] leading-6 text-ink-muted">
            Check clinician credentials against the MDCN register, watch what the platform is
            collecting, and decide who else gets a seat in here.
          </p>
        </div>

        {seat ? (
          <Card className="mt-6 p-4">
            <div className="flex items-center gap-3">
              <Avatar initials={initialsOf(seat.fullName)} accent="teal" size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-card font-semibold text-ink">{seat.fullName}</p>
                <p className="truncate text-sub text-ink-muted">
                  Admin · {seat.email}
                </p>
              </div>
            </div>
            <Button full className="mt-4" onClick={() => router.push("/admin/dashboard")}>
              Open the console
            </Button>
            <Button
              variant="ghost"
              full
              className="mt-2"
              onClick={() => {
                store.signOutAdmin();
                setPicking(false);
              }}
            >
              Sign out
            </Button>
          </Card>
        ) : null}

        <Card className="mt-6 p-4">
          <h2 className="text-[14px] font-semibold text-ink">
            {seat ? "Switch operator" : "Sign in to your staff account"}
          </h2>
          <p className="mt-1 text-sub leading-5 text-ink-muted">
            Production signs staff in with a one-time code to their CareNow address. This build lets
            you pick any account holding the admin role.
          </p>

          {!picking && !seat ? (
            <Button full className="mt-4" onClick={() => setPicking(true)}>
              Choose a staff account
            </Button>
          ) : null}

          {picking || seat ? (
            <ul className="mt-4 space-y-2">
              {seats.map((row) => (
                <li key={row.id}>
                  <SeatButton
                    row={row}
                    onPick={() => {
                      store.signInAdmin(row.email ?? "");
                      router.push("/admin/dashboard");
                    }}
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </Card>

        <Notice tone="warn" icon={<AlertIcon size={18} />} title="A seat reads everything">
          An admin can read every health record, prescription and audit line on the platform — and
          can hand the same powers to anybody else. There is one admin role, with no tiers, so a
          seat here is a master key rather than a staff badge. The database trigger
          `guard_profile_role()` is what stops a profile granting the role to itself.
        </Notice>

        <Notice tone="info" icon={<ShieldIcon size={18} />} title="Nigeria Data Protection Act">
          Credential checks are logged with the reviewer, the decision and the registration number
          they verified. The console shows patients as account holders — ages, addresses and health
          history are deliberately out of scope for this screen.
        </Notice>
      </div>

      <footer className="space-y-2 py-6 text-center">
        <Link href="/doctor" className="block text-[12px] font-medium text-ink-muted underline">
          I&apos;m a clinician — go to the consult desk
        </Link>
        <Link href="/onboarding" className="block text-[12px] font-medium text-ink-muted underline">
          I&apos;m a patient — go to CareNow
        </Link>
      </footer>
    </div>
  );
}

function SeatButton({ row, onPick }: { row: AccountRow; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex w-full items-center gap-3 rounded-2xl border border-line px-3.5 py-3 text-left pressable hover:border-primary hover:bg-primary-tint/40"
    >
      <Avatar initials={initialsOf(row.fullName)} accent="purple" size={36} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-ink">{row.fullName}</span>
        <span className="block truncate text-[11px] text-ink-muted">
          {row.email}
          {row.bookings !== undefined ? ` · ${row.bookings} consultations` : ""}
        </span>
      </span>
      <span className="shrink-0 rounded-pill bg-primary-tint px-2.5 py-1 text-[11px] font-semibold text-primary-dark">
        Admin
      </span>
      <span className="text-ink-muted">
        <ChevronRightIcon size={18} />
      </span>
    </button>
  );
}
