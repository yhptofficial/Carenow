"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCareNow, useStore } from "@/lib/store";
import { Avatar, Button, Card, Notice } from "@/components/ui";
import { CareNowLogo } from "@/components/Logo";
import { AlertIcon, ChevronRightIcon, ShieldIcon } from "@/components/Icons";
import { initialsOf } from "@/lib/db";

/**
 * Clinician sign-in.
 *
 * Deliberately separate from the patient flow: same app, different door. In
 * production this is a Supabase Auth sign-in whose JWT claim `role = 'doctor'`
 * drives the RLS policies in `supabase/schema.sql`.
 */
export default function DoctorSignInPage() {
  const store = useStore();
  const { ready, doctorSession } = useCareNow();
  const router = useRouter();
  const [picking, setPicking] = useState(false);

  const roster = store.verifiedDoctors();
  const pending = store.unverifiedDoctors();

  if (!ready) return <div className="min-h-[100dvh]" />;

  return (
    <div className="flex min-h-[100dvh] flex-col px-gutter pt-[max(28px,var(--safe-t))]">
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <CareNowLogo />
          <span className="rounded-pill bg-primary-tint px-3 py-1.5 text-[11px] font-semibold text-primary-dark">
            Clinician
          </span>
        </div>

        <div className="mt-8">
          <h1 className="text-screen font-bold text-ink">Consult desk</h1>
          <p className="mt-2 text-[13px] leading-6 text-ink-muted">
            See who&apos;s waiting, read their intake notes before you connect, and issue a
            prescription the moment the call ends.
          </p>
        </div>

        {doctorSession ? (
          <Card className="mt-6 p-4">
            <div className="flex items-center gap-3">
              <Avatar
                initials={initialsOf(doctorSession.fullName)}
                accent={doctorSession.accent}
                size={44}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-card font-semibold text-ink">{doctorSession.fullName}</p>
                <p className="truncate text-sub text-ink-muted">{doctorSession.qualifications}</p>
              </div>
            </div>
            <Button full className="mt-4" onClick={() => router.push("/doctor/dashboard")}>
              Open today&apos;s queue
            </Button>
            <Button
              variant="ghost"
              full
              className="mt-2"
              onClick={() => {
                store.signOut();
                setPicking(false);
              }}
            >
              Sign out
            </Button>
          </Card>
        ) : null}

        <Card className="mt-6 p-4">
          <h2 className="text-[14px] font-semibold text-ink">
            {doctorSession ? "Switch clinician" : "Sign in to your clinic account"}
          </h2>
          <p className="mt-1 text-sub leading-5 text-ink-muted">
            Production sends a one-time code to your registered medical email. This build lets you
            pick a verified clinician from the roster.
          </p>

          {!picking && !doctorSession ? (
            <Button full className="mt-4" onClick={() => setPicking(true)}>
              Choose a clinician
            </Button>
          ) : null}

          {picking || doctorSession ? (
            <ul className="mt-4 space-y-2">
              {roster.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => {
                      store.signInDoctor(d.id);
                      router.push("/doctor/dashboard");
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl border border-line px-3.5 py-3 text-left pressable hover:border-primary hover:bg-primary-tint/40"
                  >
                    <Avatar initials={initialsOf(d.fullName)} accent={d.accent} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink">
                        {d.fullName}
                      </span>
                      <span className="block truncate text-[11px] text-ink-muted">
                        {d.qualifications} · {d.email}
                      </span>
                    </span>
                    <span className="text-ink-muted">
                      <ChevronRightIcon size={18} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>

        {pending.length > 0 ? (
          <Notice tone="warn" icon={<AlertIcon size={18} />} title="Awaiting verification">
            {pending.length} doctor {pending.length === 1 ? "application is" : "applications are"} in
            the queue. Unverified clinicians can sign in, but they never appear in patient search and
            can&apos;t accept bookings. That gate is enforced in the database, not just the UI.
          </Notice>
        ) : null}

        <Notice tone="info" icon={<ShieldIcon size={18} />} title="Clinical duty of care">
          A CareNow consultation is a real doctor–patient relationship. You must be licensed in the
          jurisdiction you&apos;re practising in, and you can&apos;t prescribe controlled substances
          over video.
        </Notice>
      </div>

      <footer className="py-6 text-center">
        <Link href="/onboarding" className="text-[12px] font-medium text-ink-muted underline">
          I&apos;m a patient — go to CareNow
        </Link>
      </footer>
    </div>
  );
}
