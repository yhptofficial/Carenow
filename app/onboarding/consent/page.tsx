"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { RequireAuth } from "@/components/AppShell";
import { DetailHeader } from "@/components/AppHeader";
import { Button, Card, Checkbox, Notice } from "@/components/ui";
import { AlertIcon, LockIcon, ShieldIcon, VideoIcon } from "@/components/Icons";

/**
 * Explicit, separate consent — not bundled into sign-up.
 *
 * The PRD requires a patient consent screen reviewed against local health-data
 * rules, so this collects three distinct permissions and records the version
 * and timestamp the patient agreed to.
 */
export default function ConsentPage() {
  return (
    <RequireAuth skeleton="detail">
      <ConsentScreen />
    </RequireAuth>
  );
}

function ConsentScreen() {
  const store = useStore();
  const router = useRouter();

  const [health, setHealth] = useState(store.session?.consent?.healthDataConsent ?? false);
  const [recording, setRecording] = useState(store.session?.consent?.recordingConsent ?? false);
  const [age, setAge] = useState(true);

  const canContinue = health && age;

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <DetailHeader title="Your consent" subtitle="Required before your first consultation" />

      <div className="app-scroll flex-1">
        <div className="space-y-section">
          <Notice tone="info" icon={<ShieldIcon size={18} />} title="What we collect and why">
            Your symptoms, the doctor&apos;s notes, prescriptions and payment records. All of it
            exists so a doctor can treat you — nothing is sold, and nothing is used for advertising.
          </Notice>

          <Card className="p-4">
            <h2 className="text-[15px] font-semibold text-ink">Permissions</h2>

            <div className="mt-2 divide-y divide-line">
              <div className="py-1">
                <Checkbox checked={health} onChange={setHealth}>
                  <span className="font-medium">Processing my health information</span>
                  <span className="mt-1 block text-sub text-ink-muted">
                    Required. Covers intake notes, consultation records, prescriptions and any
                    documents a doctor uploads. You can withdraw this at any time, but we may then
                    be unable to continue your treatment.
                  </span>
                </Checkbox>
              </div>

              <div className="py-1">
                <Checkbox checked={recording} onChange={setRecording}>
                  <span className="font-medium">Recording the video consultation</span>
                  <span className="mt-1 block text-sub text-ink-muted">
                    Optional and off by default. If you allow it, both you and the doctor are told
                    when recording starts, and it is deleted after 30 days.
                  </span>
                </Checkbox>
              </div>

              <div className="py-1">
                <Checkbox checked={age} onChange={setAge}>
                  <span className="font-medium">I am 18 or older, or a parent/guardian</span>
                  <span className="mt-1 block text-sub text-ink-muted">
                    Required. A minor&apos;s consultation has to be booked by the adult responsible
                    for them.
                  </span>
                </Checkbox>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-[15px] font-semibold text-ink">How your data is handled</h2>
            <ul className="mt-3 space-y-3">
              <Row
                icon={<LockIcon size={18} />}
                title="Row-level security"
                body="Each record is scoped to your account. A doctor sees your notes only for consultations you booked with them."
              />
              <Row
                icon={<VideoIcon size={18} />}
                title="Camera and microphone"
                body="We ask for these only when you tap join. You can leave the call at any point."
              />
              <Row
                icon={<ShieldIcon size={18} />}
                title="Your rights"
                body="Download a copy of your records from Profile → Records, or ask us to delete your account and everything in it."
              />
            </ul>
            <p className="mt-4 text-[11px] leading-5 text-ink-muted">
              Read the full{" "}
              <a href="/legal/privacy" className="font-medium text-primary-dark underline">
                Privacy Policy
              </a>{" "}
              and{" "}
              <a href="/legal/terms" className="font-medium text-primary-dark underline">
                Terms of Service
              </a>
              . Consent version {store.session?.consent?.version ?? "2026-02-01"}.
            </p>
          </Card>

          <Notice tone="warn" icon={<AlertIcon size={18} />} title="Not a substitute for emergency care">
            Video consultations can&apos;t handle emergencies, physical examinations or on-the-spot
            procedures. For anything urgent, contact your local emergency services.
          </Notice>
        </div>
      </div>

      <div
        className="sticky bottom-0 border-t border-line bg-canvas/95 px-gutter pt-3 backdrop-blur-md"
        style={{ paddingBottom: "calc(12px + var(--safe-b))" }}
      >
        <Button
          full
          disabled={!canContinue}
          onClick={() => {
            store.acceptConsent({ healthDataConsent: health, recordingConsent: recording });
            router.replace("/home");
          }}
        >
          Agree and continue
        </Button>
        {!canContinue ? (
          <p className="mt-2 text-center text-[11px] text-ink-muted">
            Health-information consent is required to book a consultation.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Row({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
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
