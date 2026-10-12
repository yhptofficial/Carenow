"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { RequireAuth } from "@/components/AppShell";
import { DetailHeader } from "@/components/AppHeader";
import { Avatar, Card, Chevron, EmptyState, Notice } from "@/components/ui";
import { DownloadIcon, HistoryIcon, PillIcon, ShieldIcon } from "@/components/Icons";
import { initialsOf } from "@/lib/db";
import { timeLabel } from "@/lib/schedule";

/** Visit history — every consultation the patient has ever had, newest first. */
export default function RecordsPage() {
  return (
    <RequireAuth skeleton="list">
      <RecordsScreen />
    </RequireAuth>
  );
}

function RecordsScreen() {
  const store = useStore();
  const visits = store.pastBookings();

  return (
    <div className="min-h-[100dvh]">
      <DetailHeader title="Visit history" subtitle={`${visits.length} consultation${visits.length === 1 ? "" : "s"}`} />

      <div className="app-scroll">
        <div className="space-y-section">
          {visits.length === 0 ? (
            <EmptyState
              icon={<HistoryIcon size={24} />}
              title="No consultations yet"
              body="After your first video consultation, the summary and any prescription live here forever."
            />
          ) : (
            <ul className="space-y-3">
              {visits.map((b) => {
                const rx = store.prescriptionForBooking(b.id);
                return (
                  <li key={b.id}>
                    <Card className="p-card">
                      <Link href={`/records/${b.id}`} className="flex items-center gap-3">
                        <Avatar
                          initials={initialsOf(b.doctor.fullName)}
                          accent={b.doctor.accent}
                          size={40}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-card font-semibold text-ink">
                            {b.doctor.fullName}
                          </p>
                          <p className="truncate text-sub text-ink-muted">{b.intake.reason}</p>
                          <p className="mt-1 text-[11px] text-ink-muted">
                            {new Date(b.startsAt).toLocaleDateString(undefined, {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}{" "}
                            · {timeLabel(b.startsAt)}
                          </p>
                        </div>
                        <Chevron />
                      </Link>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {rx ? (
                          <Link
                            href={`/prescriptions/${rx.id}`}
                            className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-primary-tint px-3.5 text-chip font-medium text-primary-dark pressable"
                          >
                            <PillIcon size={15} />
                            Prescription
                          </Link>
                        ) : null}
                        <Link
                          href={`/records/${b.id}?print=1`}
                          className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-canvas px-3.5 text-chip font-medium text-ink pressable"
                        >
                          <DownloadIcon size={15} />
                          Summary
                        </Link>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}

          <Notice tone="info" icon={<ShieldIcon size={18} />} title="How long we keep this">
            Consultation records are kept for as long as your account exists, because your doctor may
            need them for follow-up care. Ask us to delete your account and everything goes with it.
          </Notice>
        </div>
      </div>
    </div>
  );
}
