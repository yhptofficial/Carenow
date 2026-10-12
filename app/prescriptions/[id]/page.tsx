"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCareNow, useStore } from "@/lib/store";
import { RequireAuth } from "@/components/AppShell";
import { DetailHeader } from "@/components/AppHeader";
import { Card, Notice } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { AlertIcon, PillIcon, ShieldIcon } from "@/components/Icons";

/**
 * The prescription itself.
 *
 * Laid out as a document rather than an app screen: letterhead, patient block,
 * Rx list, then the prescriber's registration. The print stylesheet strips the
 * chrome so this is exactly what comes out of a printer or "Save as PDF".
 */
export default function PrescriptionPage() {
  return (
    <RequireAuth skeleton="detail">
      <Prescription />
    </RequireAuth>
  );
}

function Prescription() {
  const { id } = useParams<{ id: string }>();
  const store = useStore();
  const { ready } = useCareNow();

  const rx = store.getPrescription(id);

  if (!ready) return <div className="app-scroll"><DetailHeader title="Prescription" /></div>;

  if (!rx) {
    return (
      <div className="min-h-[100dvh]">
        <DetailHeader title="Prescription" backHref="/profile/prescriptions" />
        <div className="px-gutter">
          <Notice tone="danger" icon={<AlertIcon size={18} />} title="Prescription not found">
            This prescription either doesn&apos;t exist or belongs to another patient&apos;s account.
            CareNow scopes every record to its owner.
          </Notice>
        </div>
      </div>
    );
  }

  const doctor = rx.doctor;
  const patient = rx.patient;

  return (
    <div className="min-h-[100dvh]">
      <DetailHeader
        title="Prescription"
        subtitle={rx.diagnosis}
        backHref="/profile/prescriptions"
        trailing={<PrintButton />}
      />

      <div className="app-scroll">
        <div className="space-y-section">
          {/* -------- Document -------- */}
          <Card className="p-5">
            {/* Letterhead */}
            <div className="flex items-start justify-between gap-3 border-b-2 border-primary pb-4">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-[12px] bg-primary text-white">
                  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M16.4 6.6A6.6 6.6 0 1 0 16.4 17.4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                    <path d="M12 8.6v6.8M8.6 12h6.8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                  </svg>
                </span>
                <div>
                  <p className="text-[14px] font-bold leading-4 text-ink">CareNow</p>
                  <p className="text-[10px] text-ink-muted">Telemedicine · Rx</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wide text-ink-muted">Prescription</p>
                <p className="font-mono text-[11px] text-ink">{rx.id.slice(-10).toUpperCase()}</p>
              </div>
            </div>

            {/* Prescriber */}
            <div className="mt-4">
              <p className="text-[14px] font-semibold text-ink">{doctor?.fullName ?? "CareNow doctor"}</p>
              <p className="text-[12px] text-ink-muted">{doctor?.qualifications}</p>
              <p className="mt-0.5 text-[11px] text-ink-muted">
                Reg. No. {doctor?.verification.licenceNumber} · verified{" "}
                {doctor ? new Date(doctor.verification.verifiedAt).toLocaleDateString() : "—"}
              </p>
            </div>

            {/* Patient */}
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl bg-canvas p-3.5 text-[12px]">
              <div>
                <p className="text-[10px] text-ink-muted">Patient</p>
                <p className="mt-0.5 font-medium text-ink">{patient?.fullName ?? "—"}</p>
              </div>
              <div>
                <p className="text-[10px] text-ink-muted">Age / Sex</p>
                <p className="mt-0.5 font-medium text-ink">
                  {patient?.age ? `${patient.age} yrs` : "—"}
                  {patient?.gender && patient.gender !== "undisclosed" ? ` / ${patient.gender[0].toUpperCase()}` : ""}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-ink-muted">Date</p>
                <p className="mt-0.5 font-medium text-ink">
                  {new Date(rx.issuedAt).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-ink-muted">Consultation</p>
                <p className="mt-0.5 font-mono text-[11px] font-medium text-ink">
                  {rx.booking?.reference ?? "—"}
                </p>
              </div>
              {patient?.allergies.length ? (
                <div className="col-span-2">
                  <p className="text-[10px] text-ink-muted">Known allergies</p>
                  <p className="mt-0.5 font-semibold text-danger">{patient.allergies.join(", ")}</p>
                </div>
              ) : null}
            </div>

            {/* Diagnosis */}
            <div className="mt-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                Diagnosis
              </p>
              <p className="mt-1 text-[14px] font-semibold text-ink">{rx.diagnosis}</p>
            </div>

            {/* Rx */}
            <div className="mt-5">
              <p className="flex items-baseline gap-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                <span className="font-serif text-[20px] font-bold leading-none text-primary">℞</span>
                Medicines
              </p>
              <ol className="mt-3 space-y-3">
                {rx.medications.map((m, i) => (
                  <li key={`${m.name}-${i}`} className="rounded-2xl border border-line p-3.5">
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary-tint text-[11px] font-semibold text-primary-dark">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold text-ink">{m.name}</p>
                        <p className="mt-1 text-[12px] text-ink-muted">
                          {m.dosage} — {m.frequency}
                        </p>
                        <p className="mt-0.5 text-[12px] text-ink-muted">For {m.duration}</p>
                        {m.notes ? (
                          <p className="mt-2 rounded-xl bg-canvas px-3 py-2 text-[11px] leading-5 text-ink-muted">
                            {m.notes}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Advice */}
            {rx.advice ? (
              <div className="mt-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                  Advice
                </p>
                <p className="mt-1.5 text-[13px] leading-6 text-ink">{rx.advice}</p>
              </div>
            ) : null}

            {/* Sick note */}
            {rx.sickNote ? (
              <div className="mt-5 rounded-2xl bg-primary-tint p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-dark">
                  Fitness certificate
                </p>
                <p className="mt-1.5 text-[13px] leading-6 text-primary-dark">
                  {patient?.fullName ?? "The patient"} is unfit for work from{" "}
                  {new Date(rx.sickNote.fromDate).toLocaleDateString()} to{" "}
                  {new Date(rx.sickNote.toDate).toLocaleDateString()} because of{" "}
                  {rx.sickNote.reason}.
                </p>
              </div>
            ) : null}

            {/* Signature */}
            <div className="mt-6 border-t border-line pt-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="font-serif text-[20px] italic text-ink">
                    {doctor?.fullName.replace(/^Dr\.?\s*/i, "") ?? ""}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-muted">
                    Digitally signed · {new Date(rx.issuedAt).toLocaleString()}
                  </p>
                </div>
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-canvas text-ink-muted">
                  <PillIcon size={22} />
                </span>
              </div>
              <p className="mt-4 text-[10px] leading-4 text-ink-muted">
                This is a digitally generated prescription valid without a physical signature. Verify
                the prescriber&apos;s registration number with the Medical and Dental Council of
                Nigeria (MDCN). Issued
                following a teleconsultation; not valid for controlled substances in some
                jurisdictions.
              </p>
            </div>
          </Card>

          {rx.followUpInDays > 0 ? (
            <Notice tone="ok" icon={<ShieldIcon size={18} />} title="Follow-up requested">
              Your doctor asked to see you again in {rx.followUpInDays} days
              {rx.doctor
                ? ` (around ${new Date(
                    new Date(rx.issuedAt).getTime() + rx.followUpInDays * 86_400_000,
                  ).toLocaleDateString(undefined, { day: "numeric", month: "long" })})`
                : ""}
              .{" "}
              <Link href={`/doctors/${rx.doctorId}`} className="font-semibold underline">
                Book a follow-up with {rx.doctor?.fullName.split(" ").slice(-1)[0]}
              </Link>
              .
            </Notice>
          ) : null}

          <div className="no-print space-y-3 pb-4">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-pill bg-primary text-[14px] font-semibold text-white pressable"
            >
              <PillIcon size={18} />
              Download / print prescription
            </button>
            {rx.booking ? (
              <Link
                href={`/records/${rx.bookingId}`}
                className="flex h-12 w-full items-center justify-center rounded-pill border border-line bg-surface text-[14px] font-semibold text-ink pressable"
              >
                View visit summary
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
