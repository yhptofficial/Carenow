"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore, useCareNow } from "@/lib/store";
import { ScreenHeader } from "@/components/AppHeader";
import { SearchBar } from "@/components/SearchBar";
import { DoctorCard } from "@/components/DoctorCard";
import { Avatar, Button, Card, Chevron, Notice, SectionTitle } from "@/components/ui";
import {
  AlertIcon,
  CalendarIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  HistoryIcon,
  NoteIcon,
  PillIcon,
  VideoIcon,
} from "@/components/Icons";
import { initialsOf } from "@/lib/db";
import { timeLabel } from "@/lib/schedule";

export default function HomePage() {
  const store = useStore();
  const { session } = useCareNow();
  const router = useRouter();
  const [query, setQuery] = useState("");

  const upcoming = store.upcomingBookings();
  const active = upcoming.find((b) => b.joinable);
  const next = upcoming.filter((b) => !b.joinable);
  const recent = store.pastBookings().slice(0, 1);
  const recentRx = store.myPrescriptions().slice(0, 1);
  const activeRx = recentRx[0];

  const firstName = session?.fullName?.split(" ")[0] ?? "there";
  const initials = session ? initialsOf(session.fullName) : "?";

  // "Because you booked Dr. Iyer" — a one-tap rebook, not a cold recommendation.
  const rebook = useMemo(() => {
    const last = store.pastBookings()[0];
    if (!last) return null;
    return store.getDoctor(last.doctorId);
  }, [store]);

  return (
    <div className="app-scroll pt-[max(20px,var(--safe-t))]">
      <ScreenHeader
        context={`${session?.location ?? "Lagos"} · ${greeting()}`}
        title={`Hi ${firstName}`}
        initials={initials}
        accent={session?.accent ?? "teal"}
      />

      <div className="space-y-section">
        {/* -------- Live consult banner: the one thing that outranks everything -------- */}
        {active ? (
          <Card className="overflow-hidden p-0">
            <div className="flex items-start gap-3 bg-primary px-4 py-4 text-white">
              <span className="relative mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/20">
                <VideoIcon size={20} />
                <span className="absolute inset-0 rounded-full border border-white/50 animate-pulse-ring" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold">Your doctor is online</p>
                <p className="mt-0.5 text-[12px] opacity-90">
                  {active.doctor.fullName} · {timeLabel(active.startsAt)}
                </p>
              </div>
            </div>
            <div className="p-4">
              <Button full onClick={() => router.push(`/consult/${active.id}`)} icon={<VideoIcon size={18} />}>
                Join consultation
              </Button>
              <p className="mt-2.5 text-center text-[11px] text-ink-muted">
                Camera and microphone are only enabled when you tap join.
              </p>
            </div>
          </Card>
        ) : null}

        {/* -------- Search -------- */}
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Specialty, name or symptom"
          onSubmit={() =>
            router.push(query.trim() ? `/find?q=${encodeURIComponent(query.trim())}` : "/find")
          }
        />

        {/* -------- Quick actions -------- */}
        <div className="grid grid-cols-2 gap-3">
          <QuickAction
            href="/find"
            label="Find a doctor"
            hint="Verified clinicians"
            icon={<ChevronRightIcon size={18} />}
          />
          <QuickAction
            href="/bookings"
            label="My bookings"
            hint={next.length ? `${next.length} upcoming` : "Nothing booked"}
            icon={<CalendarIcon size={18} />}
          />
        </div>

        {/* -------- Next appointment -------- */}
        {next[0] ? (
          <section>
            <SectionTitle
              action={
                <Link href="/bookings" className="text-chip font-medium text-primary-dark">
                  See all
                </Link>
              }
            >
              Next appointment
            </SectionTitle>
            <NextAppointmentCard
              bookingId={next[0].id}
              doctorName={next[0].doctor.fullName}
              specialty={
                store.specialties.find((s) => s.id === next[0].doctor.specialty)?.label ?? "Consultation"
              }
              initials={initialsOf(next[0].doctor.fullName)}
              accent={next[0].doctor.accent}
              startsAt={next[0].startsAt}
              countdown={next[0].countdown}
              paid={next[0].payment.status === "paid"}
              reminderChannels={next[0].reminders.channels}
            />
          </section>
        ) : !active ? (
          <section>
            <SectionTitle>Next appointment</SectionTitle>
            <Card className="flex flex-col items-center gap-3 px-6 py-8 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-primary-tint text-primary-dark">
                <VideoIcon size={24} />
              </span>
              <div>
                <p className="text-[15px] font-semibold text-ink">No consultations booked</p>
                <p className="mt-1 text-sub text-ink-muted">
                  Most patients get seen within 30 minutes of opening the app.
                </p>
              </div>
              <Button size="md" onClick={() => router.push("/find")}>
                Find a doctor
              </Button>
            </Card>
          </section>
        ) : null}

        {/* -------- Latest prescription -------- */}
        {activeRx ? (
          <section>
            <SectionTitle
              action={
                <Link href="/profile/records" className="text-chip font-medium text-primary-dark">
                  All records
                </Link>
              }
            >
              Latest prescription
            </SectionTitle>
            <Link
              href={`/prescriptions/${activeRx.id}`}
              className="card flex items-center gap-3 p-card pressable"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary-tint text-primary-dark">
                <PillIcon size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-card font-semibold text-ink">{activeRx.diagnosis}</p>
                <p className="truncate text-sub text-ink-muted">
                  {activeRx.doctor?.fullName ?? "CareNow doctor"} ·{" "}
                  {new Date(activeRx.issuedAt).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                  })}
                </p>
                {activeRx.followUpInDays > 0 ? (
                  <p className="mt-1.5 inline-flex items-center gap-1 rounded-pill bg-primary-tint px-2 py-[3px] text-[11px] font-medium text-primary-dark">
                    <ClockIcon size={12} />
                    Follow-up in {activeRx.followUpInDays} days
                  </p>
                ) : null}
              </div>
              <Chevron />
            </Link>
          </section>
        ) : null}

        {/* -------- Rebook -------- */}
        {rebook ? (
          <section>
            <SectionTitle>Book again</SectionTitle>
            <DoctorCard
              view={store.listDoctors().find((v) => v.doctor.id === rebook.doctor.id) ?? {
                doctor: rebook.doctor,
                next: null,
                initials: initialsOf(rebook.doctor.fullName),
                specialtyLabel: store.specialties.find((s) => s.id === rebook.doctor.specialty)?.label ?? "",
              }}
            />
          </section>
        ) : null}

        {/* -------- Last visit -------- */}
        {recent[0] ? (
          <section>
            <SectionTitle>Last visit</SectionTitle>
            <Link
              href={`/records/${recent[0].id}`}
              className="card flex items-center gap-3 p-card pressable"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-canvas text-ink-muted">
                <HistoryIcon size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-card font-semibold text-ink">
                  {recent[0].intake.reason}
                </p>
                <p className="truncate text-sub text-ink-muted">
                  {recent[0].doctor.fullName} ·{" "}
                  {new Date(recent[0].startsAt).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                  })}
                </p>
              </div>
              <Chevron />
            </Link>
          </section>
        ) : null}

        {/* -------- Reassurance strip -------- */}
        <Notice tone="info" icon={<CheckCircleIcon size={18} />} title="What CareNow can't do">
          We don&apos;t handle emergencies, ambulance calls or in-person procedures. If you have chest
          pain, trouble breathing, or heavy bleeding, call your local emergency number now.
        </Notice>

        {!session?.consent?.healthDataConsent ? (
          <Notice tone="warn" icon={<AlertIcon size={18} />} title="Finish setting up">
            <Link href="/onboarding/consent" className="font-semibold underline">
              Review and accept the health-data consent
            </Link>{" "}
            so doctors can see your intake notes.
          </Notice>
        ) : null}
      </div>
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function QuickAction({
  href,
  label,
  hint,
  icon,
}: {
  href: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href} className="card flex flex-col gap-3 p-card pressable">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-tint text-primary-dark">
        {icon}
      </span>
      <span>
        <span className="block text-[13px] font-semibold text-ink">{label}</span>
        <span className="mt-0.5 block text-[11px] text-ink-muted">{hint}</span>
      </span>
    </Link>
  );
}

