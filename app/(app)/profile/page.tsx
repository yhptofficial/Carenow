"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCareNow, useStore } from "@/lib/store";
import { signOutOfSupabase } from "@/lib/supabase/auth";
import { ScreenHeader } from "@/components/AppHeader";
import { Avatar, Button, Card, Chevron, Notice, Sheet, useToast } from "@/components/ui";
import {
  AlertIcon,
  BellIcon,
  DownloadIcon,
  HistoryIcon,
  LockIcon,
  NoteIcon,
  PillIcon,
  ShieldIcon,
  VideoIcon,
} from "@/components/Icons";
import { initialsOf } from "@/lib/db";

export default function ProfilePage() {
  const store = useStore();
  const { session } = useCareNow();
  const router = useRouter();
  const toast = useToast();
  const [showSignOut, setShowSignOut] = useState(false);
  const [showReset, setShowReset] = useState(false);

  if (!session) return null;

  const prescriptions = store.myPrescriptions();
  const completed = store.pastBookings().filter((b) => b.status === "completed");
  const initials = initialsOf(session.fullName);

  return (
    <div className="app-scroll pt-[max(20px,var(--safe-t))]">
      <ScreenHeader
        context={session.location}
        title="Profile"
        initials={initials}
        accent={session.accent}
        avatarHref={null}
      />

      <div className="space-y-section">
        {/* -------- Identity -------- */}
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <Avatar initials={initials} accent={session.accent} size={56} className="text-[19px]" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[16px] font-bold text-ink">{session.fullName}</h2>
              <p className="truncate text-sub text-ink-muted">
                {session.email ?? session.phone ?? "No contact saved"}
              </p>
              {session.age ? (
                <p className="mt-0.5 text-sub text-ink-muted">
                  {session.age} yrs{session.gender && session.gender !== "undisclosed" ? ` · ${session.gender}` : ""}
                </p>
              ) : null}
            </div>
            <Chevron />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
            <Stat label="Consultations" value={completed.length} />
            <Stat label="Prescriptions" value={prescriptions.length} />
            <Stat label="Upcoming" value={store.upcomingBookings().length} />
          </div>

          <Link
            href="/profile/health"
            className="mt-4 flex h-10 items-center justify-center rounded-pill border border-line text-[13px] font-semibold text-ink pressable hover:border-primary hover:text-primary-dark"
          >
            Edit health information
          </Link>
        </Card>

        {/* -------- Health snapshot -------- */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-ink">Your health snapshot</h3>
            <Link href="/profile/health" className="text-chip font-medium text-primary-dark">
              Manage
            </Link>
          </div>
          <dl className="mt-3 space-y-3 text-[13px]">
            <SnapshotRow label="Allergies" values={session.allergies} fallback="None recorded" tone="danger" />
            <SnapshotRow label="Conditions" values={session.conditions} fallback="None recorded" />
            <SnapshotRow
              label="Current medication"
              values={session.currentMedications}
              fallback="None recorded"
            />
          </dl>
          <p className="mt-3 text-[11px] leading-5 text-ink-muted">
            This is shared with a doctor only for the consultations you book with them.
          </p>
        </Card>

        {/* -------- Records -------- */}
        <section>
          <h3 className="mb-3 text-[15px] font-semibold text-ink">Records</h3>
          <Card className="divide-y divide-line overflow-hidden p-0">
            <Row
              href="/profile/records"
              icon={<HistoryIcon size={20} />}
              title="Visit history"
              subtitle={`${completed.length} completed consultation${completed.length === 1 ? "" : "s"}`}
            />
            <Row
              href="/profile/prescriptions"
              icon={<PillIcon size={20} />}
              title="Prescriptions"
              subtitle={`${prescriptions.length} on file — download any of them`}
            />
            <Row
              href="/profile/consent"
              icon={<NoteIcon size={20} />}
              title="Consent & permissions"
              subtitle={
                session.consent?.healthDataConsent
                  ? `Agreed ${new Date(session.consent.acceptedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`
                  : "Action needed — doctors can't read your notes yet"
              }
              tone={session.consent?.healthDataConsent ? undefined : "warn"}
            />
          </Card>
        </section>

        {/* -------- Settings -------- */}
        <section>
          <h3 className="mb-3 text-[15px] font-semibold text-ink">Settings</h3>
          <Card className="divide-y divide-line overflow-hidden p-0">
            <Row
              href="/profile/notifications"
              icon={<BellIcon size={20} />}
              title="Reminders"
              subtitle={`${session.reminderChannels.join(" and ") || "Off"} · 30 minutes before`}
            />
            <Row
              href="/legal/privacy"
              icon={<LockIcon size={20} />}
              title="Privacy & data"
              subtitle="How your health information is used"
            />
            <Row
              href="/legal/terms"
              icon={<ShieldIcon size={20} />}
              title="Terms of service"
              subtitle="Version 2026-02-01"
            />
          </Card>
        </section>

        {/* -------- Doctor entry point -------- */}
        <Card className="flex items-start gap-3 p-4">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-canvas text-ink-muted">
            <VideoIcon size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-ink">Are you a doctor?</p>
            <p className="mt-0.5 text-sub leading-5 text-ink-muted">
              The clinician dashboard runs the same CareNow app with a different sign-in.
            </p>
            <Link
              href="/doctor"
              className="mt-2 inline-flex h-9 items-center rounded-pill bg-primary-tint px-3.5 text-chip font-medium text-primary-dark pressable"
            >
              Open clinician sign-in
            </Link>
          </div>
        </Card>

        {/* -------- Account actions -------- */}
        <Card className="overflow-hidden p-0">
          <button
            type="button"
            onClick={() => setShowSignOut(true)}
            className="flex w-full items-center justify-between px-4 py-3.5 text-left pressable hover:bg-canvas"
          >
            <span className="text-[13px] font-medium text-ink">Sign out</span>
            <Chevron />
          </button>
          <button
            type="button"
            onClick={() => setShowReset(true)}
            className="flex w-full items-center justify-between border-t border-line px-4 py-3.5 text-left pressable hover:bg-canvas"
          >
            <span className="text-[13px] font-medium text-ink-muted">Reset demo data</span>
            <Chevron />
          </button>
        </Card>

        <Notice tone="info" icon={<DownloadIcon size={18} />} title="Your data, on request">
          Any record can be downloaded or printed from its own screen. To export everything at once,
          or to delete your account entirely, contact privacy@carenow.health.
        </Notice>

        <p className="pb-2 text-center text-[11px] text-ink-muted">
          CareNow PWA v1.0.0 · built {new Date().getFullYear()}
        </p>
      </div>

      <Sheet
        open={showSignOut}
        onClose={() => setShowSignOut(false)}
        title="Sign out of CareNow?"
        footer={
          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="secondary" onClick={() => setShowSignOut(false)}>
              Stay signed in
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                store.signOut();
                void signOutOfSupabase();
                router.replace("/onboarding");
              }}
            >
              Sign out
            </Button>
          </div>
        }
      >
        <p className="text-[13px] leading-6 text-ink-muted">
          Your records stay on this device and will be here when you sign back in. On a shared phone,
          sign out so nobody else can open your prescriptions.
        </p>
        <Notice tone="warn" icon={<AlertIcon size={18} />} title="Shared device?">
          Anyone with access to this browser can read your visit history while you&apos;re signed in.
        </Notice>
      </Sheet>

      <Sheet
        open={showReset}
        onClose={() => setShowReset(false)}
        title="Reset demo data?"
        footer={
          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="secondary" onClick={() => setShowReset(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                store.reset();
                void signOutOfSupabase();
                setShowReset(false);
                toast("Demo data rebuilt from scratch.", "ok");
                router.replace("/onboarding");
              }}
            >
              Reset everything
            </Button>
          </div>
        }
      >
        <p className="text-[13px] leading-6 text-ink-muted">
          This clears everything stored on this device — bookings, prescriptions and your profile —
          and rebuilds the demo seed. Use it when you want a clean run through the flow.
        </p>
      </Sheet>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[19px] font-bold text-ink">{value}</p>
      <p className="mt-0.5 text-[11px] text-ink-muted">{label}</p>
    </div>
  );
}

