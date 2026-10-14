"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCareNow, useStore, type OpsAlert } from "@/lib/store";
import { Button, Card, Chip, EmptyState, Notice } from "@/components/ui";
import { DetailHeader } from "@/components/AppHeader";
import { VerificationPanel } from "@/components/AdminVerification";
import { AccountsPanel } from "@/components/AdminAccounts";
import { AuditPanel } from "@/components/AdminAudit";
import {
  AlertIcon,
  CalendarIcon,
  CardIcon,
  CheckCircleIcon,
  HistoryIcon,
  NoteIcon,
  ShieldIcon,
} from "@/components/Icons";
import { formatMoney } from "@/lib/currency";

/**
 * CareNow operations console.
 *
 * The third surface in the app, after the patient PWA and the clinician consult
 * desk, and the only one whose job is the platform rather than a consultation.
 * Four tabs, in the order an operator moves through a shift: what the numbers
 * look like, what needs a decision, who has access, then the trail behind all of
 * it.
 *
 * Nothing here reads clinical content. Admins can technically see every record
 * — the policies in `supabase/schema.sql` grant it — but a console that opens
 * patient files for no operational reason is a data-minimisation problem under
 * the NDPA, so it shows account holders and decisions instead.
 */
type Tab = "overview" | "verification" | "people" | "audit";

export default function AdminDashboardPage() {
  const store = useStore();
  const { ready } = useCareNow();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");

  const seat = store.adminSession;

  useEffect(() => {
    if (ready && !seat) router.replace("/admin");
  }, [ready, seat, router]);

  if (!ready || !seat) return <div className="min-h-[100dvh]" />;

  const queue = store.verificationQueue();

  return (
    <div className="app-scroll pt-[max(16px,var(--safe-t))]">
      <DetailHeader
        title="Operations"
        subtitle="CareNow platform"
        backHref="/admin"
        trailing={
          <button
            type="button"
            onClick={() => {
              store.signOutAdmin();
              router.replace("/admin");
            }}
            className="shrink-0 rounded-pill bg-canvas px-3 py-1.5 text-[11px] font-semibold text-ink-muted pressable hover:text-ink"
          >
            Admin
          </button>
        }
      />

      <div className="chip-row mb-5">
        <Chip label="Overview" active={tab === "overview"} onClick={() => setTab("overview")} />
        <Chip
          label={queue.length ? `Verification (${queue.length})` : "Verification"}
          active={tab === "verification"}
          onClick={() => setTab("verification")}
        />
        <Chip label="People" active={tab === "people"} onClick={() => setTab("people")} />
        <Chip label="Audit" active={tab === "audit"} onClick={() => setTab("audit")} />
      </div>

      {tab === "overview" ? <Overview onReview={() => setTab("verification")} /> : null}
      {tab === "verification" ? <VerificationPanel /> : null}
      {tab === "people" ? <AccountsPanel /> : null}
      {tab === "audit" ? <AuditPanel /> : null}
    </div>
  );
}

function Overview({ onReview }: { onReview: () => void }) {
  const store = useStore();
  const m = store.platformMetrics();
  const alerts = store.opsAlerts();
  const recent = store.auditLog().slice(0, 6);
  const names = new Map(store.accountDirectory().map((r) => [r.id, r.fullName]));
  names.set("system", "CareNow system");

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-[12px] text-ink-muted">Net collected</p>
            <p className="text-[26px] font-bold leading-8 text-ink">
              {formatMoney(m.collected - m.refunded)}
            </p>
          </div>
          <span className="rounded-pill bg-primary-tint px-2.5 py-1 text-[11px] font-semibold text-primary-dark">
            {m.patients} patients · {m.doctors} clinicians
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
          <Stat label="Consultations" value={String(m.completed)} />
          <Stat label="No-show rate" value={`${Math.round(m.noShowRate * 100)}%`} />
          <Stat label="Unpaid" value={formatMoney(m.outstanding)} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-4">
          <Row label="Bookings taken" value={String(m.total)} />
          <Row label="Upcoming" value={String(m.upcoming)} />
          <Row label="Cancelled" value={String(m.cancelled)} />
          <Row label="Refunded" value={formatMoney(m.refunded)} />
        </div>
      </Card>

      {alerts.length === 0 ? (
        <Notice tone="ok" icon={<CheckCircleIcon size={18} />} title="Nothing needs you">
          Every application has a decision, and every consultation either paid or was closed off
          properly.
        </Notice>
      ) : (
        <section>
          <h2 className="mb-3 text-[15px] font-semibold text-ink">Needs attention</h2>
          <ul className="space-y-2.5">
            {alerts.map((alert) => (
              <li key={alert.id}>
                <AlertCard alert={alert} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-[15px] font-semibold text-ink">Latest activity</h2>
        <Card className="divide-y divide-line p-0">
          {recent.length === 0 ? (
            <EmptyState icon={<HistoryIcon size={24} />} title="No activity yet" />
          ) : (
            recent.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-canvas text-ink-muted">
                  <NoteIcon size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium text-ink">
                    {entry.action.replace(/_/g, " ")}
                  </p>
                  <p className="truncate text-[11px] text-ink-muted">
                    {names.get(entry.actorId) ?? "Unknown account"}
                    {entry.detail ? ` · ${entry.detail}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-[10px] text-ink-muted">
                  {new Date(entry.at).toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))
          )}
        </Card>
      </section>

      <Button variant="secondary" full icon={<ShieldIcon size={18} />} onClick={onReview}>
        Review clinician credentials
      </Button>
    </div>
  );
}

function AlertCard({ alert }: { alert: OpsAlert }) {
  const tone = {
    info: { shell: "bg-primary-tint text-primary-dark", Icon: CalendarIcon },
    warn: { shell: "bg-[#FDF3E3] text-warning", Icon: AlertIcon },
    danger: { shell: "bg-[#FBEDED] text-danger", Icon: CardIcon },
  }[alert.tone];

  return (
    <Card className="flex items-start gap-3 p-card">
      <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${tone.shell}`}>
        <tone.Icon size={17} />
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-ink">{alert.title}</p>
        <p className="mt-0.5 text-[11px] leading-5 text-ink-muted">{alert.detail}</p>
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[19px] font-bold text-ink">{value}</p>
      <p className="mt-0.5 text-[11px] text-ink-muted">{label}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12px] text-ink-muted">{label}</span>
      <span className="text-[13px] font-medium text-ink">{value}</span>
    </div>
  );
}
