"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { RequireAuth } from "@/components/AppShell";
import { DetailHeader } from "@/components/AppHeader";
import { Chevron, EmptyState, Notice } from "@/components/ui";
import { PillIcon, ShieldIcon } from "@/components/Icons";

/** Every prescription the patient holds, with the follow-up date called out. */
export default function PrescriptionsPage() {
  return (
    <RequireAuth skeleton="list">
      <PrescriptionsScreen />
    </RequireAuth>
  );
}

function PrescriptionsScreen() {
  const store = useStore();
  const list = store.myPrescriptions();

  return (
    <div className="min-h-[100dvh]">
      <DetailHeader
        title="Prescriptions"
        subtitle={`${list.length} on file`}
      />

      <div className="app-scroll">
        <div className="space-y-section">
          {list.length === 0 ? (
            <EmptyState
              icon={<PillIcon size={24} />}
              title="No prescriptions yet"
              body="A doctor writes these during a consultation. Once signed, they appear here and never expire."
            />
          ) : (
            <ul className="space-y-3">
              {list.map((rx) => {
                const followUp = followUpDate(rx.issuedAt, rx.followUpInDays);
                return (
                  <li key={rx.id}>
                    <Link href={`/prescriptions/${rx.id}`} className="card block p-card pressable">
                      <div className="flex items-center gap-3">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary-tint text-primary-dark">
                          <PillIcon size={22} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-card font-semibold text-ink">{rx.diagnosis}</p>
                          <p className="truncate text-sub text-ink-muted">
                            {rx.doctor?.fullName ?? "CareNow doctor"} ·{" "}
                            {new Date(rx.issuedAt).toLocaleDateString(undefined, {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                        <Chevron />
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-pill bg-canvas px-2.5 py-1 text-[11px] text-ink-muted">
                          {rx.medications.length}{" "}
                          {rx.medications.length === 1 ? "medicine" : "medicines"}
                        </span>
                        {rx.sickNote ? (
                          <span className="rounded-pill bg-canvas px-2.5 py-1 text-[11px] text-ink-muted">
                            Includes sick note
                          </span>
                        ) : null}
                        {followUp ? (
                          <span className="rounded-pill bg-primary-tint px-2.5 py-1 text-[11px] font-medium text-primary-dark">
                            Follow-up {followUp}
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <Notice tone="info" icon={<ShieldIcon size={18} />} title="Show this at any pharmacy">
            Your prescription carries the doctor&apos;s registration number, so a pharmacist can
            verify it. Download or print it from the prescription screen.
          </Notice>
        </div>
      </div>
    </div>
  );
}

function followUpDate(issuedAt: string, days: number): string | null {
  if (!days) return null;
  const d = new Date(new Date(issuedAt).getTime() + days * 86_400_000);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
