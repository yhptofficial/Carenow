"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CareNowError, useCareNow, useStore } from "@/lib/store";
import { RequireAuth } from "@/components/AppShell";
import { DetailHeader } from "@/components/AppHeader";
import { Avatar, Button, Card, Notice, SectionTitle } from "@/components/ui";
import {
  AlertIcon,
  CalendarIcon,
  CardIcon,
  CheckCircleIcon,
  ClockIcon,
  LockIcon,
  ShieldIcon,
} from "@/components/Icons";
import { initialsOf } from "@/lib/db";
import { formatMoney } from "@/lib/currency";
import { timeLabel } from "@/lib/schedule";

/**
 * Checkout.
 *
 * A consultation is confirmed only once payment is captured, matching the PRD's
 * "pay before it's confirmed". The card form is a faithful simulation of a
 * hosted provider: test numbers reach the decline path, the 3-D Secure path and
 * the success path — see TEST_CARDS below and the note on screen.
 */
const TEST_CARDS = [
  { number: "4242 4242 4242 4242", label: "Succeeds", hint: "any future expiry, any CVC" },
  { number: "4000 0000 0000 0001", label: "Requires 3-D Secure", hint: "you'll approve in a sheet" },
  { number: "0002 0000 0000 0000", label: "Declined by bank", hint: "insufficient funds" },
];

export default function CheckoutPage() {
  return (
    <RequireAuth skeleton="detail">
      <CheckoutScreen />
    </RequireAuth>
  );
}