function NextAppointmentCard({
  bookingId,
  doctorName,
  specialty,
  initials,
  accent,
  startsAt,
  countdown,
  paid,
  reminderChannels,
}: {
  bookingId: string;
  doctorName: string;
  specialty: string;
  initials: string;
  accent: "teal" | "blue" | "purple";
  startsAt: string;
  countdown: string;
  paid: boolean;
  reminderChannels: string[];
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <Avatar initials={initials} accent={accent} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-card font-semibold text-ink">{doctorName}</p>
          <p className="truncate text-sub text-ink-muted">{specialty}</p>
        </div>
        <span
          className={[
            "shrink-0 rounded-pill px-2.5 py-1 text-[11px] font-semibold",
            paid ? "bg-primary-tint text-primary-dark" : "bg-[#FDF3E3] text-warning",
          ].join(" ")}
        >
          {paid ? "Paid" : "Unpaid"}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-2xl bg-canvas px-3 py-2.5">
        <CalendarIcon size={18} />
        <p className="text-[13px] font-medium text-ink">
          {new Date(startsAt).toLocaleDateString(undefined, {
            weekday: "short",
            day: "numeric",
            month: "short",
          })}{" "}
          · {timeLabel(startsAt)}
        </p>
        <span className="ml-auto text-[11px] font-medium text-ink-muted">{countdown}</span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Link
          href={`/bookings?focus=${bookingId}`}
          className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-pill border border-line bg-surface px-4 text-[13px] font-semibold text-ink pressable hover:border-primary hover:text-primary-dark"
        >
          <NoteIcon size={16} />
          View details
        </Link>
        <Link
          href={`/records/${bookingId}`}
          className="inline-flex h-10 items-center justify-center rounded-pill px-4 text-[13px] font-semibold text-primary-dark pressable hover:bg-primary-tint"
        >
          Prep notes
        </Link>
      </div>

      {reminderChannels.length ? (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-muted">
          <ClockIcon size={13} />
          Reminder 30 minutes before, by {reminderChannels.join(" and ")}.
        </p>
      ) : null}
    </Card>
  );
}
