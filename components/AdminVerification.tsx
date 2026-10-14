"use client";

import { useState } from "react";
import { Avatar, Button, Card, Chip, EmptyState, Notice, Sheet, useToast } from "@/components/ui";
import { AlertIcon, CheckCircleIcon, ShieldIcon } from "@/components/Icons";
import { CareNowError, useStore } from "@/lib/store";
import { initialsOf } from "@/lib/db";
import { specialtyLabel } from "@/lib/catalog";
import { formatMoney } from "@/lib/currency";
import type { Doctor } from "@/lib/types";

/**
 * Credential verification.
 *
 * The gate the whole marketplace rests on: `listDoctors()` filters on
 * `verified`, so until a decision is recorded here the clinician is invisible to
 * patients and cannot accept a booking. The PRD calls for a manual check, so the
 * console asks for the one thing that cannot be inferred from the application —
 * the registration number found on the MDCN register — and records who looked.
 */
export function VerificationPanel() {
  const store = useStore();
  const [openId, setOpenId] = useState<string | null>(null);

  const queue = store.verificationQueue();
  const decisions = store.verificationDecisions().slice(0, 8);
  const open = openId ? (queue.find((d) => d.id === openId) ?? null) : null;

  return (
    <>
      {queue.length === 0 ? (
        <EmptyState
          icon={<CheckCircleIcon size={24} />}
          title="No applications waiting"
          body="Every clinician on file has a credential decision recorded against them. New applications land here the moment a doctor registers."
        />
      ) : (
        <ul className="space-y-3">
          {queue.map((doctor) => (
            <li key={doctor.id}>
              <PendingCard doctor={doctor} onOpen={() => setOpenId(doctor.id)} />
            </li>
          ))}
        </ul>
      )}

      <Notice tone="warn" icon={<ShieldIcon size={18} />} title="Check the register, not the form">
        Ask for the MDCN number, look it up, and record what the register says. An approval puts a
        real doctor&apos;s licence in front of patients — and nurses, physiotherapists and
        traditional healers who describe themselves as clinicians all fail this check.
      </Notice>

      {decisions.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-3 text-[15px] font-semibold text-ink">Recent decisions</h2>
          <ul className="space-y-2">
            {decisions.map((d) => {
              const doctor = store.getDoctor(d.doctorId)?.doctor;
              const approved = d.decision === "approved";
              return (
                <li key={d.id}>
                  <Card className="flex items-start gap-3 p-3.5">
                    <span
                      className={[
                        "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full",
                        approved ? "bg-primary-tint text-primary-dark" : "bg-[#FBEDED] text-danger",
                      ].join(" ")}
                    >
                      {approved ? <CheckCircleIcon size={17} /> : <AlertIcon size={17} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink">
                        {doctor?.fullName ?? "Clinician"}{" "}
                        <span className="font-normal text-ink-muted">
                          {approved ? "approved" : "turned down"}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[11px] leading-5 text-ink-muted">
                        {approved ? d.licenceNumber : d.reason}
                      </p>
                      <p className="mt-0.5 text-[11px] text-ink-muted">
                        {d.decidedBy} ·{" "}
                        {new Date(d.decidedAt).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <Sheet
        open={Boolean(open)}
        onClose={() => setOpenId(null)}
        title={open ? "Credential check" : undefined}
      >
        {open ? <VerifySheet key={open.id} doctor={open} onDone={() => setOpenId(null)} /> : null}
      </Sheet>
    </>
  );
}

function PendingCard({ doctor, onOpen }: { doctor: Doctor; onOpen: () => void }) {
  const store = useStore();
  const previous = store.verificationFor(doctor.id);

  return (
    <Card className="p-card">
      <div className="flex items-center gap-3">
        <Avatar initials={initialsOf(doctor.fullName)} accent={doctor.accent} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-card font-semibold text-ink">{doctor.fullName}</p>
          <p className="truncate text-sub text-ink-muted">
            {specialtyLabel(doctor.specialty)} · {doctor.city}
          </p>
          <p className="truncate text-[11px] text-ink-muted">
            {doctor.qualifications} · {doctor.yearsExperience} yrs
          </p>
        </div>
        <span className="shrink-0 rounded-pill bg-[#FDF3E3] px-2.5 py-1 text-[11px] font-semibold text-warning">
          Unverified
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {previous?.decision === "rejected" ? (
          <span className="rounded-pill bg-[#FBEDED] px-2.5 py-1 text-[11px] font-medium text-danger">
            Previously turned down
          </span>
        ) : null}
        <span className="rounded-pill bg-canvas px-2.5 py-1 text-[11px] text-ink-muted">
          {formatMoney(doctor.consultationFee)} per consultation
        </span>
        <span className="rounded-pill bg-canvas px-2.5 py-1 text-[11px] text-ink-muted">
          {doctor.languages.join(", ")}
        </span>
      </div>

      <Button full className="mt-3" onClick={onOpen}>
        Review credentials
      </Button>
    </Card>
  );
}

function VerifySheet({ doctor, onDone }: { doctor: Doctor; onDone: () => void }) {
  const store = useStore();
  const toast = useToast();
  const [mode, setMode] = useState<"approve" | "reject">("approve");
  const [licence, setLicence] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const previous = store.verificationFor(doctor.id);
  // One admin role, one set of powers: holding a seat is the permission. The
  // store still refuses the command without a session, so this only covers the
  // moment before sign-in completes.
  const allowed = Boolean(store.adminSession);

  function submit() {
    setError(null);
    try {
      if (mode === "approve") {
        store.approveDoctor({ doctorId: doctor.id, licenceNumber: licence });
        toast(`${doctor.fullName} is verified and live in search`, "ok");
      } else {
        store.rejectDoctor({ doctorId: doctor.id, reason });
        toast(`${doctor.fullName} was not verified`, "info");
      }
      onDone();
    } catch (e) {
      // CareNowError carries the actionable half in `hint`; anything else is a bug.
      setError(e instanceof CareNowError ? (e.hint ?? e.message) : "Something went wrong.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-2xl bg-canvas p-3.5">
        <Avatar initials={initialsOf(doctor.fullName)} accent={doctor.accent} size={48} />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-ink">{doctor.fullName}</p>
          <p className="truncate text-[12px] text-ink-muted">
            {specialtyLabel(doctor.specialty)} · {doctor.city}
          </p>
          <p className="truncate text-[11px] text-ink-muted">{doctor.email}</p>
        </div>
      </div>

      <Row label="Qualifications" value={doctor.qualifications} />
      <Row label="Years in practice" value={`${doctor.yearsExperience} years`} />
      <Row label="Languages" value={doctor.languages.join(", ")} />
      <Row label="Fee" value={`${formatMoney(doctor.consultationFee)} per consultation`} />

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          Application
        </p>
        <p className="mt-1.5 text-[13px] leading-6 text-ink-muted">{doctor.bio}</p>
      </div>

      {previous ? (
        <Notice
          tone={previous.decision === "rejected" ? "danger" : "info"}
          icon={<AlertIcon size={17} />}
          title={previous.decision === "rejected" ? "Turned down before" : "Approved before"}
        >
          {previous.decision === "rejected"
            ? previous.reason
            : `${previous.licenceNumber} · ${previous.decidedBy}`}
        </Notice>
      ) : null}

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          Decision
        </p>
        <div className="chip-row">
          <Chip
            label="Approve"
            active={mode === "approve"}
            onClick={() => {
              setMode("approve");
              setError(null);
            }}
          />
          <Chip
            label="Turn down"
            active={mode === "reject"}
            onClick={() => {
              setMode("reject");
              setError(null);
            }}
          />
        </div>
      </div>

      {mode === "approve" ? (
        <div>
          <label className="label" htmlFor="licence-number">
            MDCN registration number
          </label>
          <input
            id="licence-number"
            className="field font-mono uppercase"
            placeholder="MDCN/R/41208"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            value={licence}
            onChange={(e) => setLicence(e.target.value)}
          />
          <p className="mt-2 text-[12px] leading-5 text-ink-muted">
            Read it off the Medical and Dental Council register. It goes on the clinician&apos;s
            patient-facing listing as proof of registration, and one number can only belong to one
            clinician.
          </p>
        </div>
      ) : (
        <div>
          <label className="label" htmlFor="reject-reason">
            Why the application is being turned down
          </label>
          <textarea
            id="reject-reason"
            className="field min-h-[88px] resize-none"
            placeholder="Number not found on the MDCN register."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <p className="mt-2 text-[12px] leading-5 text-ink-muted">
            The clinician sees this, so make it something they can fix and re-submit.
          </p>
        </div>
      )}

      {error ? (
        <Notice tone="danger" icon={<AlertIcon size={17} />}>
          {error}
        </Notice>
      ) : null}

      <div className="space-y-2 pt-1">
        <Button full onClick={submit} disabled={!allowed}>
          {mode === "approve" ? "Approve and list" : "Record decision"}
        </Button>
        <Button variant="ghost" full onClick={onDone}>
          Cancel
        </Button>
      </div>

      {allowed ? null : (
        <Notice tone="warn" icon={<AlertIcon size={17} />}>
          Sign in to the console to record a decision.
        </Notice>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line pb-2.5 last:border-0">
      <span className="text-[12px] text-ink-muted">{label}</span>
      <span className="text-right text-[13px] font-medium text-ink">{value}</span>
    </div>
  );
}
