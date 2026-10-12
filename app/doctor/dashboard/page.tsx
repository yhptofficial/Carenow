"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCareNow, useStore, type BookingView } from "@/lib/store";
import { Avatar, Button, Card, Chip, EmptyState, Sheet, useToast } from "@/components/ui";
import { DetailHeader } from "@/components/AppHeader";
import { Brief } from "@/components/ClinicalBrief";
import { AlertIcon, CalendarIcon, NoteIcon, PillIcon, VideoIcon } from "@/components/Icons";
import { initialsOf } from "@/lib/db";
import { minutesUntil, timeLabel } from "@/lib/schedule";

/**
 * Today's queue.
 *
 * Ordered by start time so the next patient is always at the top. Colour on the
 * status pill mirrors the patient side: teal for paid and confirmed, amber for
 * money that hasn't landed yet.
 */
export default function DoctorDashboardPage() {
  const store = useStore();
  const { ready, doctorSession } = useCareNow();
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<"queue" | "history">("queue");
  const [briefFor, setBriefFor] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !doctorSession) router.replace("/doctor");
  }, [ready, doctorSession, router]);

  if (!ready || !doctorSession) return <div className="min-h-[100dvh]" />;

  const doctor = doctorSession;
  const queue = store.doctorQueue(doctor.id);
  const history = store.doctorHistory(doctor.id);

  const today = useMemo(() => {
    const now = new Date();
    return queue.filter((b) => {
      const d = new Date(b.startsAt);
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    });
  }, [queue]);

  const earnings = useMemo(() => {
    const completedThisMonth = history.filter(
      (b) =>
        b.status === "completed" &&
        new Date(b.startsAt).getMonth() === new Date().getMonth() &&
        b.payment.status === "paid",
    );
    return completedThisMonth.reduce((sum, b) => sum + b.payment.amount, 0);
  }, [history]);

  const brief = briefFor ? queue.find((b) => b.id === briefFor) : null;

  return (
    <div className="app-scroll pt-[max(16px,var(--safe-t))]">
      <DetailHeader
        title={doctor.fullName}
        subtitle={`${doctor.qualifications} · Reg. ${doctor.verification.licenceNumber}`}
        backHref="/doctor"
      />

      {/* -------- Shift summary -------- */}
      <Card className="mb-5 p-4">
        <div className="flex items-center gap-3">
          <Avatar initials={initialsOf(doctor.fullName)} accent={doctor.accent} size={44} />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-ink-muted">
              {new Date().toLocaleDateString(undefined, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
            <p className="text-[15px] font-semibold text-ink">
              {today.length ? `${today.length} booked today` : "Nothing booked today"}
            </p>
          </div>
          <span className="shrink-0 rounded-pill bg-primary-tint px-2.5 py-1 text-[11px] font-semibold text-primary-dark">
            {earnings > 0 ? `₹${earnings} this month` : "Verified"}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
          <Stat label="Waiting now" value={queue.filter((b) => b.joinable).length} />
          <Stat label="Unpaid" value={queue.filter((b) => b.payment.status !== "paid").length} />
          <Stat label="Completed" value={history.filter((b) => b.status === "completed").length} />
        </div>
      </Card>

      <div className="chip-row mb-4">
        <Chip
          label={`Queue${queue.length ? ` (${queue.length})` : ""}`}
          active={tab === "queue"}
          onClick={() => setTab("queue")}
        />
        <Chip
          label={`Past${history.length ? ` (${history.length})` : ""}`}
          active={tab === "history"}
          onClick={() => setTab("history")}
        />
      </div>

      {tab === "queue" ? (
        queue.length === 0 ? (
          <EmptyState
            icon={<CalendarIcon size={24} />}
            title="Your queue is clear"
            body="New bookings appear here the moment a patient pays. You'll also get an email when someone books inside the next two hours."
          />
        ) : (
          <ul className="space-y-3">
            {queue.map((b) => (
              <li key={b.id}>
                <QueueCard
                  booking={b}
                  onBrief={() => setBriefFor(b.id)}
                  onJoin={() => {
                    store.startConsult(b.id);
                    router.push(`/doctor/consult/${b.id}`);
                  }}
                />
              </li>
            ))}
          </ul>
        )
      ) : history.length === 0 ? (
        <EmptyState
          icon={<PillIcon size={24} />}
          title="No past consultations"
          body="Completed and missed consultations are listed here with the prescription you issued."
        />
      ) : (
        <ul className="space-y-3">
          {history.map((b) => (
            <li key={b.id}>
              <Card className="p-card">
                <div className="flex items-center gap-3">
                  <Avatar
                    initials={initialsOf(store.patientFor(b.patientId)?.fullName ?? "Patient")}
                    accent={store.patientFor(b.patientId)?.accent ?? "blue"}
                    size={40}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-card font-semibold text-ink">
                      {store.patientFor(b.patientId)?.fullName ?? "Patient"}
                    </p>
                    <p className="truncate text-sub text-ink-muted">{b.intake.reason}</p>
                    <p className="mt-1 text-[11px] text-ink-muted">
                      {new Date(b.startsAt).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                      })}
                      {" · "}
                      {timeLabel(b.startsAt)}
                    </p>
                  </div>
                  <span
                    className={[
                      "shrink-0 rounded-pill px-2.5 py-1 text-[11px] font-semibold",
                      b.status === "completed"
                        ? "bg-primary-tint text-primary-dark"
                        : b.status === "no_show"
                          ? "bg-[#FBEDED] text-danger"
                          : "bg-canvas text-ink-muted",
                    ].join(" ")}
                  >
                    {b.status === "completed" ? "Completed" : b.status === "no_show" ? "No-show" : "Cancelled"}
                  </span>
                </div>
                {store.prescriptionForBooking(b.id) ? (
                  <p className="mt-3 inline-flex items-center gap-1.5 rounded-pill bg-primary-tint px-2.5 py-1 text-[11px] font-medium text-primary-dark">
                    <PillIcon size={13} />
                    {store.prescriptionForBooking(b.id)!.diagnosis}
                  </p>
                ) : b.status === "completed" ? (
                  <div className="mt-3">
                    <Button
                      size="md"
                      variant="secondary"
                      full
                      icon={<PillIcon size={16} />}
                      onClick={() => router.push(`/doctor/consult/${b.id}`)}
                    >
                      Write prescription
                    </Button>
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* -------- Pre-call brief -------- */}
      <Sheet
        open={Boolean(brief)}
        onClose={() => setBriefFor(null)}
        title="Pre-call brief"
        footer={
          brief ? (
            <Button
              full
              icon={<VideoIcon size={18} />}
              onClick={() => {
                store.startConsult(brief.id);
                router.push(`/doctor/consult/${brief.id}`);
              }}
            >
              Start consultation
            </Button>
          ) : null
        }
      >
        {brief ? <Brief booking={brief} /> : null}
      </Sheet>
    </div>
  );
}

function QueueCard({
  booking,
  onBrief,
  onJoin,
}: {
  booking: BookingView;
  onBrief: () => void;
  onJoin: () => void;
}) {
  const store = useStore();
  const patient = store.patientFor(booking.patientId);
  const minutes = minutesUntil(booking.startsAt);
  const unpaid = booking.payment.status !== "paid";

  return (
    <Card className={`p-card ${booking.joinable ? "ring-2 ring-primary" : ""}`}>
      <div className="flex items-center gap-3">
        <Avatar
          initials={initialsOf(patient?.fullName ?? "Patient")}
          accent={patient?.accent ?? "blue"}
          size={44}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-card font-semibold text-ink">
            {booking.intake.reason}
          </p>
          <p className="truncate text-sub text-ink-muted">
            {timeLabel(booking.startsAt)} · {booking.durationMins} min · {booking.reference}
          </p>
        </div>
        <span
          className={[
            "shrink-0 rounded-pill px-2.5 py-1 text-[11px] font-semibold",
            unpaid
              ? "bg-[#FDF3E3] text-warning"
              : booking.joinable
                ? "bg-primary text-white"
                : "bg-primary-tint text-primary-dark",
          ].join(" ")}
        >
          {unpaid ? "Unpaid" : booking.joinable ? "Waiting" : minutes < 0 ? "Overdue" : `in ${minutes}m`}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-pill bg-canvas px-2.5 py-1 text-[11px] text-ink-muted">
          Severity {booking.intake.severity}/5
        </span>
        <span className="rounded-pill bg-canvas px-2.5 py-1 text-[11px] text-ink-muted">
          {booking.intake.duration}
        </span>
        {booking.intake.attachProfileHistory ? (
          <span className="rounded-pill bg-primary-tint px-2.5 py-1 text-[11px] font-medium text-primary-dark">
            History shared
          </span>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button size="md" variant="secondary" icon={<NoteIcon size={16} />} onClick={onBrief}>
          Brief
        </Button>
        <Button size="md" icon={<VideoIcon size={16} />} onClick={onJoin} disabled={unpaid}>
          Start
        </Button>
      </div>

      {unpaid ? (
        <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-5 text-warning">
          <AlertIcon size={13} />
          Payment hasn&apos;t been captured. The room stays locked until it clears — don&apos;t start
          the consultation.
        </p>
      ) : null}
    </Card>
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
