"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { RequireAuth } from "@/components/AppShell";
import { DetailHeader } from "@/components/AppHeader";
import { Button, Card, Notice, Toggle, useToast } from "@/components/ui";
import { BellIcon, CheckIcon, ClockIcon } from "@/components/Icons";
import type { ReminderChannel } from "@/lib/types";

/** Reminder preferences — email, SMS and push, all opt-in individually. */
export default function NotificationsPage() {
  return (
    <RequireAuth skeleton="detail">
      <NotificationsScreen />
    </RequireAuth>
  );
}

const CHANNELS: { id: ReminderChannel; label: string; description: string }[] = [
  {
    id: "email",
    label: "Email",
    description: "A reminder with the join link, sent to the address on your account.",
  },
  {
    id: "sms",
    label: "Text message",
    description: "Best when you're away from your inbox. Standard rates apply.",
  },
  {
    id: "push",
    label: "Push notification",
    description: "Only works after you add CareNow to your home screen.",
  },
];

function NotificationsScreen() {
  const store = useStore();
  const toast = useToast();
  const session = store.session!;
  const [channels, setChannels] = useState<ReminderChannel[]>(session.reminderChannels);

  function toggle(id: ReminderChannel, on: boolean) {
    setChannels((prev) => (on ? [...new Set([...prev, id])] : prev.filter((c) => c !== id)));
  }

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <DetailHeader title="Reminders" subtitle="How we nudge you before a call" />

      <div className="app-scroll flex-1">
        <div className="space-y-section">
          <Notice tone="info" icon={<ClockIcon size={18} />} title="Thirty minutes before">
            Every booked consultation queues a reminder 30 minutes before it starts. Missed
            consultations aren&apos;t refunded, so this is the one notification we never turn off
            entirely.
          </Notice>

          <Card className="divide-y divide-line p-4">
            {CHANNELS.map((c) => (
              <Toggle
                key={c.id}
                checked={channels.includes(c.id)}
                onChange={(v) => toggle(c.id, v)}
                label={c.label}
                description={c.description}
              />
            ))}
          </Card>

          <Card className="p-4">
            <h3 className="text-[14px] font-semibold text-ink">What else we send</h3>
            <ul className="mt-3 space-y-2.5">
              <Perk text="Booking confirmation with your reference and join link" />
              <Perk text="Receipt when a payment is captured or refunded" />
              <Perk text="A nudge if a prescription is waiting in your records" />
              <Perk text="Nothing promotional — no offers, no partner messages" />
            </ul>
          </Card>

          {channels.length === 0 ? (
            <Notice tone="warn" icon={<BellIcon size={18} />} title="No reminders selected">
              With every channel off you may miss a consultation. Pick at least one.
            </Notice>
          ) : null}
        </div>
      </div>

      <div
        className="sticky bottom-0 border-t border-line bg-canvas/95 px-gutter pt-3 backdrop-blur-md"
        style={{ paddingBottom: "calc(12px + var(--safe-b))" }}
      >
        <Button
          full
          icon={<CheckIcon size={18} />}
          onClick={() => {
            store.updateProfile({ reminderChannels: channels });
            toast(
              channels.length
                ? `Reminders set to ${channels.join(", ")}.`
                : "Reminders disabled. We'll still email your booking confirmation.",
              "ok",
            );
          }}
        >
          Save preferences
        </Button>
      </div>
    </div>
  );
}

function Perk({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary-tint text-primary-dark">
        <CheckIcon size={11} />
      </span>
      <span className="text-[13px] leading-5 text-ink-muted">{text}</span>
    </li>
  );
}
