"use client";

import { Avatar, Notice } from "@/components/ui";
import { AlertIcon, CheckCircleIcon, ClockIcon, ShieldIcon } from "@/components/Icons";
import { useStore, type BookingView } from "@/lib/store";
import { initialsOf } from "@/lib/db";
import { timeLabel } from "@/lib/schedule";

/**
 * Clinical brief.
 *
 * Everything a doctor should read before connecting: the presenting complaint in
 * the patient's own words, the history they chose to share, and the state of the
 * payment. Shared by the dashboard's pre-call sheet and the consult screen's
 * "Brief" tab so those two views can never drift apart.
 */
/** The clinical brief: everything the doctor should read before connecting. */
export function Brief({ booking }: { booking: BookingView }) {
  const store = useStore();
  const patient = store.patientFor(booking.patientId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-2xl bg-canvas p-3.5">
        <Avatar initials={initialsOf(patient?.fullName ?? "Patient")} accent={patient?.accent ?? "blue"} size={44} />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-ink">
            {patient?.fullName ?? "Patient"}
          </p>
          <p className="truncate text-[12px] text-ink-muted">
            {patient?.age ? `${patient.age} yrs` : "Age not given"}
            {patient?.gender && patient.gender !== "undisclosed" ? ` · ${patient.gender}` : ""}
            {patient?.location ? ` · ${patient.location}` : ""}
          </p>
        </div>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          Presenting complaint
        </p>
        <p className="mt-1.5 text-[14px] font-medium text-ink">{booking.intake.reason}</p>
        {booking.intake.notes ? (
          <p className="mt-2 text-[13px] leading-6 text-ink-muted">{booking.intake.notes}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-pill bg-canvas px-2.5 py-1 text-[11px] text-ink-muted">
            Duration: {booking.intake.duration}
          </span>
          <span className="rounded-pill bg-canvas px-2.5 py-1 text-[11px] text-ink-muted">
            Self-rated severity: {booking.intake.severity}/5
          </span>
        </div>
      </div>

      {booking.intake.attachProfileHistory && patient ? (
        <div className="rounded-2xl border border-line p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            Shared health history
          </p>
          <dl className="mt-3 space-y-3">
            <HistoryRow label="Allergies" values={patient.allergies} tone="danger" />
            <HistoryRow label="Conditions" values={patient.conditions} />
            <HistoryRow label="Current medication" values={patient.currentMedications} />
          </dl>
          <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-5 text-ink-muted">
            <ShieldIcon size={13} />
            Shared by the patient for this consultation only. Access is logged.
          </p>
        </div>
      ) : (
        <Notice tone="warn" icon={<AlertIcon size={18} />} title="No history shared">
          The patient chose not to share their saved health information. Ask about allergies and
          current medication before prescribing.
        </Notice>
      )}

      <div className="rounded-2xl border border-line p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          Consultation
        </p>
        <dl className="mt-3 space-y-2.5 text-[13px]">
          <div className="flex justify-between">
            <dt className="text-ink-muted">Reference</dt>
            <dd className="font-mono text-[12px] text-ink">{booking.reference}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">Booked for</dt>
            <dd className="text-ink">
              {timeLabel(booking.startsAt)} · {booking.durationMins} min
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">Fee</dt>
            <dd className="text-ink">
              ₹{booking.payment.amount}{" "}
              <span className={booking.payment.status === "paid" ? "text-primary-dark" : "text-warning"}>
                ({booking.payment.status})
              </span>
            </dd>
          </div>
        </dl>
      </div>

      {booking.payment.status === "paid" ? (
        <Notice tone="ok" icon={<CheckCircleIcon size={18} />} title="Payment captured">
          You&apos;ll be paid out in the next settlement run. The patient has been told their fee is
          refundable if you don&apos;t join within 10 minutes.
        </Notice>
      ) : (
        <Notice tone="warn" icon={<AlertIcon size={18} />} title="Do not start this consultation">
          Payment is still {booking.payment.status}. Starting the room now would let the patient be
          treated before the fee is captured, which CareNow can&apos;t refund.
        </Notice>
      )}

      <p className="flex items-center gap-1.5 text-[11px] text-ink-muted">
        <ClockIcon size={13} />
        Reading this patient&apos;s record is logged against your account.
      </p>
    </div>
  );
}

function HistoryRow({
  label,
  values,
  tone,
}: {
  label: string;
  values: string[];
  tone?: "danger";
}) {
  return (
    <div>
      <dt className="text-[11px] text-ink-muted">{label}</dt>
      <dd className="mt-1 flex flex-wrap gap-1.5">
        {values.length ? (
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
        ) : (
          <span className="text-[12px] text-ink-muted/80">None recorded</span>
        )}
      </dd>
    </div>
  );
}
