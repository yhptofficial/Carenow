"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCareNow, useStore } from "@/lib/store";
import { DetailHeader } from "@/components/AppHeader";
import { SlotPicker } from "@/components/SlotPicker";
import {
  Avatar,
  Button,
  Card,
  Checkbox,
  Chip,
  Notice,
  Sheet,
  useToast,
} from "@/components/ui";
import { Brief } from "@/components/ClinicalBrief";
import {
  AlertIcon,
  CheckCircleIcon,
  CloseIcon,
  MicIcon,
  MicOffIcon,
  NoteIcon,
  PillIcon,
  PlusIcon,
  VideoIcon,
  VideoOffIcon,
} from "@/components/Icons";
import { initialsOf } from "@/lib/db";
import { minutesUntil, timeLabel } from "@/lib/schedule";
import type { Medication } from "@/lib/types";

type Tab = "brief" | "notes" | "prescribe";

const FOLLOW_UP_OPTIONS = [
  { days: 0, label: "No follow-up" },
  { days: 3, label: "3 days" },
  { days: 7, label: "1 week" },
  { days: 14, label: "2 weeks" },
  { days: 30, label: "1 month" },
];

/**
 * Clinician consultation screen.
 *
 * Three panes on one screen: read the brief, take notes during the call, then
 * prescribe. The prescription writer is the most safety-critical surface in the
 * app, so it validates that a medicine has a name, dose, frequency and duration
 * before it will let the doctor sign.
 */
