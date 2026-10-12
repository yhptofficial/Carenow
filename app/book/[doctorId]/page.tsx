"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { CareNowError, useCareNow, useStore } from "@/lib/store";
import { RequireAuth } from "@/components/AppShell";
import { DetailHeader } from "@/components/AppHeader";
import { SlotPicker } from "@/components/SlotPicker";
import { Avatar, Button, Card, Checkbox, Notice, SectionTitle } from "@/components/ui";
import { AlertIcon, CheckIcon, ClockIcon, LockIcon, ShieldIcon } from "@/components/Icons";
import { initialsOf } from "@/lib/db";
import { formatMoney } from "@/lib/currency";
import { timeLabel } from "@/lib/schedule";
import type { Intake } from "@/lib/types";

/**
 * Intake + slot hold.
 *
 * Two steps on one screen: choose the time, then tell the doctor why you're
 * coming. The slot is only committed at the end (see step 2) so abandoning the
 * form doesn't block anyone else's booking.
 */
export default function BookPage() {
  return (
    <Suspense fallback={null}>
      {/* Booking needs an account: the slot hold and intake are tied to it. */}
      <RequireAuth skeleton="detail">
        <BookScreen />
      </RequireAuth>
    </Suspense>
  );
}

function BookScreen() {
  const { doctorId } = useParams<{ doctorId: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const store = useStore();
  const { ready } = useCareNow();

  const entry = store.getDoctor(doctorId);
  const days = useMemo(() => store.slotsFor(doctorId, 14), [store, doctorId]);

  const [step, setStep] = useState<1 | 2>(1);
  const [slotId, setSlotId] = useState<string | null>(params.get("slot"));
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [duration, setDuration] = useState("");
  const [severity, setSeverity] = useState(3);
  const [attach, setAttach] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Default to the soonest open slot when arriving without a preselection.
  useEffect(() => {
    if (slotId || days.length === 0) return;
    const first = days.flatMap((d) => d.slots).find((s) => s.status === "open");
    if (first) setSlotId(first.id);
  }, [days, slotId]);

  const slot = days.flatMap((d) => d.slots).find((s) => s.id === slotId);
  const canSubmit = reason.trim().length >= 4 && duration.trim().length > 0;

  if (!ready) {
    return (
      <div className="app-scroll">
        <DetailHeader title="Book a consultation" />
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="min-h-[100dvh]">
        <DetailHeader title="Doctor not available" backHref="/find" />
      </div>
    );
  }

  const { doctor } = entry;

  function submit() {
    setError(null);
    if (!slotId || !slot) {
      setError("Choose a time first.");
      setStep(1);
      return;
    }
    setBusy(true);
    const intake: Intake = {
      reason: reason.trim(),
      notes: notes.trim(),
      duration: duration.trim(),
      severity,
      attachProfileHistory: attach,
    };
    try {
      const booking = store.createBooking({ doctorId: doctor.id, slotId, intake });
      router.replace(`/checkout/${booking.id}`);
    } catch (e) {
      const err = e as CareNowError;
      setError(err.hint ? `${err.message} ${err.hint}` : err.message);
      setBusy(false);
      if (err.code === "slot_taken" || err.code === "not_found") setStep(1);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <DetailHeader
        title="Book a consultation"
        subtitle={`Step ${step} of 2 · ${doctor.fullName}`}
        backHref={step === 2 ? undefined : `/doctors/${doctor.id}`}
        onBack={step === 2 ? () => setStep(1) : undefined}
      />

      <div className="app-scroll flex-1">
        {/* -------- Doctor summary -------- */}
        <Card className="mb-5 flex items-center gap-3 p-card">
          <Avatar initials={initialsOf(doctor.fullName)} accent={doctor.accent} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-card font-semibold text-ink">{doctor.fullName}</p>
            <p className="truncate text-sub text-ink-muted">
              {entry.specialtyLabel} · {doctor.yearsExperience} yrs
            </p>
          </div>
          <p className="shrink-0 text-[13px] font-semibold text-ink">{formatMoney(doctor.consultationFee, doctor.currency)}</p>
        </Card>

        {step === 1 ? (
          <div className="space-y-section">
            <section>
              <SectionTitle>Choose a time</SectionTitle>
              <Card className="p-4">
                <SlotPicker days={days} selectedSlotId={slotId} onSelect={setSlotId} daysToShow={7} />
              </Card>
            </section>

            {slot ? (
              <Notice tone="info" icon={<ClockIcon size={18} />} title="Your slot">
                {new Date(slot.startsAt).toLocaleDateString(undefined, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}{" "}
                at {timeLabel(slot.startsAt)}, {slot.durationMins} minutes. We&apos;ll hold it while
                you fill in the intake form.
              </Notice>
            ) : null}
          </div>
        ) : (
          <div className="space-y-section">
            <Notice tone="ok" icon={<CheckIcon size={18} />} title="Time held">
              {slot
                ? `${new Date(slot.startsAt).toLocaleDateString(undefined, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })} · ${timeLabel(slot.startsAt)}`
                : ""}{" "}
              with {doctor.fullName}
            </Notice>

            <section>
              <SectionTitle>Tell the doctor what&apos;s wrong</SectionTitle>
              <Card className="space-y-4 p-4">
                <div>
                  <label className="label" htmlFor="reason">
                    Main problem
                  </label>
                  <input
                    id="reason"
                    className="field"
                    placeholder="e.g. Itchy rash on both arms"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={90}
                  />
                  <p className="mt-1.5 text-[11px] text-ink-muted">
                    One line. This is what the doctor sees first.
                  </p>
                </div>

                <div>
                  <label className="label" htmlFor="notes">
                    Describe it in your own words
                  </label>
                  <textarea
                    id="notes"
                    rows={5}
                    className="field resize-none leading-6"
                    placeholder="When it started, what makes it worse, what you've already tried…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={800}
                  />
                  <p className="mt-1.5 text-right text-[11px] text-ink-muted">
                    {notes.length}/800
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label" htmlFor="duration">
                      How long?
                    </label>
                    <select
                      id="duration"
                      className="field appearance-none"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                    >
                      <option value="">Select…</option>
                      {["Today", "2–3 days", "About a week", "2–4 weeks", "Over a month", "Longer"].map(
                        (d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                  <div>
                    <span className="label">How bad is it?</span>
                    <div className="flex h-[50px] items-center gap-1.5" role="radiogroup" aria-label="Severity">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          role="radio"
                          aria-checked={severity === n}
                          aria-label={`Severity ${n} of 5`}
                          onClick={() => setSeverity(n)}
                          className={[
                            "h-8 flex-1 rounded-xl border text-[12px] font-medium transition-colors",
                            severity >= n
                              ? "border-primary bg-primary-tint text-primary-dark"
                              : "border-line bg-surface text-ink-muted",
                          ].join(" ")}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="-mt-2 text-[11px] text-ink-muted">
                  1 = barely notice it · 5 = can&apos;t do your normal day. If it&apos;s 5 and getting
                  worse quickly, seek in-person care instead.
                </p>

                <div className="border-t border-line pt-1">
                  <Checkbox checked={attach} onChange={setAttach}>
                    Share my saved health history (allergies, conditions, current medication) with
                    this doctor.
                  </Checkbox>
                </div>
              </Card>
            </section>

            <Notice tone="info" icon={<LockIcon size={18} />} title="Who can read this">
              Only {doctor.fullName} and the CareNow clinical team reviewing this booking. It is never
              shown to other patients or doctors.
            </Notice>
          </div>
        )}

        {error ? (
          <div className="mt-4">
            <Notice tone="danger" icon={<AlertIcon size={18} />}>
              {error}
            </Notice>
          </div>
        ) : null}
      </div>

      <div
        className="sticky bottom-0 border-t border-line bg-canvas/95 px-gutter pt-3 backdrop-blur-md"
        style={{ paddingBottom: "calc(12px + var(--safe-b))" }}
      >
        {step === 1 ? (
          <Button full disabled={!slotId} onClick={() => setStep(2)}>
            Continue
          </Button>
        ) : (
          <div className="space-y-2">
            <Button full loading={busy} disabled={!canSubmit} onClick={submit}>
              Review and pay {formatMoney(doctor.consultationFee, doctor.currency)}
            </Button>
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-ink-muted">
              <ShieldIcon size={13} />
              Nothing is charged until you confirm on the next screen.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
