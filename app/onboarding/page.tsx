"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCareNow, useStore } from "@/lib/store";
import { Button, Card, Checkbox, Notice } from "@/components/ui";
import { AlertIcon, LockIcon, ShieldIcon, VideoIcon } from "@/components/Icons";
import { CareNowLogo } from "@/components/Logo";

/**
 * Auth.
 *
 * Production swaps this for Supabase Auth (email OTP / phone OTP). The shape is
 * identical: an identifier goes in, a persisted session comes out — so wiring
 * the real provider is a change inside `signIn`, not a redesign of this screen.
 */
export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingScreen />
    </Suspense>
  );
}

function OnboardingScreen() {
  const store = useStore();
  const { ready, session } = useCareNow();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [mode, setMode] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [healthConsent, setHealthConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already signed in? Skip straight through.
  useEffect(() => {
    if (ready && session) router.replace(next);
  }, [ready, session, next, router]);

  const identifierReady = mode === "email" ? /^\S+@\S+\.\S+$/.test(email) : phone.replace(/\D/g, "").length >= 10;
  const canContinue = identifierReady && acceptedTerms && healthConsent;

  function submit() {
    setError(null);
    if (!identifierReady) {
      setError(mode === "email" ? "Enter a valid email address." : "Enter a 10-digit mobile number.");
      return;
    }
    if (!acceptedTerms || !healthConsent) {
      setError("Please accept the terms and the health-data consent to continue.");
      return;
    }
    setBusy(true);
    try {
      store.signIn({
        email: mode === "email" ? email : undefined,
        phone: mode === "phone" ? phone : undefined,
        name: name || undefined,
      });
      router.replace("/onboarding/consent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col px-gutter pt-[max(28px,var(--safe-t))]">
      <div className="flex flex-1 flex-col">
        <CareNowLogo />

        <div className="mt-8">
          <h1 className="text-screen font-bold text-ink">Care from home, today</h1>
          <p className="mt-2 text-[13px] leading-6 text-ink-muted">
            Sign in to book a video consultation with a licensed doctor. Your records are saved so
            the next doctor already knows your history.
          </p>
        </div>

        {/* -------- Trust strip -------- */}
        <ul className="mt-6 space-y-3">
          <Bullet icon={<ShieldIcon size={18} />} text="Every doctor is manually verified against their medical registration." />
          <Bullet icon={<VideoIcon size={18} />} text="Consultations run in your browser — no app store download." />
          <Bullet icon={<LockIcon size={18} />} text="Your health notes are private to you and the doctor you book." />
        </ul>

        {/* -------- Identity -------- */}
        <Card className="mt-6 p-4">
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-pill bg-canvas p-1">
            {(["email", "phone"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={[
                  "h-9 rounded-pill text-chip font-medium transition-colors",
                  mode === m ? "bg-surface text-ink shadow-card" : "text-ink-muted",
                ].join(" ")}
              >
                {m === "email" ? "Email" : "Mobile"}
              </button>
            ))}
          </div>

          {mode === "email" ? (
            <div>
              <label className="label" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                className="field"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          ) : (
            <div>
              <label className="label" htmlFor="phone">
                Mobile number
              </label>
              <input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                className="field"
                placeholder="+91 98430 00000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          )}

          <div className="mt-4">
            <label className="label" htmlFor="name">
              Full name <span className="font-normal">(optional)</span>
            </label>
            <input
              id="name"
              className="field"
              placeholder="We'll use this on your prescriptions"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="mt-3 border-t border-line pt-1">
            <Checkbox checked={acceptedTerms} onChange={setAcceptedTerms}>
              I agree to the{" "}
              <a href="/legal/terms" className="font-medium text-primary-dark underline">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/legal/privacy" className="font-medium text-primary-dark underline">
                Privacy Policy
              </a>
              .
            </Checkbox>
            <Checkbox checked={healthConsent} onChange={setHealthConsent}>
              I consent to CareNow processing my health information — including my symptoms, the
              doctor&apos;s notes and any prescription — so I can be treated.
            </Checkbox>
          </div>

          {error ? (
            <div className="mb-3">
              <Notice tone="danger" icon={<AlertIcon size={18} />}>
                {error}
              </Notice>
            </div>
          ) : null}

          <Button full onClick={submit} loading={busy} disabled={!canContinue} className="mt-2">
            Continue
          </Button>

          <p className="mt-3 text-center text-[11px] leading-5 text-ink-muted">
            We&apos;ll email you a sign-in code. No password to remember.
          </p>
        </Card>

        {/* -------- Demo shortcut -------- */}
        <Card className="mt-4 p-4">
          <p className="text-[13px] font-semibold text-ink">Just looking around?</p>
          <p className="mt-1 text-sub leading-5 text-ink-muted">
            Use the demo account to see a patient with an upcoming consultation and past records.
          </p>
          <Button
            variant="secondary"
            full
            className="mt-3"
            onClick={() => {
              store.signInDemo();
              router.replace(next);
            }}
          >
            Use demo account
          </Button>
        </Card>

        <div className="mt-4">
          <Notice tone="warn" icon={<AlertIcon size={18} />} title="CareNow is not for emergencies">
            If you have chest pain, difficulty breathing, severe bleeding or a suspected stroke, call
            your local emergency number. CareNow can&apos;t dispatch help.
          </Notice>
        </div>
      </div>

      <footer className="py-6 text-center">
        <a href="/doctor" className="text-[12px] font-medium text-ink-muted underline">
          I&apos;m a doctor — sign in to your clinic dashboard
        </a>
      </footer>
    </div>
  );
}

function Bullet({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary-tint text-primary-dark">
        {icon}
      </span>
      <p className="text-[12px] leading-5 text-ink-muted">{text}</p>
    </li>
  );
}
