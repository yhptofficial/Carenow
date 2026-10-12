"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCareNow, useStore } from "@/lib/store";
import { RequireAuth } from "@/components/AppShell";
import { DetailHeader } from "@/components/AppHeader";
import { Avatar, Button, Card, Notice } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { AlertIcon, CalendarIcon, ClockIcon, PillIcon, ShieldIcon, VideoIcon } from "@/components/Icons";
import { initialsOf } from "@/lib/db";
import { timeLabel } from "@/lib/schedule";

/**
 * Visit summary.
 *
 * Doubles as the printable document a patient hands to another clinic, so it is
 * written in plain clinical language and carries the doctor's registration.
 */
export default function VisitSummaryPage() {
  return (
    <RequireAuth skeleton="detail">
      <VisitSummary />
    </RequireAuth>
  );
}

function VisitSummary() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const store = useStore();
  const { ready } = useCareNow();

  const booking = store.getBooking(bookingId);
  const rx = booking ? store.prescriptionForBooking(booking.id) : null;
  const patient = booking ? store.patientFor(booking.patientId) : null;

  if (!ready) return <div className="app-scroll"><DetailHeader title="Visit summary" /></div>;

  if (!booking) {
    return (
      <div className="min-h-[100dvh]">
        <DetailHeader title="Visit summary" backHref="/profile/records" />
        <div className="px-gutter">
          <Notice tone="danger" icon={<AlertIcon size={18} />} title="Record not found">
            This visit summary isn&apos;t available. It may belong to another account.
          </Notice>
        </div>
      </div>
    );
  }

  const upcoming = ["confirmed", "in_progress", "pending_payment"].includes(booking.status);
  const duration = booking.endedAt
    ? `${Math.max(1, Math.round((new Date(booking.endedAt).getTime() - new Date(booking.startsAt).getTime()) / 60_000))} min`
    : `${booking.durationMins} min`;

  return (
    <div className="min-h-[100dvh]">
      <DetailHeader
        title={upcoming ? "Preparing for your call" : "Visit summary"}
        subtitle={booking.reference}
        backHref={upcoming ? "/bookings" : "/profile/records"}
        trailing={<PrintButton label="Print" />}
      />

      <div className="app-scroll">
        <div className="space-y-section" id="record">
          {/* -------- Letterhead -------- */}
          <Card className="p-4">
            <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
              <div>
                <p className="text-[13px] font-bold text-ink">CareNow Telemedicine</p>
                <p className="mt-0.5 text-[11px] text-ink-muted">
                  Consultation record · {booking.reference}
                </p>
              </div>
              <span className="rounded-pill bg-primary-tint px-2.5 py-1 text-[11px] font-semibold text-primary-dark">
                {upcoming ? "Scheduled" : statusLabel(booking.status)}
              </span>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <Avatar initials={initialsOf(booking.doctor.fullName)} accent={booking.doctor.accent} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-card font-semibold text-ink">{booking.doctor.fullName}</p>
                <p className="truncate text-sub text-ink-muted">{booking.doctor.qualifications}</p>
                <p className="mt-0.5 truncate text-[11px] text-ink-muted">
                  Reg. {booking.doctor.verification.licenceNumber}
                </p>
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 text-[12px]">
              <Cell label="Patient" value={patient?.fullName ?? "—"} />
              <Cell label="Age" value={patient?.age ? `${patient.age} yrs` : "—"} />
              <Cell
                label="Date"
                value={new Date(booking.startsAt).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              />
              <Cell label="Duration" value={upcoming ? `Booked ${duration}` : duration} />
            </dl>
          </Card>

          {/* -------- What the patient reported -------- */}
          <section>
            <h3 className="mb-3 text-[15px] font-semibold text-ink">What you reported</h3>
            <Card className="p-4">
              <p className="text-[13px] font-medium text-ink">{booking.intake.reason}</p>
              {booking.intake.notes ? (
                <p className="mt-2 text-[13px] leading-6 text-ink-muted">{booking.intake.notes}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-pill bg-canvas px-2.5 py-1 text-[11px] text-ink-muted">
                  Duration: {booking.intake.duration}
                </span>
                <span className="rounded-pill bg-canvas px-2.5 py-1 text-[11px] text-ink-muted">
                  Severity: {booking.intake.severity}/5
                </span>
              </div>
            </Card>
          </section>

          {/* -------- Clinical outcome -------- */}
          {rx ? (
            <>
              <section>
                <h3 className="mb-3 text-[15px] font-semibold text-ink">Doctor&apos;s assessment</h3>
                <Card className="p-4">
                  <p className="text-[13px] font-semibold text-ink">{rx.diagnosis}</p>
                  {rx.advice ? (
                    <p className="mt-2 text-[13px] leading-6 text-ink-muted">{rx.advice}</p>
                  ) : null}
                  <p className="mt-3 text-[11px] text-ink-muted">
                    Signed {new Date(rx.issuedAt).toLocaleString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </Card>
              </section>

              <section>
                <h3 className="mb-3 text-[15px] font-semibold text-ink">Medicines prescribed</h3>
                <Card className="divide-y divide-line p-0">
                  {rx.medications.map((m) => (
                    <div key={m.name} className="p-4">
                      <p className="text-[13px] font-semibold text-ink">{m.name}</p>
                      <p className="mt-1 text-sub text-ink-muted">
                        {m.dosage} · {m.frequency} · {m.duration}
                      </p>
                      {m.notes ? (
                        <p className="mt-1.5 text-[12px] leading-5 text-ink-muted">{m.notes}</p>
                      ) : null}
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2 p-4">
                    <Link
                      href={`/prescriptions/${rx.id}`}
                      className="inline-flex h-10 items-center gap-2 rounded-pill bg-primary px-4 text-[13px] font-semibold text-white pressable"
                    >
                      <PillIcon size={17} />
                      Open full prescription
                    </Link>
                  </div>
                </Card>
              </section>
            </>
          ) : upcoming ? (
            <Notice tone="info" icon={<VideoIcon size={18} />} title="Before your call">
              <ul className="mt-1 space-y-1.5">
                <li>Find a quiet, well-lit spot with a stable connection.</li>
                <li>Have your current medicines and any recent reports with you.</li>
                <li>
                  Write down your questions — consultations average{" "}
                  {booking.durationMins} minutes.
                </li>
                <li>
                  Join from{" "}
                  <Link href={`/consult/${booking.id}`} className="font-semibold underline">
                    the consultation room
                  </Link>{" "}
                  10 minutes before, from this same device.
                </li>
              </ul>
            </Notice>
          ) : (
            <Notice tone="warn" icon={<AlertIcon size={18} />} title="No clinical notes on file">
              This consultation didn&apos;t produce a prescription or written notes — usually because
              it was cancelled or nobody joined.
            </Notice>
          )}

          {/* -------- Timeline -------- */}
          <section>
            <h3 className="mb-3 text-[15px] font-semibold text-ink">Visit timeline</h3>
            <Card className="divide-y divide-line p-0">
              <TimelineRow
                icon={<CalendarIcon size={16} />}
                label="Booked"
                value={new Date(booking.createdAt).toLocaleString(undefined, {
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              />
              <TimelineRow
                icon={<ShieldIcon size={16} />}
                label="Payment"
                value={
                  booking.payment.status === "paid"
                    ? `₹${booking.payment.amount} captured`
                    : booking.payment.status === "refunded"
                      ? `₹${booking.payment.amount} refunded`
                      : "Not paid"
                }
              />
              <TimelineRow
                icon={<ClockIcon size={16} />}
                label="Reminder"
                value={
                  booking.reminders.sentAt
                    ? `Sent ${timeLabel(booking.reminders.sentAt)}`
                    : `Scheduled ${timeLabel(booking.reminders.scheduledFor)}`
                }
              />
              <TimelineRow
                icon={<VideoIcon size={16} />}
                label="Consultation"
                value={upcoming ? `${timeLabel(booking.startsAt)} (upcoming)` : timeLabel(booking.startsAt)}
              />
              {rx ? (
                <TimelineRow
                  icon={<PillIcon size={16} />}
                  label="Prescription issued"
                  value={new Date(rx.issuedAt).toLocaleString(undefined, {
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                />
              ) : null}
            </Card>
          </section>

          {booking.resolution ? (
            <Notice tone="warn" icon={<AlertIcon size={18} />} title="What happened to this booking">
              {booking.resolution}
            </Notice>
          ) : null}

          <p className="pb-4 text-center text-[11px] leading-5 text-ink-muted">
            This document was generated by CareNow on behalf of {booking.doctor.fullName} and is valid
            without a signature. Emergency care is not covered by CareNow.
            <br />
            Questions? clinic@carenow.health
          </p>

          <div className="no-print pb-4">
            <Button
              variant="secondary"
              full
              onClick={() => store.session && window.print()}
              icon={<VideoIcon size={17} />}
            >
              Download / print this summary
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-[12px] font-medium text-ink">{value}</dd>
    </div>
  );
}

function TimelineRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-canvas text-ink-muted">
        {icon}
      </span>
      <span className="flex-1 text-[13px] text-ink">{label}</span>
      <span className="text-right text-[12px] text-ink-muted">{value}</span>
    </div>
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "no_show":
      return "Did not attend";
    case "in_progress":
      return "In progress";
    default:
      return "Scheduled";
  }
}
