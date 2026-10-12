"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCareNow, useStore } from "@/lib/store";
import { DetailHeader } from "@/components/AppHeader";
import { SlotPicker } from "@/components/SlotPicker";
import { Avatar, Button, Card, Notice, RatingBadge, SectionTitle } from "@/components/ui";
import {
  AlertIcon,
  CheckCircleIcon,
  ClockIcon,
  MapPinIcon,
  NoteIcon,
  ShieldIcon,
  StarIcon,
  VideoIcon,
} from "@/components/Icons";
import { initialsOf } from "@/lib/db";
import { timeLabel } from "@/lib/schedule";
import { formatMoney } from "@/lib/currency";

export function DoctorProfile({ doctorId }: { doctorId: string }) {
  const store = useStore();
  const { ready } = useCareNow();
  const router = useRouter();
  const [slotId, setSlotId] = useState<string | null>(null);

  const entry = store.getDoctor(doctorId);
  const days = useMemo(() => store.slotsFor(doctorId, 14), [store, doctorId]);
  const reviews = useMemo(() => store.ratingsFor(doctorId), [store, doctorId]);

  // Preselect the soonest open slot so "Continue" is one tap away.
  useEffect(() => {
    if (slotId || days.length === 0) return;
    const first = days.flatMap((d) => d.slots).find((s) => s.status === "open");
    if (first) setSlotId(first.id);
  }, [days, slotId]);

  if (!ready) {
    return (
      <div className="app-scroll">
        <DetailHeader title="Doctor profile" />
      </div>
    );
  }

  // Unverified doctors are never linked, so this only fires on a stale URL.
  if (!entry || !entry.doctor.verified) {
    return (
      <div className="min-h-[100dvh]">
        <DetailHeader title="Doctor not available" backHref="/find" />
        <div className="px-gutter">
          <Card className="p-6 text-center">
            <p className="text-[15px] font-semibold text-ink">This profile isn&apos;t listed</p>
            <p className="mt-1 text-sub text-ink-muted">
              Either the doctor is still being verified or they&apos;re no longer taking consultations.
            </p>
            <Button className="mt-4" size="md" onClick={() => router.push("/find")}>
              Browse verified doctors
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const { doctor } = entry;
  const initials = initialsOf(doctor.fullName);
  const slot = days.flatMap((d) => d.slots).find((s) => s.id === slotId);

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <DetailHeader
        title={doctor.fullName}
        subtitle={entry.specialtyLabel}
        backHref="/find"
        trailing={
          <span className="rounded-pill bg-primary-tint px-2.5 py-1 text-[11px] font-semibold text-primary-dark">
            {formatMoney(doctor.consultationFee, doctor.currency)}
          </span>
        }
      />

      <div className="app-scroll flex-1 !pb-6">
        <div className="space-y-section">
          {/* -------- Identity -------- */}
          <Card className="p-4">
            <div className="flex items-start gap-4">
              <Avatar initials={initials} accent={doctor.accent} size={64} className="text-[22px]" />
              <div className="min-w-0 flex-1">
                <h1 className="text-[18px] font-bold leading-6 text-ink">{doctor.fullName}</h1>
                <p className="mt-0.5 text-sub text-ink-muted">{doctor.qualifications}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <RatingBadge rating={doctor.rating} count={doctor.ratingCount} />
                  <span className="inline-flex items-center gap-1 text-meta font-medium text-ink-muted">
                    <ClockIcon size={13} />
                    {doctor.yearsExperience} yrs experience
                  </span>
                </div>
              </div>
            </div>

            <p className="mt-4 text-[13px] leading-6 text-ink-muted">{doctor.bio}</p>

            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4">
              <div>
                <dt className="text-[11px] text-ink-muted">Languages</dt>
                <dd className="mt-0.5 text-[13px] font-medium text-ink">
                  {doctor.languages.join(", ")}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-ink-muted">Consultation fee</dt>
                <dd className="mt-0.5 text-[13px] font-medium text-ink">
                  {formatMoney(doctor.consultationFee, doctor.currency)} · {doctor.currency}
                </dd>
              </div>
            </dl>

            <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-primary-tint px-3.5 py-3">
              <span className="mt-0.5 text-primary-dark">
                <ShieldIcon size={17} />
              </span>
              <p className="text-[12px] leading-5 text-primary-dark">
                <span className="font-semibold">Verified by CareNow.</span> Registration{" "}
                {doctor.verification.licenceNumber}, checked{" "}
                {new Date(doctor.verification.verifiedAt).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                .
              </p>
            </div>
          </Card>

          {/* -------- Availability -------- */}
          <section>
            <SectionTitle
              action={
                <span className="text-sub text-ink-muted">Your timezone</span>
              }
            >
              Available times
            </SectionTitle>
            <Card className="p-4">
              <SlotPicker
                days={days}
                selectedSlotId={slotId}
                onSelect={setSlotId}
                daysToShow={7}
              />
            </Card>
          </section>

          {/* -------- What happens next -------- */}
          <section>
            <SectionTitle>What happens next</SectionTitle>
            <Card className="divide-y divide-line p-0">
              <Step
                n={1}
                icon={<NoteIcon size={18} />}
                title="Share why you're booking"
                body="A short intake form goes to the doctor before the call so you don't repeat yourself."
              />
              <Step
                n={2}
                icon={<VideoIcon size={18} />}
                title="Pay and get a reminder"
                body="Your slot is held while you pay. We email and text you 30 minutes before."
              />
              <Step
                n={3}
                icon={<CheckCircleIcon size={18} />}
                title="Join from anywhere"
                body="A secure link opens in your phone browser. Prescription and notes arrive right after."
              />
            </Card>
          </section>

          {/* -------- Reviews -------- */}
          {reviews.length > 0 ? (
            <section>
              <SectionTitle>
                Patient reviews
                <span className="ml-2 text-sub font-normal text-ink-muted">
                  {doctor.ratingCount} total
                </span>
              </SectionTitle>
              <ul className="space-y-3">
                {reviews.slice(0, 3).map((r) => (
                  <li key={r.id} className="card p-card">
                    <div className="flex items-center gap-1 text-[#E9A23B]">
                      {Array.from({ length: r.stars }).map((_, i) => (
                        <StarIcon key={i} size={13} />
                      ))}
                    </div>
                    {r.comment ? (
                      <p className="mt-2 text-[13px] leading-5 text-ink">{r.comment}</p>
                    ) : null}
                    <p className="mt-2 text-[11px] text-ink-muted">
                      Verified consultation ·{" "}
                      {new Date(r.createdAt).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <Notice tone="warn" icon={<AlertIcon size={18} />} title="Video consultation limits">
            A doctor can&apos;t examine you physically or order imaging during a video call. If your
            problem needs hands-on assessment, they&apos;ll tell you and refer you to a clinic.
          </Notice>

          <p className="flex items-center justify-center gap-1.5 pb-2 text-[11px] text-ink-muted">
            <MapPinIcon size={13} />
            Practises in {doctor.city} · online only
          </p>
        </div>
      </div>

      {/* -------- Sticky CTA -------- */}
      <div
        className="sticky bottom-0 border-t border-line bg-canvas/95 px-gutter pt-3 backdrop-blur-md"
        style={{ paddingBottom: "calc(12px + var(--safe-b))" }}
      >
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <div className="min-w-0 text-[12px] text-ink-muted">
            {slot ? (
              <>
                <span className="font-medium text-ink">{timeLabel(slot.startsAt)}</span> ·{" "}
                {slot.durationMins} min ·{" "}
                {new Date(slot.startsAt).toLocaleDateString(undefined, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </>
            ) : (
              "Pick a time to continue"
            )}
          </div>
          <span className="shrink-0 text-[13px] font-semibold text-ink">
            {formatMoney(doctor.consultationFee, doctor.currency)}
          </span>
        </div>
        <Button
          full
          disabled={!slotId}
          onClick={() => router.push(`/book/${doctor.id}?slot=${slotId}`)}
        >
          Continue to book
        </Button>
      </div>
    </div>
  );
}

function Step({
  n,
  icon,
  title,
  body,
}: {
  n: number;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3 p-card">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-tint text-primary-dark">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-ink">
          <span className="text-ink-muted">{n}. </span>
          {title}
        </p>
        <p className="mt-0.5 text-sub leading-5 text-ink-muted">{body}</p>
      </div>
    </div>
  );
}
