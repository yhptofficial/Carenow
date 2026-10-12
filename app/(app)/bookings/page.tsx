"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCareNow, useStore, type BookingView } from "@/lib/store";
import { ScreenHeader } from "@/components/AppHeader";
import { SlotPicker } from "@/components/SlotPicker";
import { Avatar, Button, Card, Chip, EmptyState, Notice, Sheet, useToast } from "@/components/ui";
import {
  AlertIcon,
  CalendarIcon,
  CardIcon,
  CheckCircleIcon,
  ClockIcon,
  DownloadIcon,
  FindIcon,
  HistoryIcon,
  NoteIcon,
  PillIcon,
  StarIcon,
  VideoIcon,
} from "@/components/Icons";
import { initialsOf } from "@/lib/db";
import { formatMoney } from "@/lib/currency";
import { timeLabel } from "@/lib/schedule";

export default function BookingsPage() {
  return (
    <Suspense fallback={null}>
      <BookingsScreen />
    </Suspense>
  );
}

function BookingsScreen() {
  const store = useStore();
  const { session } = useCareNow();
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();

  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [detailId, setDetailId] = useState<string | null>(params.get("focus"));
  const [ratingFor, setRatingFor] = useState<string | null>(null);
  const [cancelFor, setCancelFor] = useState<string | null>(null);
  const [rescheduleFor, setRescheduleFor] = useState<string | null>(null);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");

  const upcoming = store.upcomingBookings();
  const past = store.pastBookings();
  const confirmedId = params.get("confirmed");

  // Arriving from a successful payment: confirm it loudly, once.
  useEffect(() => {
    if (!confirmedId) return;
    toast("Payment received — your consultation is confirmed.", "ok");
    setTab("upcoming");
    setDetailId(confirmedId);
    router.replace("/bookings");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmedId]);

  const detail = detailId ? store.getBooking(detailId) : null;
  const ratingTarget = ratingFor ? store.getBooking(ratingFor) : null;

  return (
    <div className="app-scroll pt-[max(20px,var(--safe-t))]">
      <ScreenHeader
        context="Your consultations"
        title="Bookings"
        initials={session ? initialsOf(session.fullName) : undefined}
        accent={session?.accent ?? "teal"}
      />

      <div className="chip-row mb-4" role="tablist" aria-label="Booking status">
        <Chip label={`Upcoming${upcoming.length ? ` (${upcoming.length})` : ""}`} active={tab === "upcoming"} onClick={() => setTab("upcoming")} />
        <Chip label={`Past${past.length ? ` (${past.length})` : ""}`} active={tab === "past"} onClick={() => setTab("past")} />
      </div>

      {tab === "upcoming" ? (
        upcoming.length === 0 ? (
          <EmptyState
            icon={<CalendarIcon size={24} />}
            title="No upcoming consultations"
            body="Book a slot and it will appear here with a reminder 30 minutes before."
            action={
              <Link
                href="/find"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-pill bg-primary px-5 text-[13px] font-semibold text-white pressable"
              >
                <FindIcon size={16} />
                Find a doctor
              </Link>
            }
          />
        ) : (
          <ul className="space-y-3">
            {upcoming.map((b) => (
              <li key={b.id}>
                <UpcomingCard
                  booking={b}
                  onOpen={() => setDetailId(b.id)}
                  onPay={() => router.push(`/checkout/${b.id}`)}
                  onJoin={() => router.push(`/consult/${b.id}`)}
                />
              </li>
            ))}
          </ul>
        )
      ) : past.length === 0 ? (
        <EmptyState
          icon={<HistoryIcon size={24} />}
          title="No past consultations"
          body="Once you've had a consultation, its summary and prescription stay here for good."
        />
      ) : (
        <ul className="space-y-3">
          {past.map((b) => (
            <li key={b.id}>
              <PastCard
                booking={b}
                onOpen={() => setDetailId(b.id)}
                onRate={() => {
                  setRatingFor(b.id);
                  setStars(5);
                  setComment("");
                }}
                hasRated={store.hasRated(b.id)}
                prescriptionId={store.prescriptionForBooking(b.id)?.id ?? null}
              />
            </li>
          ))}
        </ul>
      )}

      {/* -------- Booking detail sheet -------- */}
      <Sheet
        open={Boolean(detail)}
        onClose={() => setDetailId(null)}
        title="Consultation details"
      >
        {detail ? (
          <BookingDetail
            booking={detail}
            hasRated={store.hasRated(detail.id)}
            prescriptionId={store.prescriptionForBooking(detail.id)?.id ?? null}
            onClose={() => setDetailId(null)}
            onJoin={() => {
              setDetailId(null);
              router.push(`/consult/${detail.id}`);
            }}
            onPay={() => {
              setDetailId(null);
              router.push(`/checkout/${detail.id}`);
            }}
            onCancel={() => {
              setCancelFor(detail.id);
              setDetailId(null);
            }}
            onReschedule={() => {
              setRescheduleFor(detail.id);
              setDetailId(null);
            }}
            onRate={() => {
              setRatingFor(detail.id);
              setStars(5);
              setComment("");
              setDetailId(null);
            }}
          />
        ) : null}
      </Sheet>

      {/* -------- Cancel flow -------- */}
      <CancelSheet
        booking={cancelFor ? store.getBooking(cancelFor) : null}
        onClose={() => setCancelFor(null)}
        onConfirm={(reason) => {
          if (!cancelFor) return;
          store.cancelBooking(cancelFor, reason);
          toast("Consultation cancelled. Refund details are on the booking.", "info");
          setCancelFor(null);
        }}
      />

      {/* -------- Reschedule flow -------- */}
      <RescheduleSheet
        booking={rescheduleFor ? store.getBooking(rescheduleFor) : null}
        onClose={() => setRescheduleFor(null)}
        onConfirm={(slotId) => {
          if (!rescheduleFor) return;
          try {
            store.rescheduleBooking(rescheduleFor, slotId);
            toast("Moved to the new time. We've updated your reminder.", "ok");
          } catch (e) {
            toast(e instanceof Error ? e.message : "Couldn't reschedule.", "warn");
          }
          setRescheduleFor(null);
        }}
      />

      {/* -------- Rating flow -------- */}
      <Sheet
        open={Boolean(ratingTarget)}
        onClose={() => setRatingFor(null)}
        title="Rate your consultation"
        footer={
          <Button
            full
            onClick={() => {
              if (!ratingFor) return;
              store.rateBooking(ratingFor, stars, comment.trim() || undefined);
              toast("Thanks — your rating helps other patients.", "ok");
              setRatingFor(null);
            }}
          >
            Submit rating
          </Button>
        }
      >
        {ratingTarget ? (
          <div>
            <div className="flex items-center gap-3 rounded-2xl bg-canvas p-3">
              <Avatar
                initials={initialsOf(ratingTarget.doctor.fullName)}
                accent={ratingTarget.doctor.accent}
                size={40}
              />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-ink">
                  {ratingTarget.doctor.fullName}
                </p>
                <p className="truncate text-[11px] text-ink-muted">
                  {new Date(ratingTarget.startsAt).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-center gap-2" role="radiogroup" aria-label="Star rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={stars === n}
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}
                  onClick={() => setStars(n)}
                  className={`rounded-full p-2 pressable transition-colors ${
                    n <= stars ? "text-[#E9A23B]" : "text-line"
                  }`}
                >
                  <StarIcon size={30} />
                </button>
              ))}
            </div>
            <p className="mt-2 text-center text-[12px] text-ink-muted">
              {["Poor", "Fair", "Good", "Great", "Excellent"][stars - 1]}
            </p>

            <div className="mt-5">
              <label className="label" htmlFor="review">
                Anything you&apos;d tell another patient? (optional)
              </label>
              <textarea
                id="review"
                rows={4}
                className="field resize-none leading-6"
                placeholder="Was the doctor clear? Did you get your prescription quickly?"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={280}
              />
              <p className="mt-1.5 text-right text-[11px] text-ink-muted">{comment.length}/280</p>
            </div>

            <Notice tone="info" icon={<AlertIcon size={18} />}>
              Reviews are public but never linked to your name or your medical records.
            </Notice>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Cards
 * ------------------------------------------------------------------ */

function UpcomingCard({
  booking,
  onOpen,
  onPay,
  onJoin,
}: {
  booking: BookingView;
  onOpen: () => void;
  onPay: () => void;
  onJoin: () => void;
}) {
  const unpaid = booking.payment.status !== "paid";
  const unpaidExpired = unpaid && new Date(booking.startsAt).getTime() < Date.now();

  return (
    <Card className={`p-card ${booking.joinable ? "ring-2 ring-primary" : ""}`}>
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 text-left">
        <Avatar initials={initialsOf(booking.doctor.fullName)} accent={booking.doctor.accent} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-card font-semibold text-ink">{booking.doctor.fullName}</p>
          <p className="truncate text-sub text-ink-muted">{booking.intake.reason}</p>
        </div>
        <span
          className={[
            "shrink-0 rounded-pill px-2.5 py-1 text-[11px] font-semibold",
            unpaid
              ? unpaidExpired
                ? "bg-[#FBEDED] text-danger"
                : "bg-[#FDF3E3] text-warning"
              : booking.joinable
                ? "bg-primary text-white"
                : "bg-primary-tint text-primary-dark",
          ].join(" ")}
        >
          {unpaid ? (unpaidExpired ? "Payment missed" : "Unpaid") : booking.joinable ? "Live" : "Paid"}
        </span>
      </button>

      <div className="mt-3 flex items-center gap-2 rounded-2xl bg-canvas px-3 py-2.5">
        <CalendarIcon size={18} />
        <p className="text-[13px] font-medium text-ink">
          {new Date(booking.startsAt).toLocaleDateString(undefined, {
            weekday: "short",
            day: "numeric",
            month: "short",
          })}{" "}
          · {timeLabel(booking.startsAt)}
        </p>
        <span className="ml-auto text-[11px] font-medium text-ink-muted">{booking.countdown}</span>
      </div>

      {booking.reminders.sentAt ? (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-muted">
          <CheckCircleIcon size={13} />
          Reminder sent by {booking.reminders.channels.join(" and ")}
        </p>
      ) : (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-muted">
          <ClockIcon size={13} />
          Reminder {timeLabel(booking.reminders.scheduledFor)} by{" "}
          {booking.reminders.channels.join(" and ")}
        </p>
      )}

      {unpaid ? (
        <div className="mt-3 space-y-2">
          <Button full size="md" onClick={onPay}>
            Pay {formatMoney(booking.payment.amount, booking.payment.currency)} to confirm
          </Button>
          {booking.payment.status === "failed" ? (
            <p className="text-[11px] leading-5 text-danger">
              {booking.payment.failureReason ?? "Your last payment attempt failed."} Your slot is held
              until it starts.
            </p>
          ) : null}
        </div>
      ) : booking.joinable ? (
        <Button full size="md" className="mt-3" icon={<VideoIcon size={17} />} onClick={onJoin}>
          Join now
        </Button>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button size="md" variant="secondary" onClick={onOpen}>
            Details
          </Button>
          <Button size="md" variant="ghost" onClick={onJoin} disabled={!booking.joinable}>
            <VideoIcon size={16} />
            Join
          </Button>
        </div>
      )}
    </Card>
  );
}

function PastCard({
  booking,
  onOpen,
  onRate,
  hasRated,
  prescriptionId,
}: {
  booking: BookingView;
  onOpen: () => void;
  onRate: () => void;
  hasRated: boolean;
  prescriptionId: string | null;
}) {
  const badge =
    booking.status === "completed"
      ? { label: "Completed", cls: "bg-primary-tint text-primary-dark" }
      : booking.status === "no_show"
        ? { label: "Missed", cls: "bg-[#FBEDED] text-danger" }
        : { label: "Cancelled", cls: "bg-canvas text-ink-muted" };

  return (
    <Card className="p-card">
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 text-left">
        <Avatar initials={initialsOf(booking.doctor.fullName)} accent={booking.doctor.accent} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-card font-semibold text-ink">{booking.doctor.fullName}</p>
          <p className="truncate text-sub text-ink-muted">{booking.intake.reason}</p>
          <p className="mt-1 text-[11px] text-ink-muted">
            {new Date(booking.startsAt).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
        <span className={`shrink-0 rounded-pill px-2.5 py-1 text-[11px] font-semibold ${badge.cls}`}>
          {badge.label}
        </span>
      </button>

      {booking.resolution ? (
        <p className="mt-3 rounded-2xl bg-canvas px-3 py-2.5 text-[11px] leading-5 text-ink-muted">
          {booking.resolution}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {prescriptionId ? (
          <Link
            href={`/prescriptions/${prescriptionId}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-primary-tint px-3.5 text-chip font-medium text-primary-dark pressable"
          >
            <PillIcon size={15} />
            View prescription
          </Link>
        ) : null}
        <Link
          href={`/records/${booking.id}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-canvas px-3.5 text-chip font-medium text-ink pressable"
        >
          <DownloadIcon size={15} />
          Visit summary
        </Link>
        {booking.status === "completed" && !hasRated ? (
          <button
            type="button"
            onClick={onRate}
            className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-canvas px-3.5 text-chip font-medium text-ink pressable"
          >
            <StarIcon size={15} />
            Rate
          </button>
        ) : null}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * Detail sheet body
 * ------------------------------------------------------------------ */

function BookingDetail({
  booking,
  hasRated,
  prescriptionId,
  onClose,
  onJoin,
  onPay,
  onCancel,
  onReschedule,
  onRate,
}: {
  booking: BookingView;
  hasRated: boolean;
  prescriptionId: string | null;
  onClose: () => void;
  onJoin: () => void;
  onPay: () => void;
  onCancel: () => void;
  onReschedule: () => void;
  onRate: () => void;
}) {
  const upcoming = ["confirmed", "in_progress", "pending_payment"].includes(booking.status);
  const hoursOut = (new Date(booking.startsAt).getTime() - Date.now()) / 3_600_000;
  const refundable = booking.payment.status === "paid" && hoursOut >= 2;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Avatar initials={initialsOf(booking.doctor.fullName)} accent={booking.doctor.accent} size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-ink">{booking.doctor.fullName}</p>
          <p className="truncate text-sub text-ink-muted">{booking.doctor.qualifications}</p>
        </div>
      </div>

      <Card className="divide-y divide-line p-0">
        <Field label="Reference" value={booking.reference} mono />
        <Field
          label="Date"
          value={new Date(booking.startsAt).toLocaleDateString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        />
        <Field label="Time" value={`${timeLabel(booking.startsAt)} · ${booking.durationMins} min`} />
        <Field
          label="Status"
          value={
            booking.status === "confirmed"
              ? "Confirmed"
              : booking.status === "in_progress"
                ? "In progress"
                : booking.status === "pending_payment"
                  ? "Awaiting payment"
                  : booking.status === "completed"
                    ? "Completed"
                    : booking.status === "no_show"
                      ? "Did not attend"
                      : "Cancelled"
          }
        />
        <Field
          label="Payment"
          value={
            booking.payment.status === "paid"
              ? `${formatMoney(booking.payment.amount, booking.payment.currency)} paid`
              : booking.payment.status === "refunded"
                ? `${formatMoney(booking.payment.amount, booking.payment.currency)} refunded`
                : booking.payment.status === "failed"
                  ? "Declined — retry"
                  : `${formatMoney(booking.payment.amount, booking.payment.currency)} unpaid`
          }
          tone={
            booking.payment.status === "paid"
              ? "ok"
              : booking.payment.status === "unpaid" || booking.payment.status === "failed"
                ? "warn"
                : undefined
          }
        />
        <Field
          label="Reminder"
          value={
            booking.reminders.sentAt
              ? `Sent ${timeLabel(booking.reminders.sentAt)}`
              : `Scheduled ${timeLabel(booking.reminders.scheduledFor)}`
          }
        />
      </Card>

      <Card className="p-4">
        <p className="text-[13px] font-semibold text-ink">What you told the doctor</p>
        <p className="mt-2 text-[13px] font-medium text-ink">{booking.intake.reason}</p>
        {booking.intake.notes ? (
          <p className="mt-1.5 text-[13px] leading-6 text-ink-muted">{booking.intake.notes}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-pill bg-canvas px-2.5 py-1 text-[11px] text-ink-muted">
            Duration: {booking.intake.duration}
          </span>
          <span className="rounded-pill bg-canvas px-2.5 py-1 text-[11px] text-ink-muted">
            Severity: {booking.intake.severity}/5
          </span>
          <span className="rounded-pill bg-canvas px-2.5 py-1 text-[11px] text-ink-muted">
            {booking.intake.attachProfileHistory ? "History shared" : "History not shared"}
          </span>
        </div>
      </Card>

      {upcoming ? (
        <div className="space-y-2.5">
          {booking.payment.status !== "paid" ? (
            <Button full onClick={onPay} icon={<CardIcon size={18} />}>
              Pay {formatMoney(booking.payment.amount, booking.payment.currency)}
            </Button>
          ) : (
            <Button full onClick={onJoin} disabled={!booking.joinable} icon={<VideoIcon size={18} />}>
              {booking.joinable ? "Join consultation" : "Join opens 10 minutes before"}
            </Button>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="secondary" onClick={onReschedule}>
              Reschedule
            </Button>
            <Button variant="danger" onClick={onCancel}>
              Cancel
            </Button>
          </div>
          <p className="text-center text-[11px] text-ink-muted">
            {refundable
              ? "Cancel now for a full refund to your original payment method."
              : booking.payment.status === "paid"
                ? "This consultation is inside the 2-hour window, so it isn't refundable."
                : "No payment has been taken, so cancelling is free."}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {prescriptionId ? (
            <Link
              href={`/prescriptions/${prescriptionId}`}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-pill bg-primary text-[14px] font-semibold text-white pressable"
            >
              <PillIcon size={18} />
              View prescription
            </Link>
          ) : null}
          <Link
            href={`/records/${booking.id}`}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-pill border border-line bg-surface text-[14px] font-semibold text-ink pressable"
          >
            <NoteIcon size={18} />
            Visit summary
          </Link>
          {booking.status === "completed" && !hasRated ? (
            <Button variant="ghost" full onClick={onRate} icon={<StarIcon size={18} />}>
              Rate this consultation
            </Button>
          ) : hasRated ? (
            <p className="text-center text-[12px] text-ink-muted">
              You rated this consultation. Thank you.
            </p>
          ) : null}
          <Button variant="secondary" full onClick={onClose}>
            Rebook with {booking.doctor.fullName.split(" ").slice(-1)[0]}
          </Button>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="text-[12px] text-ink-muted">{label}</span>
      <span
        className={[
          "text-right text-[13px] font-medium",
          mono ? "font-mono text-[12px]" : "",
          tone === "ok" ? "text-primary-dark" : tone === "warn" ? "text-warning" : "text-ink",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Cancel + reschedule sheets
 * ------------------------------------------------------------------ */

const CANCEL_REASONS = [
  "I feel better already",
  "Something came up at work",
  "I need a different time",
  "I'd rather see a different doctor",
  "The fee is too high right now",
  "Other",
];

function CancelSheet({
  booking,
  onClose,
  onConfirm,
}: {
  booking: BookingView | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState(CANCEL_REASONS[0]);

  useEffect(() => {
    if (booking) setReason(CANCEL_REASONS[0]);
  }, [booking]);

  const hoursOut = booking ? (new Date(booking.startsAt).getTime() - Date.now()) / 3_600_000 : 0;
  const refundable = booking ? booking.payment.status === "paid" && hoursOut >= 2 : false;

  return (
    <Sheet open={Boolean(booking)} onClose={onClose} title="Cancel this consultation?">
      {booking ? (
        <div className="space-y-4">
          <Notice tone={refundable ? "ok" : booking.payment.status === "paid" ? "warn" : "info"} icon={<AlertIcon size={18} />}>
            {refundable ? (
              <>
                You&apos;re more than 2 hours ahead, so{" "}
                <strong>
                  {formatMoney(booking.payment.amount, booking.payment.currency)} will be refunded
                </strong>{" "}
                to your original payment method within 5–7 working days.
              </>
            ) : booking.payment.status === "paid" ? (
              <>
                This consultation starts in under 2 hours. Cancelling now means the fee isn&apos;t
                refundable — you could reschedule instead, at no cost.
              </>
            ) : (
              <>No payment has been taken for this consultation, so cancelling is free.</>
            )}
          </Notice>

          <div>
            <p className="label">Why are you cancelling?</p>
            <div className="space-y-1.5">
              {CANCEL_REASONS.map((r) => (
                <label
                  key={r}
                  className={[
                    "flex cursor-pointer items-center gap-3 rounded-2xl border px-3.5 py-3 text-[13px] transition-colors",
                    reason === r ? "border-primary bg-primary-tint" : "border-line bg-surface",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    name="cancel-reason"
                    className="sr-only"
                    checked={reason === r}
                    onChange={() => setReason(r)}
                  />
                  <span
                    className={[
                      "grid h-5 w-5 shrink-0 place-items-center rounded-full border-[1.5px]",
                      reason === r ? "border-primary bg-primary" : "border-line",
                    ].join(" ")}
                  >
                    {reason === r ? <CheckCircleIcon size={14} className="text-white" /> : null}
                  </span>
                  <span className={reason === r ? "font-medium text-primary-dark" : "text-ink"}>{r}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <Button variant="secondary" onClick={onClose}>
              Keep booking
            </Button>
            <Button variant="danger" onClick={() => onConfirm(reason)}>
              Cancel it
            </Button>
          </div>
        </div>
      ) : null}
    </Sheet>
  );
}

function RescheduleSheet({
  booking,
  onClose,
  onConfirm,
}: {
  booking: BookingView | null;
  onClose: () => void;
  onConfirm: (slotId: string) => void;
}) {
  const store = useStore();
  const days = useMemo(
    () => (booking ? store.slotsFor(booking.doctorId, 14, booking.id) : []),
    [store, booking],
  );
  const [slotId, setSlotId] = useState<string | null>(null);

  useEffect(() => {
    if (!booking) {
      setSlotId(null);
      return;
    }
    const first = days.flatMap((d) => d.slots).find((s) => s.status === "open");
    setSlotId(first?.id ?? null);
  }, [booking, days]);

  return (
    <Sheet
      open={Boolean(booking)}
      onClose={onClose}
      title="Move to another time"
      footer={
        <Button full disabled={!slotId} onClick={() => slotId && onConfirm(slotId)}>
          Confirm new time
        </Button>
      }
    >
      {booking ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl bg-canvas p-3">
            <Avatar initials={initialsOf(booking.doctor.fullName)} accent={booking.doctor.accent} size={40} />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-ink">{booking.doctor.fullName}</p>
              <p className="truncate text-[11px] text-ink-muted">
                Currently {timeLabel(booking.startsAt)} ·{" "}
                {new Date(booking.startsAt).toLocaleDateString(undefined, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </p>
            </div>
          </div>

          <SlotPicker days={days} selectedSlotId={slotId} onSelect={setSlotId} daysToShow={7} />

          <Notice tone="info" icon={<CheckCircleIcon size={18} />}>
            Rescheduling is free and keeps your payment. We&apos;ll send a fresh reminder 30 minutes
            before the new time.
          </Notice>
        </div>
      ) : null}
    </Sheet>
  );
}

