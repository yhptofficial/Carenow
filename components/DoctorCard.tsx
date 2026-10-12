"use client";

import Link from "next/link";
import { Avatar, Chevron, RatingBadge } from "./ui";
import { ClockIcon, ShieldIcon } from "./Icons";
import type { Doctor } from "@/lib/types";
import type { DoctorView } from "@/lib/store";

/**
 * Doctor card.
 *
 * Left: initials avatar. Centre: name, specialty + experience, then a row with
 * the rating pill and next-available time. Right: grey chevron. The whole card
 * is the tap target and shows a subtle press state.
 */
export function DoctorCard({
  view,
  href,
  showVerifyBadge = false,
}: {
  view: DoctorView;
  href?: string;
  showVerifyBadge?: boolean;
}) {
  const { doctor, next, initials, specialtyLabel } = view;

  return (
    <Link
      href={href ?? `/doctors/${doctor.id}`}
      className="card flex items-center gap-3 p-card pressable"
      aria-label={`${doctor.fullName}, ${specialtyLabel}. View profile and times.`}
    >
      <Avatar initials={initials} accent={doctor.accent} size={44} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-card font-semibold text-ink">{doctor.fullName}</p>
        <p className="truncate text-sub text-ink-muted">
          {specialtyLabel} · {doctor.yearsExperience} yrs exp
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <RatingBadge rating={doctor.rating} count={doctor.ratingCount} />
          {next ? (
            <span className="inline-flex items-center gap-1 text-meta font-medium text-ink-muted">
              <ClockIcon size={13} />
              <span className={next.soon ? "text-primary-dark" : undefined}>
                {next.dayLabel} · {next.timeLabel}
              </span>
            </span>
          ) : (
            <span className="text-meta font-medium text-ink-muted">No slots this week</span>
          )}
        </div>

        {showVerifyBadge ? (
          <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary-dark">
            <ShieldIcon size={13} />
            Licence verified · {doctor.verification.licenceNumber}
          </p>
        ) : null}
      </div>

      <Chevron />
    </Link>
  );
}

/** Compact row used inside the doctor's own dashboard. */
export function DoctorRow({ doctor, initials }: { doctor: Doctor; initials: string }) {
  return (
    <div className="flex items-center gap-3 p-card">
      <Avatar initials={initials} accent={doctor.accent} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-card font-semibold text-ink">{doctor.fullName}</p>
        <p className="truncate text-sub text-ink-muted">{doctor.qualifications}</p>
      </div>
      <RatingBadge rating={doctor.rating} />
    </div>
  );
}