export default function DoctorConsultPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const router = useRouter();
  const store = useStore();
  const { ready, doctorSession } = useCareNow();
  const toast = useToast();

  const booking = store.getBooking(bookingId);
  const existing = store.prescriptionForBooking(bookingId);

  const [tab, setTab] = useState<Tab>("brief");
  const [inCall, setInCall] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [showNext, setShowNext] = useState(false);

  // Prescription draft
  const [diagnosis, setDiagnosis] = useState(existing?.diagnosis ?? "");
  const [medications, setMedications] = useState<Medication[]>(existing?.medications ?? []);
  const [advice, setAdvice] = useState(existing?.advice ?? "");
  const [followUp, setFollowUp] = useState(existing?.followUpInDays ?? 0);
  const [privateNotes, setPrivateNotes] = useState(existing?.doctorNotes ?? "");
  const [wantsSickNote, setWantsSickNote] = useState(Boolean(existing?.sickNote));
  const [sickFrom, setSickFrom] = useState(existing?.sickNote?.fromDate ?? todayISO());
  const [sickTo, setSickTo] = useState(existing?.sickNote?.toDate ?? addDays(todayISO(), 2));

  useEffect(() => {
    if (ready && !doctorSession) router.replace("/doctor");
  }, [ready, doctorSession, router]);

  useEffect(() => {
    if (!inCall) return;
    const started = Date.now();
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [inCall]);

  const addMedication = useCallback(() => {
    setMedications((m) => [
      ...m,
      { name: "", dosage: "", frequency: "", duration: "", notes: "" },
    ]);
  }, []);

  if (!ready || !doctorSession) return <div className="min-h-[100dvh]" />;

  if (!booking) {
    return (
      <div className="min-h-[100dvh]">
        <DetailHeader title="Consultation" backHref="/doctor/dashboard" />
        <div className="px-gutter">
          <Notice tone="danger" icon={<AlertIcon size={18} />} title="Booking not found">
            This consultation isn&apos;t on your roster.
          </Notice>
        </div>
      </div>
    );
  }

  // RLS equivalent on the client: a doctor may only open their own consultations.
  if (booking.doctorId !== doctorSession.id) {
    return (
      <div className="min-h-[100dvh]">
        <DetailHeader title="Not your consultation" backHref="/doctor/dashboard" />
        <div className="px-gutter">
          <Notice tone="danger" icon={<AlertIcon size={18} />} title="Access denied">
            This booking belongs to another clinician. CareNow blocks cross-doctor access at the
            database level, not just in this screen.
          </Notice>
        </div>
      </div>
    );
  }

  const patient = store.patientFor(booking.patientId);
  const minutes = minutesUntil(booking.startsAt);
  const draftComplete =
    diagnosis.trim().length >= 3 &&
    medications.length > 0 &&
    medications.every(
      (m) => m.name.trim() && m.dosage.trim() && m.frequency.trim() && m.duration.trim(),
    ) &&
    advice.trim().length >= 10;

  function start() {
    const unpaid = booking!.payment.status !== "paid";
    if (unpaid) return;
    store.startConsult(booking!.id);
    setInCall(true);
    setTab("brief");
    toast("Room open. The patient has been notified.", "ok");
  }

  function sign() {
    if (!draftComplete) return;
    store.issuePrescription({
      bookingId: booking!.id,
      diagnosis: diagnosis.trim(),
      medications: medications.map((m) => ({
        ...m,
        name: m.name.trim(),
        dosage: m.dosage.trim(),
        frequency: m.frequency.trim(),
        duration: m.duration.trim(),
        notes: m.notes?.trim() || undefined,
      })),
      advice: advice.trim(),
      followUpInDays: followUp,
      sickNote: wantsSickNote
        ? { fromDate: sickFrom, toDate: sickTo, reason: diagnosis.trim() }
        : undefined,
      doctorNotes: privateNotes.trim() || undefined,
    });
    toast("Prescription signed and sent to the patient.", "ok");
    router.push("/doctor/dashboard");
  }

  return (
    <div className="flex min-h-[100dvh] flex-col">
      {inCall ? (
        <CallBar
          name={patient?.fullName ?? "Patient"}
          initials={initialsOf(patient?.fullName ?? "Patient")}
          accent={patient?.accent ?? "blue"}
          elapsed={elapsed}
          micOn={micOn}
          camOn={camOn}
          onMic={() => setMicOn((v) => !v)}
          onCam={() => setCamOn((v) => !v)}
          onNotes={() => setTab("notes")}
          onEnd={() => {
            store.endConsult(booking.id);
            setInCall(false);
            setTab("prescribe");
            toast("Call ended. Write up your notes and issue the prescription.", "info");
          }}
        />
      ) : (
        <DetailHeader
          title={patient?.fullName ?? "Patient"}
          subtitle={`${timeLabel(booking.startsAt)} · ${booking.reference}`}
          backHref="/doctor/dashboard"
        />
      )}

      {/* -------- Tabs -------- */}
      <div className="px-gutter pb-3">
        <div className="chip-row">
          <Chip label="Brief" active={tab === "brief"} onClick={() => setTab("brief")} />
          <Chip label={`Notes${privateNotes ? " •" : ""}`} active={tab === "notes"} onClick={() => setTab("notes")} />
          <Chip
            label={existing ? "Prescription ✓" : "Prescribe"}
            active={tab === "prescribe"}
            onClick={() => setTab("prescribe")}
          />
        </div>
      </div>

      <div className="app-scroll flex-1 !pt-0">
        {tab === "brief" ? <Brief booking={booking} /> : null}

        {tab === "notes" ? (
          <div className="space-y-section">
            <Notice tone="info" icon={<NoteIcon size={18} />} title="Private clinical notes">
              Only you see these. The patient reads the diagnosis, medicines and advice on the
              prescription — nothing from this box.
            </Notice>

            <Card className="p-4">
              <label className="label" htmlFor="private">
                Examination &amp; reasoning
              </label>
              <textarea
                id="private"
                rows={10}
                className="field resize-none leading-6"
                placeholder={
                  "History, observations from the call, differential, why you chose this plan…"
                }
                value={privateNotes}
                onChange={(e) => setPrivateNotes(e.target.value)}
                maxLength={4000}
              />
              <p className="mt-1.5 text-right text-[11px] text-ink-muted">
                {privateNotes.length}/4000
              </p>
            </Card>

            <Card className="p-4">
              <p className="text-[13px] font-semibold text-ink">Quick inserts</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  "Patient reports symptoms improving since onset.",
                  "No red flags reported: no breathlessness, no chest pain, no fever.",
                  "Advised to return if symptoms worsen or persist beyond 5 days.",
                  "Reviewed current medication and allergies before prescribing.",
                ].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setPrivateNotes((n) => (n ? `${n}\n\n${s}` : s))}
                    className="rounded-pill border border-line px-3 py-1.5 text-left text-[12px] text-ink-muted pressable hover:border-primary hover:text-primary-dark"
                  >
                    + {s.length > 46 ? `${s.slice(0, 46)}…` : s}
                  </button>
                ))}
              </div>
            </Card>
          </div>
        ) : null}

        {tab === "prescribe" ? (
          <div className="space-y-section">
            {existing ? (
              <Notice tone="ok" icon={<CheckCircleIcon size={18} />} title="Prescription already issued">
                Sent {new Date(existing.issuedAt).toLocaleString()}. The patient can download it from
                their records.
              </Notice>
            ) : null}

            <Card className="p-4">
              <label className="label" htmlFor="diagnosis">
                Diagnosis
              </label>
              <input
                id="diagnosis"
                className="field"
                placeholder="e.g. Acute pharyngitis, likely viral"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                maxLength={120}
              />
              <p className="mt-1.5 text-[11px] text-ink-muted">
                Shown to the patient on the prescription and their visit summary.
              </p>
            </Card>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[15px] font-semibold text-ink">
                  Medicines
                  {medications.length ? (
                    <span className="ml-2 text-sub font-normal text-ink-muted">
                      {medications.length}
                    </span>
                  ) : null}
                </h3>
                <Button size="sm" variant="secondary" icon={<PlusIcon size={15} />} onClick={addMedication}>
                  Add
                </Button>
              </div>

              {medications.length === 0 ? (
                <Card className="px-4 py-6 text-center">
                  <p className="text-[13px] text-ink-muted">
                    No medicines yet. Add one, or leave this empty and only send advice.
                  </p>
                </Card>
              ) : (
                <ul className="space-y-3">
                  {medications.map((m, i) => (
                    <li key={i}>
                      <Card className="p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="grid h-6 w-6 place-items-center rounded-full bg-primary-tint text-[11px] font-semibold text-primary-dark">
                            {i + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => setMedications((list) => list.filter((_, j) => j !== i))}
                            className="rounded-full p-1.5 text-ink-muted pressable hover:bg-canvas"
                            aria-label={`Remove medicine ${i + 1}`}
                          >
                            <CloseIcon size={16} />
                          </button>
                        </div>

                        <div className="space-y-3">
                          <input
                            className="field"
                            placeholder="Drug name and strength — e.g. Amoxicillin 500mg"
                            value={m.name}
                            onChange={(e) => update(setMedications, i, { name: e.target.value })}
                          />
                          <div className="grid grid-cols-2 gap-3">
                            <input
                              className="field"
                              placeholder="Dose — 1 capsule"
                              value={m.dosage}
                              onChange={(e) => update(setMedications, i, { dosage: e.target.value })}
                            />
                            <input
                              className="field"
                              placeholder="Frequency — twice daily"
                              value={m.frequency}
                              onChange={(e) => update(setMedications, i, { frequency: e.target.value })}
                            />
                          </div>
                          <input
                            className="field"
                            placeholder="Duration — 5 days"
                            value={m.duration}
                            onChange={(e) => update(setMedications, i, { duration: e.target.value })}
                          />
                          <input
                            className="field"
                            placeholder="Instructions (optional) — take after food"
                            value={m.notes ?? ""}
                            onChange={(e) => update(setMedications, i, { notes: e.target.value })}
                          />
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>
              )}

              {medications.length > 0 && !draftComplete && medications.some((m) => !m.name || !m.dosage || !m.frequency || !m.duration) ? (
                <div className="mt-3">
                  <Notice tone="warn" icon={<AlertIcon size={18} />}>
                    Every medicine needs a name, dose, frequency and duration before it can be signed.
                    A prescription that a pharmacist can&apos;t fill is a patient safety issue.
                  </Notice>
                </div>
              ) : null}
            </section>

            <Card className="p-4">
              <label className="label" htmlFor="advice">
                Advice for the patient
              </label>
              <textarea
                id="advice"
                rows={5}
                className="field resize-none leading-6"
                placeholder="Self-care, warning signs that mean come back, when to seek in-person care…"
                value={advice}
                onChange={(e) => setAdvice(e.target.value)}
                maxLength={1200}
              />
              <p className="mt-1.5 text-right text-[11px] text-ink-muted">{advice.length}/1200</p>
            </Card>

            <Card className="p-4">
              <span className="label">Follow-up</span>
              <div className="flex flex-wrap gap-2">
                {FOLLOW_UP_OPTIONS.map((o) => (
                  <Chip
                    key={o.days}
                    label={o.label}
                    active={followUp === o.days}
                    onClick={() => setFollowUp(o.days)}
                  />
                ))}
              </div>
              {followUp > 0 ? (
                <p className="mt-3 text-[11px] text-ink-muted">
                  The patient sees a follow-up prompt on their record and can rebook with one tap.
                </p>
              ) : null}
            </Card>

            <Card className="p-4">
              <Checkbox checked={wantsSickNote} onChange={setWantsSickNote}>
                <span className="font-medium">Include a fitness-for-work note</span>
                <span className="mt-1 block text-sub text-ink-muted">
                  Only add this if the patient asked for it. It states you assessed them today.
                </span>
              </Checkbox>

              {wantsSickNote ? (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="label" htmlFor="sick-from">
                      From
                    </label>
                    <input
                      id="sick-from"
                      type="date"
                      className="field"
                      value={sickFrom}
                      onChange={(e) => setSickFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="sick-to">
                      To
                    </label>
                    <input
                      id="sick-to"
                      type="date"
                      className="field"
                      value={sickTo}
                      min={sickFrom}
                      onChange={(e) => setSickTo(e.target.value)}
                    />
                  </div>
                </div>
              ) : null}
            </Card>

            <Notice tone="info" icon={<PillIcon size={18} />} title="Before you sign">
              The prescription carries your registration number and is filed permanently. You can&apos;t
              edit it afterwards — you&apos;d issue a corrected one, which the patient sees as a
              revision.
            </Notice>
          </div>
        ) : null}
      </div>

      {/* -------- Sticky action bar -------- */}
      <div
        className="sticky bottom-0 space-y-2.5 border-t border-line bg-canvas/95 px-gutter pt-3 backdrop-blur-md"
        style={{ paddingBottom: "calc(12px + var(--safe-b))" }}
      >
        {tab === "prescribe" ? (
          <>
            <Button full disabled={!draftComplete || Boolean(existing)} onClick={sign} icon={<PillIcon size={18} />}>
              {existing ? "Already issued" : "Sign and send prescription"}
            </Button>
            {!draftComplete && !existing ? (
              <p className="text-center text-[11px] text-ink-muted">
                Needs a diagnosis, at least one complete medicine, and advice.
              </p>
            ) : null}
          </>
        ) : !inCall ? (
          <>
            <Button
              full
              disabled={booking.payment.status !== "paid"}
              onClick={start}
              icon={<VideoIcon size={18} />}
            >
              {booking.payment.status === "paid" ? "Start consultation" : "Waiting for payment"}
            </Button>
            <Button variant="secondary" full onClick={() => setShowNext(true)}>
              Reschedule patient
            </Button>
            {booking.payment.status === "paid" ? (
              <p className="text-center text-[11px] text-ink-muted">
                {minutes > 0
                  ? `Starts in ${minutes} minutes. ` 
                  : ""}
                The patient is emailed the moment you open the room.
              </p>
            ) : null}
          </>
        ) : (
          // Mid-call: the call controls live in the top bar, so the bottom bar
          // offers the two things a clinician actually needs next — write
          // something down, or end the call and write it up.
          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="secondary" onClick={() => setTab("notes")} icon={<NoteIcon size={17} />}>
              Notepad
            </Button>
            <Button
              variant="danger"
              icon={<CloseIcon size={17} />}
              onClick={() => {
                store.endConsult(booking.id);
                setInCall(false);
                setTab("prescribe");
                toast("Call ended. Write up your notes and issue the prescription.", "info");
              }}
            >
              End &amp; write up
            </Button>
          </div>
        )}
      </div>

      {/* -------- Reschedule on the patient's behalf -------- */}
      <RescheduleForPatient
        open={showNext}
        onClose={() => setShowNext(false)}
        bookingId={booking.id}
        doctorId={booking.doctorId}
        onDone={(slotId) => {
          try {
            store.rescheduleBooking(booking.id, slotId);
            toast(`Moved to ${timeLabel(slotId)}. Reminder updated.`, "ok");
          } catch (e) {
            toast(e instanceof Error ? e.message : "Couldn't reschedule.", "warn");
          }
          setShowNext(false);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function CallBar({
  name,
  initials,
  accent,
  elapsed,
  micOn,
  camOn,
  onMic,
  onCam,
  onNotes,
  onEnd,
}: {
  name: string;
  initials: string;
  accent: "teal" | "blue" | "purple";
  elapsed: number;
  micOn: boolean;
  camOn: boolean;
  onMic: () => void;
  onCam: () => void;
  onNotes: () => void;
  onEnd: () => void;
}) {
  return (
    <div className="sticky top-0 z-30 bg-[#0E2622] px-gutter pb-3 pt-[max(14px,var(--safe-t))] text-white">
      <div className="flex items-center gap-3">
        <Avatar initials={initials} accent={accent} size={40} className="ring-2 ring-white/15" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold">{name}</p>
          <p className="flex items-center gap-1.5 text-[11px] text-white/60">
            <span className="h-1.5 w-1.5 rounded-full bg-[#4ADE80]" />
            Connected · {formatClock(elapsed)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <IconToggle label={micOn ? "Mute" : "Unmute"} active={!micOn} onClick={onMic}>
            {micOn ? <MicIcon size={18} /> : <MicOffIcon size={18} />}
          </IconToggle>
          <IconToggle label={camOn ? "Camera off" : "Camera on"} active={!camOn} onClick={onCam}>
            {camOn ? <VideoIcon size={18} /> : <VideoOffIcon size={18} />}
          </IconToggle>
          <IconToggle label="Notes" onClick={onNotes}>
            <NoteIcon size={18} />
          </IconToggle>
          <button
            type="button"
            onClick={onEnd}
            className="grid h-9 w-9 place-items-center rounded-full bg-danger text-white pressable"
            aria-label="End consultation"
          >
            <CloseIcon size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

function IconToggle({
  children,
  label,
  onClick,
  active = false,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={[
        "grid h-9 w-9 place-items-center rounded-full pressable",
        active ? "bg-white text-[#0E2622]" : "bg-white/10 text-white hover:bg-white/15",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function RescheduleForPatient({
  open,
  onClose,
  doctorId,
  bookingId,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  doctorId: string;
  bookingId: string;
  onDone: (slotId: string) => void;
}) {
  const store = useStore();
  const days = store.slotsFor(doctorId, 14, bookingId);
  const [slotId, setSlotId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSlotId(days.flatMap((d) => d.slots).find((s) => s.status === "open")?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Move this patient"
      footer={
        <Button full disabled={!slotId} onClick={() => slotId && onDone(slotId)}>
          Confirm new time
        </Button>
      }
    >
      <div className="space-y-4">
        <Notice tone="info" icon={<CheckCircleIcon size={18} />}>
          Rescheduling is free for the patient and keeps their payment. They&apos;re told by email and
          SMS immediately.
        </Notice>
        <SlotPicker days={days} selectedSlotId={slotId} onSelect={setSlotId} daysToShow={7} />
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */

function update(
  setter: React.Dispatch<React.SetStateAction<Medication[]>>,
  index: number,
  patch: Partial<Medication>,
) {
  setter((list) => list.map((m, i) => (i === index ? { ...m, ...patch } : m)));
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
