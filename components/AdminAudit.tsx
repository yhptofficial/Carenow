"use client";

import { useMemo, useState } from "react";
import { Card, Chip, EmptyState } from "@/components/ui";
import {
  CardIcon,
  HistoryIcon,
  NoteIcon,
  ShieldIcon,
  VideoIcon,
} from "@/components/Icons";
import { useStore } from "@/lib/store";
import type { AuditEntry } from "@/lib/types";

/**
 * Audit trail.
 *
 * The console's copy of `audit_log` in `supabase/schema.sql` — append-only, and
 * the artifact that makes the NDPA obligations in the privacy policy checkable
 * rather than aspirational. Every entry carries an actor, an action, the record
 * it touched and when, so "who opened this patient's file" is a query and not a
 * guess. Nothing in the trail can be edited from here, by design.
 */

type Group = "access" | "clinical" | "money";

const ACTION_LABEL: Record<AuditEntry["action"], string> = {
  sign_up: "Account created",
  sign_in: "Signed in",
  consent_accepted: "Consent recorded",
  profile_updated: "Profile updated",
  booking_created: "Consultation booked",
  payment_captured: "Payment captured",
  payment_failed: "Payment declined",
  refund_issued: "Refund issued",
  booking_cancelled: "Consultation cancelled",
  booking_rescheduled: "Consultation moved",
  record_viewed: "Record opened",
  consult_started: "Consultation started",
  consult_ended: "Consultation ended",
  prescription_issued: "Prescription issued",
  rating_submitted: "Rating submitted",
  doctor_verified: "Clinician verified",
  doctor_rejected: "Clinician turned down",
  admin_granted: "Admin access changed",
  admin_revoked: "Admin seat revoked",
};

const ACTION_GROUP: Record<AuditEntry["action"], Group> = {
  sign_up: "access",
  sign_in: "access",
  consent_accepted: "access",
  profile_updated: "access",
  booking_created: "money",
  payment_captured: "money",
  payment_failed: "money",
  refund_issued: "money",
  booking_cancelled: "money",
  booking_rescheduled: "money",
  record_viewed: "clinical",
  consult_started: "clinical",
  consult_ended: "clinical",
  prescription_issued: "clinical",
  rating_submitted: "clinical",
  doctor_verified: "access",
  doctor_rejected: "access",
  admin_granted: "access",
  admin_revoked: "access",
};

const GROUP_ICON: Record<Group, typeof ShieldIcon> = {
  access: ShieldIcon,
  clinical: VideoIcon,
  money: CardIcon,
};

export function AuditPanel() {
  const store = useStore();
  const [filter, setFilter] = useState<"all" | Group>("all");

  const trail = store.auditLog();

  /** Ids in the trail are profile ids; the directory is where names live. */
  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of store.accountDirectory()) map.set(row.id, row.fullName);
    map.set("system", "CareNow system");
    return map;
  }, [store]);

  const rows = filter === "all" ? trail : trail.filter((e) => ACTION_GROUP[e.action] === filter);

  const counts = useMemo(() => {
    const byGroup = { access: 0, clinical: 0, money: 0 };
    for (const e of trail) byGroup[ACTION_GROUP[e.action]] += 1;
    return byGroup;
  }, [trail]);

  return (
    <>
      <div className="chip-row mb-4">
        <Chip label={`Everything (${trail.length})`} active={filter === "all"} onClick={() => setFilter("all")} />
        <Chip label={`Access (${counts.access})`} active={filter === "access"} onClick={() => setFilter("access")} />
        <Chip label={`Clinical (${counts.clinical})`} active={filter === "clinical"} onClick={() => setFilter("clinical")} />
        <Chip label={`Money (${counts.money})`} active={filter === "money"} onClick={() => setFilter("money")} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<HistoryIcon size={24} />}
          title="Nothing recorded yet"
          body="Sign-ins, payments, consent and every credential decision land here as they happen."
        />
      ) : (
        <ul className="space-y-2">
          {rows.slice(0, 120).map((entry) => {
            const Icon = GROUP_ICON[ACTION_GROUP[entry.action]];
            const actor = names.get(entry.actorId) ?? "Unknown account";
            return (
              <li key={entry.id}>
                <Card className="flex items-start gap-3 p-3.5">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-canvas text-ink-muted">
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-ink">{ACTION_LABEL[entry.action]}</p>
                    <p className="mt-0.5 text-[11px] leading-5 text-ink-muted">
                      {actor}
                      {entry.detail ? ` · ${entry.detail}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-right text-[10px] leading-4 text-ink-muted">
                    {stamp(entry.at)}
                  </span>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 flex items-start gap-2 px-1 text-[11px] leading-5 text-ink-muted">
        <NoteIcon size={13} />
        Append-only by design: entries are written by the store and cannot be edited or deleted from
        the console. In production the same table carries a row-level policy that allows inserts and
        reads only, so history survives a compromised admin session.
      </p>
    </>
  );
}

/** Compact stamp: time for today, date otherwise. Trails read chronologically. */
function stamp(iso: string): string {
  const at = new Date(iso);
  const now = new Date();
  const sameDay =
    at.getFullYear() === now.getFullYear() &&
    at.getMonth() === now.getMonth() &&
    at.getDate() === now.getDate();
  return sameDay
    ? at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : at.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
