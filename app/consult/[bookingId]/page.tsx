"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CareNowError, useCareNow, useStore } from "@/lib/store";
import { Avatar, Button, Card, Notice, Sheet, useToast } from "@/components/ui";
import {
  AlertIcon,
  CheckCircleIcon,
  ClockIcon,
  MicIcon,
  MicOffIcon,
  NoteIcon,
  PillIcon,
  ShieldIcon,
  VideoIcon,
  VideoOffIcon,
} from "@/components/Icons";
import { initialsOf } from "@/lib/db";
import { formatMoney } from "@/lib/currency";
import { minutesUntil, timeLabel } from "@/lib/schedule";

/**
 * Consultation room.
 *
 * The tile is a stand-in for the third-party video SDK (Daily.co in the PRD's
 * stack). Everything around it — the join gate, the device checks, the call
 * timer, the "doctor is late" escalation and the automatic refund for a no-show
 * — is real app behaviour, so dropping the SDK in means replacing `<VideoTile>`.
 */
export default function ConsultPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const router = useRouter();
  const store = useStore();
  const { ready, session } = useCareNow();
  const toast = useToast();

  const booking = store.getBooking(bookingId);

  const [joined, setJoined] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [waitedMins, setWaitedMins] = useState(0);
  const [waiting, setWaiting] = useState(true);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [showPrep, setShowPrep] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const joinedAt = useRef<number | null>(null);
  const waitingSince = useRef<number | null>(null);

  const prescription = booking ? store.prescriptionForBooking(booking.id) : null;
  const patientFirstName = (booking ? store.patientFor(booking.patientId)?.fullName : session?.fullName)
    ?.split(" ")[0] ?? "there";

  /** Ask for camera and microphone, the way the real SDK would on join. */
  const join = useCallback(async () => {
    setDeviceError(null);
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      }
    } catch {
      // A blocked camera is not fatal — the patient can still join and talk.
      setDeviceError(
        "We couldn't reach your camera or microphone. Check your browser permissions, or join and type in the chat instead.",
      );
      setCamOn(false);
      setMicOn(false);
    }

    try {
      store.startConsult(bookingId);
      joinedAt.current = Date.now();
      waitingSince.current = Date.now();
      setJoined(true);
      setWaiting(true);
    } catch (e) {
      toast((e as CareNowError).message, "warn");
      router.replace(`/bookings`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId, router, toast]);

  /* -------- Call timer -------- */
  useEffect(() => {
    if (!joined) return;
    const id = window.setInterval(() => {
      if (joinedAt.current) setElapsed(Math.floor((Date.now() - joinedAt.current) / 1000));
      if (waitingSince.current) {
        setWaitedMins(Math.floor((Date.now() - waitingSince.current) / 60_000));
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [joined]);

  /* -------- The clinician answers after a short wait -------- */
  useEffect(() => {
    if (!joined) return;
    const t = window.setTimeout(() => {
      setWaiting(false);
      if (waitingSince.current) {
        setWaitedMins(Math.floor((Date.now() - waitingSince.current) / 60_000));
      }
      toast("Your doctor has joined.", "ok");
    }, 9000);
    return () => window.clearTimeout(t);
  }, [joined, toast]);

  /* -------- Warn before a refresh drops the call -------- */
  useEffect(() => {
    if (!joined) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [joined]);

  const canJoin = useMemo(() => {
    if (!booking) return false;
    if (booking.payment.status !== "paid") return false;
    return booking.joinable || booking.status === "in_progress";
  }, [booking]);

  if (!ready) {
    return <div className="min-h-[100dvh] bg-[#0E2622]" />;
  }

  if (!booking) {
    return (
      <div className="min-h-[100dvh] bg-[#0E2622] px-gutter pt-24 text-center text-white">
        <p className="text-[16px] font-semibold">This consultation link has expired</p>
        <p className="mt-2 text-[13px] text-white/70">
          Check your bookings for a current link, or contact support.
        </p>
        <Button className="mt-5" onClick={() => router.push("/bookings")}>
          Back to bookings
        </Button>
      </div>
    );
  }

  const { doctor } = booking;
  const minsAway = minutesUntil(booking.startsAt);
  const unpaid = booking.payment.status !== "paid";

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#0E2622] text-white">
      {/* -------- Top bar -------- */}
      <header className="flex items-start justify-between gap-3 px-gutter pt-[max(16px,var(--safe-t))] pb-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] text-white/60">
            <ShieldIcon size={13} />
            End-to-end encrypted · {booking.reference}
          </p>
          <h1 className="mt-1 truncate text-[17px] font-bold">{doctor.fullName}</h1>
          <p className="truncate text-[12px] text-white/60">{doctor.qualifications}</p>
        </div>
        {joined ? (
          <span className="shrink-0 rounded-pill bg-white/10 px-3 py-1.5 font-mono text-[12px] tabular-nums">
            {formatClock(elapsed)}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setShowPrep(true)}
            className="shrink-0 rounded-pill bg-white/10 px-3 py-2 text-[12px] font-medium pressable"
          >
            Your notes
          </button>
        )}
      </header>

      {/* -------- Stage -------- */}
      <div className="flex-1 px-gutter">
        <div className="relative h-full min-h-[320px] overflow-hidden rounded-[24px] bg-[#123029] shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
          {/* Remote tile — the doctor */}
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <div className="relative mx-auto w-fit">
                <Avatar
                  initials={initialsOf(doctor.fullName)}
                  accent={doctor.accent}
                  size={96}
                  className="text-[30px] ring-4 ring-white/10"
                />
                {waiting && joined ? (
                  <span className="absolute inset-0 rounded-full border-2 border-white/40 animate-pulse-ring" />
                ) : null}
              </div>
              <p className="mt-4 text-[15px] font-semibold">{doctor.fullName}</p>
              <p className="mt-1 flex items-center justify-center gap-1.5 text-[12px] text-white/60">
                {!joined ? (
                  <>
                    <VideoIcon size={14} />
                    Waiting for you to join
                  </>
                ) : waiting ? (
                  <>
                    <ClockIcon size={14} />
                    Doctor is joining…
                  </>
                ) : camOn ? (
                  <>
                    <VideoIcon size={14} />
                    Connected · {doctor.languages[0]}
                  </>
                ) : (
                  <>
                    <VideoOffIcon size={14} />
                    Camera off
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Self view — picture-in-picture */}
          {joined ? (
            <div className="absolute bottom-4 right-4 h-24 w-[74px] overflow-hidden rounded-2xl border border-white/15 bg-[#0A1D19] shadow-lg">
              <div className="grid h-full place-items-center">
                {camOn ? (
                  <Avatar
                    initials={initialsOf(session?.fullName ?? "You")}
                    accent={session?.accent ?? "teal"}
                    size={34}
                  />
                ) : (
                  <span className="text-white/50">
                    <VideoOffIcon size={20} />
                  </span>
                )}
              </div>
              <span className="absolute bottom-1 left-1.5 text-[9px] text-white/70">You</span>
              {!micOn ? (
                <span className="absolute right-1.5 top-1.5 rounded-full bg-danger p-1 text-white">
                  <MicOffIcon size={10} />
                </span>
              ) : null}
            </div>
          ) : null}

          {/* Live caption strip */}
          {joined && !waiting ? (
            <div className="absolute inset-x-4 bottom-4 mr-[86px] rounded-2xl bg-black/45 px-3 py-2 backdrop-blur-sm">
              <p className="text-[11px] leading-4 text-white/85">
                {`“${patientFirstName}, thanks for your patience. Tell me what's been going on.”`}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {/* -------- Controls -------- */}
      <div className="px-gutter pt-4" style={{ paddingBottom: "calc(16px + var(--safe-b))" }}>
        {deviceError ? (
          <div className="mb-3">
            <Notice tone="warn" icon={<AlertIcon size={18} />}>
              {deviceError}
            </Notice>
          </div>
        ) : null}

        {!joined ? (
          <div className="space-y-3">
            {unpaid ? (
              <>
                <Notice tone="warn" icon={<AlertIcon size={18} />} title="Payment needed">
                  This consultation is unpaid. Pay to unlock the room — your slot is still held.
                </Notice>
                <Button full onClick={() => router.push(`/checkout/${booking.id}`)}>
                  Pay {formatMoney(booking.payment.amount, booking.payment.currency)}
                </Button>
              </>
            ) : !canJoin ? (
              <>
                <Notice tone="info" icon={<ClockIcon size={18} />} title="The room isn't open yet">
                  {minsAway > 0
                    ? `Join opens 10 minutes before your ${timeLabel(booking.startsAt)} slot — about ${minsAway} minutes from now.`
                    : "This consultation has already ended."}
                </Notice>
                <Button full variant="secondary" onClick={() => router.push("/bookings")}>
                  Back to bookings
                </Button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center gap-2 text-[12px] text-white/70">
                  <CheckCircleIcon size={15} />
                  Slot confirmed for {timeLabel(booking.startsAt)}
                </div>
                <Button full onClick={join} icon={<VideoIcon size={18} />}>
                  Join consultation
                </Button>
                <p className="text-center text-[11px] leading-5 text-white/50">
                  We&apos;ll ask for your camera and microphone. Nothing is recorded unless you allowed
                  it in your consent settings.
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Waiting-room escalation for the no-show path. */}
            {waiting && waitedMins >= 5 ? (
              <div className="mb-3">
                <Notice tone="warn" icon={<AlertIcon size={18} />} title={`Waiting ${waitedMins} minutes`}>
                  Your doctor hasn&apos;t joined yet. If nobody arrives within 10 minutes you can
                  leave and claim a full refund from your booking.
                </Notice>
              </div>
            ) : null}

            <div className="flex items-center justify-center gap-3">
              <RoundButton
                label={micOn ? "Mute microphone" : "Unmute microphone"}
                active={!micOn}
                onClick={() => setMicOn((v) => !v)}
              >
                {micOn ? <MicIcon size={22} /> : <MicOffIcon size={22} />}
              </RoundButton>

              <RoundButton
                label={camOn ? "Turn camera off" : "Turn camera on"}
                active={!camOn}
                onClick={() => setCamOn((v) => !v)}
              >
                {camOn ? <VideoIcon size={22} /> : <VideoOffIcon size={22} />}
              </RoundButton>

              <RoundButton label="Your intake notes" onClick={() => setShowPrep(true)}>
                <NoteIcon size={22} />
              </RoundButton>

              <RoundButton label="Prescription" onClick={() => setChatOpen(true)} badge={Boolean(prescription)}>
                <PillIcon size={22} />
              </RoundButton>
            </div>

            <button
              type="button"
              onClick={() => setShowEnd(true)}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-pill bg-danger text-[14px] font-semibold text-white pressable"
            >
              Leave consultation
            </button>
          </>
        )}
      </div>

      {/* -------- Prep notes sheet -------- */}
      <Sheet open={showPrep} onClose={() => setShowPrep(false)} title="What you told your doctor">
        <div className="space-y-4">
          <Card className="p-4">
            <p className="text-[13px] font-semibold text-ink">{booking.intake.reason}</p>
            {booking.intake.notes ? (
              <p className="mt-2 text-[13px] leading-6 text-ink-muted">{booking.intake.notes}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-pill bg-canvas px-2.5 py-1 text-[11px] text-ink-muted">
                {booking.intake.duration}
              </span>
              <span className="rounded-pill bg-canvas px-2.5 py-1 text-[11px] text-ink-muted">
                Severity {booking.intake.severity}/5
              </span>
            </div>
          </Card>

          {session && booking.intake.attachProfileHistory ? (
            <Card className="p-4">
              <p className="text-[13px] font-semibold text-ink">Health history you shared</p>
              <dl className="mt-3 space-y-3 text-[13px]">
                <div>
                  <dt className="text-[11px] text-ink-muted">Allergies</dt>
                  <dd className="mt-0.5 text-ink">
                    {session.allergies.length ? session.allergies.join(", ") : "None recorded"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-ink-muted">Conditions</dt>
                  <dd className="mt-0.5 text-ink">
                    {session.conditions.length ? session.conditions.join(", ") : "None recorded"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-ink-muted">Current medication</dt>
                  <dd className="mt-0.5 text-ink">
                    {session.currentMedications.length
                      ? session.currentMedications.join(", ")
                      : "None recorded"}
                  </dd>
                </div>
              </dl>
            </Card>
          ) : null}

          <Notice tone="info" icon={<ShieldIcon size={18} />}>
            Your doctor can see this and your profile — nothing else from your record.
          </Notice>
        </div>
      </Sheet>

      {/* -------- Prescription sheet -------- */}
      <Sheet
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        title={prescription ? "Prescription issued" : "Prescription"}
        footer={
          prescription ? (
            <Button full onClick={() => router.push(`/prescriptions/${prescription.id}`)}>
              Open full prescription
            </Button>
          ) : (
            <Button full variant="secondary" onClick={() => setChatOpen(false)}>
              Close
            </Button>
          )
        }
      >
        {prescription ? (
          <div className="space-y-3">
            <Notice tone="ok" icon={<CheckCircleIcon size={18} />} title="Ready to download">
              Your prescription is signed and saved to your records.
            </Notice>
            <Card className="p-4">
              <p className="text-[13px] font-semibold text-ink">{prescription.diagnosis}</p>
              <ul className="mt-3 space-y-2">
                {prescription.medications.map((m) => (
                  <li key={m.name} className="text-[13px]">
                    <p className="font-medium text-ink">{m.name}</p>
                    <p className="text-sub text-ink-muted">
                      {m.dosage} · {m.frequency} · {m.duration}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[13px] leading-6 text-ink-muted">
              Your doctor writes the prescription during the call. It appears here the moment
              it&apos;s signed, and stays in your records permanently.
            </p>
            <Card className="p-4">
              <p className="text-[12px] text-ink-muted">
                Nothing yet. Ask your doctor to send it if you can&apos;t see it after the call.
              </p>
            </Card>
          </div>
        )}
      </Sheet>

      {/* -------- End call sheet -------- */}
      <Sheet
        open={showEnd}
        onClose={() => setShowEnd(false)}
        title="Leave the consultation?"
        footer={
          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="secondary" onClick={() => setShowEnd(false)}>
              Stay
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                store.endConsult(booking.id);
                router.replace(`/records/${booking.id}`);
              }}
            >
              Leave call
            </Button>
          </div>
        }
      >
        <p className="text-[13px] leading-6 text-ink-muted">
          Leaving ends the video for you. Your doctor can still finish their notes and send a
          prescription afterwards — it will show up in your records.
        </p>
        {waitedMins >= 5 && waiting ? (
          <Notice tone="warn" icon={<AlertIcon size={18} />} title="Doctor hasn't joined">
            If you leave now because nobody joined within 10 minutes, your booking is marked as a
            no-show by the doctor and you&apos;re refunded in full. Open the booking to claim it.
          </Notice>
        ) : null}
      </Sheet>
    </div>
  );
}

function RoundButton({
  children,
  label,
  onClick,
  active = false,
  badge = false,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  badge?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={[
        "relative grid h-14 w-14 place-items-center rounded-full pressable",
        active ? "bg-white text-[#0E2622]" : "bg-white/10 text-white hover:bg-white/15",
      ].join(" ")}
    >
      {children}
      {badge ? (
        <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-[#0E2622]" />
      ) : null}
    </button>
  );
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