function CheckoutScreen() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const router = useRouter();
  const store = useStore();
  const { ready } = useCareNow();

  const booking = store.getBooking(bookingId);

  const [number, setNumber] = useState("4242 4242 4242 4242");
  const [expiry, setExpiry] = useState("12/29");
  const [cvc, setCvc] = useState("123");
  const [name, setName] = useState(store.session?.fullName ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  /** Simulated 3-D Secure step. */
  const [threeDS, setThreeDS] = useState(false);

  // A booking that's already paid has nothing to do here.
  useEffect(() => {
    if (booking && booking.payment.status === "paid" && booking.status === "confirmed") {
      router.replace(`/bookings?confirmed=${booking.id}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready)
    return (
      <div className="app-scroll">
        <DetailHeader title="Payment" />
      </div>
    );

  if (!booking) {
    return (
      <div className="min-h-[100dvh]">
        <DetailHeader title="Payment" backHref="/bookings" />
        <div className="px-gutter">
          <Notice tone="danger" icon={<AlertIcon size={18} />} title="Booking not found">
            That booking link has expired. Start again from Find a doctor.
          </Notice>
        </div>
      </div>
    );
  }

  const { doctor } = booking;
  const fee = booking.payment.amount;
  const platformFee = 0;
  const total = fee + platformFee;

  function pay() {
    setError(null);
    setErrorHint(null);
    setBusy(true);

    // Simulate the provider's 3-D Secure challenge for the 0001 test card.
    if (number.replace(/\D/g, "").startsWith("4000")) {
      setBusy(false);
      setThreeDS(true);
      return;
    }
    capture();
  }

  function capture() {
    setBusy(true);
    try {
      store.payBooking(bookingId, { number, expiry, cvc, name });
      router.replace(`/bookings?confirmed=${bookingId}`);
    } catch (e) {
      const err = e as CareNowError;
      setError(err.message);
      setErrorHint(err.hint ?? null);
      setBusy(false);
      setThreeDS(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <DetailHeader title="Payment" subtitle="Confirm your consultation" backHref={`/book/${doctor.id}`} />

      <div className="app-scroll flex-1">
        <div className="space-y-section">
          {/* -------- Order summary -------- */}
          <section>
            <SectionTitle>Your consultation</SectionTitle>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <Avatar initials={initialsOf(doctor.fullName)} accent={doctor.accent} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-card font-semibold text-ink">{doctor.fullName}</p>
                  <p className="truncate text-sub text-ink-muted">{doctor.qualifications}</p>
                </div>
              </div>

              <dl className="mt-4 space-y-2.5 border-t border-line pt-4 text-[13px]">
                <div className="flex items-start gap-2 text-ink">
                  <CalendarIcon size={17} />
                  <div>
                    <dt className="sr-only">Appointment</dt>
                    <dd>
                      {new Date(booking.startsAt).toLocaleDateString(undefined, {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-ink">
                  <ClockIcon size={17} />
                  <div>
                    <dt className="sr-only">Time</dt>
                    <dd>
                      {timeLabel(booking.startsAt)} · {booking.durationMins} minutes
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-ink-muted">
                  <CheckCircleIcon size={17} />
                  <div>
                    <dt className="sr-only">Reason</dt>
                    <dd>{booking.intake.reason}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-ink-muted">
                  <CardIcon size={17} />
                  <div>
                    <dt className="sr-only">Reference</dt>
                    <dd>Booking {booking.reference}</dd>
                  </div>
                </div>
              </dl>
            </Card>
          </section>

          {/* -------- Card form -------- */}
          <section>
            <SectionTitle>Card details</SectionTitle>
            <Card className="space-y-4 p-4">
              <div>
                <label className="label" htmlFor="card-number">
                  Card number
                </label>
                <div className="relative">
                  <input
                    id="card-number"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    className="field pr-12 tracking-[0.06em]"
                    value={number}
                    onChange={(e) => setNumber(formatCard(e.target.value))}
                    placeholder="1234 1234 1234 1234"
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted">
                    <CardIcon size={20} />
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="card-expiry">
                    Expiry
                  </label>
                  <input
                    id="card-expiry"
                    inputMode="numeric"
                    autoComplete="cc-exp"
                    className="field"
                    value={expiry}
                    onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                    placeholder="MM/YY"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="card-cvc">
                    CVC
                  </label>
                  <input
                    id="card-cvc"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    className="field"
                    value={cvc}
                    onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="123"
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="card-name">
                  Name on card
                </label>
                <input
                  id="card-name"
                  autoComplete="cc-name"
                  className="field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="As printed on the card"
                />
              </div>

              <div className="border-t border-line pt-3">
                <p className="text-[11px] font-medium text-ink-muted">Test cards</p>
                <ul className="mt-2 space-y-1.5">
                  {TEST_CARDS.map((c) => (
                    <li key={c.number}>
                      <button
                        type="button"
                        onClick={() => setNumber(c.number)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-1.5 text-left pressable hover:bg-canvas"
                      >
                        <span className="font-mono text-[11px] text-ink">{c.number}</span>
                        <span className="shrink-0 text-[10px] text-ink-muted">{c.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          </section>

          {error ? (
            <Notice tone="danger" icon={<AlertIcon size={18} />} title="Payment failed">
              {error}
              {errorHint ? <span className="mt-1 block">{errorHint}</span> : null}
              <span className="mt-2 block text-[11px] opacity-90">
                Nothing has been charged. You can retry with another card, or keep the slot and pay
                before it starts.
              </span>
            </Notice>
          ) : null}

          {/* -------- Totals -------- */}
          <Card className="p-4">
            <dl className="space-y-2 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-ink-muted">Consultation fee</dt>
                <dd className="text-ink">{formatMoney(fee, booking.payment.currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">Platform fee</dt>
                <dd className="text-ink">{formatMoney(platformFee, booking.payment.currency)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-2.5 text-[15px] font-semibold">
                <dt className="text-ink">Total payable</dt>
                <dd className="text-ink">{formatMoney(total, booking.payment.currency)}</dd>
              </div>
            </dl>
            <p className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-ink-muted">
              <ShieldIcon size={14} />
              <span>
                Full refund if you cancel more than 2 hours before the start time, or if the doctor
                doesn&apos;t join within 10 minutes.
              </span>
            </p>
          </Card>

          <Notice tone="info" icon={<LockIcon size={18} />} title="Test mode">
            This build uses a simulated payment provider. No real card is charged and no card data
            leaves your device — in production this form is replaced by the provider&apos;s hosted
            fields.
          </Notice>
        </div>
      </div>

      <div
        className="sticky bottom-0 border-t border-line bg-canvas/95 px-gutter pt-3 backdrop-blur-md"
        style={{ paddingBottom: "calc(12px + var(--safe-b))" }}
      >
        <Button full loading={busy} onClick={pay}>
          Pay {formatMoney(total, booking.payment.currency)} and confirm
        </Button>
      </div>

      {/* -------- Simulated 3-D Secure -------- */}
      {threeDS ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center">
          <div className="absolute inset-0 bg-[rgba(15,40,36,0.35)] backdrop-blur-[2px]" />
          <div className="relative w-full max-w-[440px] rounded-t-[24px] bg-surface p-5 shadow-sheet animate-sheet-up"
               style={{ paddingBottom: "calc(20px + var(--safe-b))" }}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              Your bank
            </p>
            <h2 className="mt-1 text-[17px] font-bold text-ink">Approve this payment</h2>
            <p className="mt-2 text-[13px] leading-6 text-ink-muted">
              A {formatMoney(total, booking.payment.currency)} payment to{" "}
              <span className="font-medium text-ink">CareNow Health</span> is waiting for your
              approval. In the live app this screen belongs to your bank — we never
              see your one-time code.
            </p>
            <div className="mt-4 rounded-2xl bg-canvas px-4 py-3 text-[13px]">
              <div className="flex justify-between">
                <span className="text-ink-muted">Card</span>
                <span className="font-mono text-ink">
                  •••• {number.replace(/\D/g, "").slice(-4)}
                </span>
              </div>
              <div className="mt-2 flex justify-between">
                <span className="text-ink-muted">Amount</span>
                <span className="font-medium text-ink">{formatMoney(total, booking.payment.currency)}</span>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Button variant="secondary" onClick={() => setThreeDS(false)}>
                Cancel
              </Button>
              <Button loading={busy} onClick={capture}>
                Approve
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatCard(v: string): string {
  const digits = v.replace(/\D/g, "").slice(0, 19);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(v: string): string {
  const digits = v.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}