function SnapshotRow({
  label,
  values,
  fallback,
  tone,
}: {
  label: string;
  values: string[];
  fallback: string;
  tone?: "danger";
}) {
  return (
    <div>
      <dt className="text-[11px] text-ink-muted">{label}</dt>
      <dd className="mt-1 flex flex-wrap gap-1.5">
        {values.length === 0 ? (
          <span className="text-ink-muted/80">{fallback}</span>
        ) : (
          values.map((v) => (
            <span
              key={v}
              className={[
                "rounded-pill px-2.5 py-1 text-[12px] font-medium",
                tone === "danger" ? "bg-[#FBEDED] text-danger" : "bg-primary-tint text-primary-dark",
              ].join(" ")}
            >
              {v}
            </span>
          ))
        )}
      </dd>
    </div>
  );
}

function Row({
  href,
  icon,
  title,
  subtitle,
  tone,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  tone?: "warn";
}) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3.5 pressable hover:bg-canvas">
      <span
        className={[
          "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
          tone === "warn" ? "bg-[#FDF3E3] text-warning" : "bg-primary-tint text-primary-dark",
        ].join(" ")}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-ink">{title}</span>
        {subtitle ? <span className="mt-0.5 block text-sub text-ink-muted">{subtitle}</span> : null}
      </span>
      <Chevron />
    </Link>
  );
}
