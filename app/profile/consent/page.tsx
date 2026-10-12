"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { RequireAuth } from "@/components/AppShell";
import { DetailHeader } from "@/components/AppHeader";
import { Button, Card, Checkbox, Notice, useToast } from "@/components/ui";
import { AlertIcon, LockIcon, ShieldIcon, VideoIcon } from "@/components/Icons";

/**
 * Consent management.
 *
 * Health-data consent is the one permission the app genuinely needs; recording
 * consent is optional and can be withdrawn. Both are versioned, so a change to
 * the terms forces a fresh agreement.
 */
export default function ConsentSettingsPage() {
  return (
    <RequireAuth skeleton="detail">
      <ConsentScreen />
    </RequireAuth>
  );
}

function ConsentScreen() {
  const store = useStore();
  const toast = useToast();
  const session = store.session!;

  const [health, setHealth] = useState(session.consent?.healthDataConsent ?? false);
  const [recording, setRecording] = useState(session.consent?.recordingConsent ?? false);
  const [dirty, setDirty] = useState(false);

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <DetailHeader title="Consent & permissions" subtitle="You stay in control of this" />

      <div className="app-scroll flex-1">
        <div className="space-y-section">
          {session.consent ? (
            <Notice tone="ok" icon={<ShieldIcon size={18} />} title="Currently agreed">
              Version {session.consent.version}, agreed on{" "}
              {new Date(session.consent.acceptedAt).toLocaleDateString(undefined, {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              .
            </Notice>
          ) : (
            <Notice tone="warn" icon={<AlertIcon size={18} />} title="Not yet agreed">
              You need to accept health-data consent before you can book a consultation.
            </Notice>
          )}

          <Card className="divide-y divide-line p-4">
            <div className="pb-1">
              <Checkbox
                checked={health}
                onChange={(v) => {
                  setHealth(v);
                  setDirty(true);
                }}
              >
                <span className="font-medium">Processing my health information</span>
                <span className="mt-1 block text-sub text-ink-muted">
                  Required for treatment. Covers your intake notes, the doctor&apos;s assessment,
                  prescriptions and any document you upload. Withdrawing it means we can no longer
                  treat you — existing records are kept because your history is clinically relevant.
                </span>
              </Checkbox>
            </div>

            <div className="py-1">
              <Checkbox
                checked={recording}
                onChange={(v) => {
                  setRecording(v);
                  setDirty(true);
                }}
              >
                <span className="font-medium">Recording my video consultations</span>
                <span className="mt-1 block text-sub text-ink-muted">
                  Optional. When on, you and the doctor both see a recording banner, and the file is
                  deleted 30 days later. Doctors cannot record without your agreement.
                </span>
              </Checkbox>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="text-[14px] font-semibold text-ink">Your rights</h3>
            <ul className="mt-3 space-y-3">
              <Right
                icon={<LockIcon size={17} />}
                title="Access and portability"
                body="Every record is downloadable from its own screen. For a complete export, email privacy@carenow.health and we'll send a machine-readable copy."
              />
              <Right
                icon={<VideoIcon size={17} />}
                title="Correction"
                body="Fix anything in Profile → Health information yourself. If a doctor's note is wrong, ask us to add a correction rather than deleting it."
              />
              <Right
                icon={<ShieldIcon size={17} />}
                title="Erasure"
                body="Ask us to delete your account and we remove your profiles, bookings and prescriptions. Financial records are kept for the period tax law requires."
              />
            </ul>
          </Card>

          <Notice tone="info" title="Who has access">
            You, the doctor you booked with, and a small CareNow clinical-support team that can see
            booking metadata — never your notes — to resolve disputes and refunds. Every access is
            logged.
          </Notice>
        </div>
      </div>

      <div
        className="sticky bottom-0 border-t border-line bg-canvas/95 px-gutter pt-3 backdrop-blur-md"
        style={{ paddingBottom: "calc(12px + var(--safe-b))" }}
      >
        <Button
          full
          disabled={!health}
          onClick={() => {
            store.acceptConsent({ healthDataConsent: health, recordingConsent: recording });
            setDirty(false);
            toast("Consent updated. A new version is recorded.", "ok");
          }}
        >
          {dirty ? "Save changes" : "Consent up to date"}
        </Button>
      </div>
    </div>
  );
}

function Right({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary-tint text-primary-dark">
        {icon}
      </span>
      <div>
        <p className="text-[13px] font-medium text-ink">{title}</p>
        <p className="mt-0.5 text-sub leading-5 text-ink-muted">{body}</p>
      </div>
    </li>
  );
}
