"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCareNow, useStore } from "@/lib/store";
import { Button, Card, Checkbox, Notice } from "@/components/ui";
import { AlertIcon, EyeIcon, EyeOffIcon, LockIcon, ShieldIcon, VideoIcon } from "@/components/Icons";
import { CareNowLogo } from "@/components/Logo";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { fetchSupabaseProfile, signInWithEmail, signUpWithEmail } from "@/lib/supabase/auth";

/**
 * Auth.
 *
 * Two explicit doors — sign in and sign up — rather than one form that
 * quietly does whichever applies: sign-in never creates an account, and
 * sign-up never reuses (or silently takes over) an existing one.
 *
 * Production swaps this for Supabase Auth (email/phone + password). The shape
 * is identical: credentials go in, a persisted session comes out — so wiring
 * the real provider is a change inside `signIn`/`signUp`, not of this screen.
 */
export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingScreen />
    </Suspense>
  );
}

type AuthMode = "signIn" | "signUp";

function OnboardingScreen() {
  const store = useStore();
  const { ready, session } = useCareNow();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/home";

  const [authMode, setAuthMode] = useState<AuthMode>(params.get("mode") === "signup" ? "signUp" : "signIn");
  const [mode, setMode] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [healthConsent, setHealthConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSignUp = authMode === "signUp";
  // With a Supabase project configured, auth is email + password there;
  // mobile sign-in stays local-only until an SMS provider exists.
  const supabaseMode = isSupabaseConfigured;

  // Already signed in? Skip straight through to the home screen.
  useEffect(() => {
    if (ready && session) router.replace(next);
  }, [ready, session, next, router]);

  function switchAuthMode(nextMode: AuthMode) {
    setAuthMode(nextMode);
    setError(null);
    setNotice(null);
    setConfirmPassword("");
    setShowPassword(false);
  }

  const identifierReady = mode === "email" ? /^\S+@\S+\.\S+$/.test(email) : phone.replace(/\D/g, "").length >= 10;
  const passwordReady = password.length >= 8;
  const confirmReady = !isSignUp || confirmPassword === password;
  const nameReady = !isSignUp || name.trim().length >= 2;
  const consentReady = !isSignUp || (acceptedTerms && healthConsent);
  const canContinue = identifierReady && passwordReady && confirmReady && nameReady && consentReady;

  async function submit() {
    setError(null);
    if (!identifierReady) {
      setError(mode === "email" ? "Enter a valid email address." : "Enter a 10-digit mobile number.");
      return;
    }
    if (!passwordReady) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    if (isSignUp && confirmPassword !== password) {
      setError("Those passwords don't match. Enter the same password twice.");
      return;
    }
    if (isSignUp && !nameReady) {
      setError("Enter your full name — it goes on your prescriptions.");
      return;
    }
    if (isSignUp && !consentReady) {
      setError("Please accept the terms and the health-data consent to continue.");
      return;
    }
    setBusy(true);
    try {
      if (supabaseMode) {
        const outcome = isSignUp
          ? await signUpWithEmail({ email, password, fullName: name.trim() })
          : await signInWithEmail({ email, password });
        if (outcome.status === "confirm-email") {
          // Confirmation is on in the Supabase project: no session yet.
          setNotice(
            "Account created — now confirm your email. We sent a link to " +
              `${email.trim().toLowerCase()}; open it, then come back and sign in.`,
          );
          setBusy(false);
          return;
        }
        const profile = await fetchSupabaseProfile(outcome.user);
        store.syncExternalSession(profile);
        router.replace(
          isSignUp || !profile.consent?.healthDataConsent ? "/onboarding/consent" : next,
        );
        return;
      }
      const input = {
        email: mode === "email" ? email : undefined,
        phone: mode === "phone" ? phone : undefined,
        password,
      };
      if (isSignUp) {
        store.signUp({ ...input, name: name.trim() });
        // New patients still owe the detailed consent step before booking.
        router.replace("/onboarding/consent");
      } else {
        const profile = store.signIn(input);
        router.replace(profile.consent?.healthDataConsent ? next : "/onboarding/consent");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  }

  // Until the persisted session has loaded, render nothing — a signed-in
  // patient would otherwise see the sign-in form flash before being forwarded.
  if (!ready) return null;

  return (
    <div className="flex min-h-[100dvh] flex-col px-gutter pt-[max(28px,var(--safe-t))]">
      <div className="flex flex-1 flex-col">
        <CareNowLogo />

        <div className="mt-8">
          <h1 className="text-screen font-bold text-ink">
            {isSignUp ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-2 text-[13px] leading-6 text-ink-muted">
            {isSignUp
              ? "Sign up to book a video consultation with a licensed doctor. Your records are saved so the next doctor already knows your history."
              : "Sign in to book a video consultation, join your appointment, and see your records."}
          </p>
        </div>

        {/* -------- Trust strip -------- */}
        <ul className="mt-6 space-y-3">
          <Bullet icon={<ShieldIcon size={18} />} text="Every doctor is manually verified against their medical registration." />
          <Bullet icon={<VideoIcon size={18} />} text="Consultations run in your browser — no app store download." />
          <Bullet icon={<LockIcon size={18} />} text="Your health notes are private to you and the doctor you book." />
        </ul>

        {/* -------- Auth -------- */}
        <Card className="mt-6 p-4">
          {/* Sign in / sign up switch */}
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-pill bg-canvas p-1" role="tablist" aria-label="Sign in or sign up">
            {(
              [
                { id: "signIn", label: "Sign in" },
                { id: "signUp", label: "Sign up" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={authMode === t.id}
                onClick={() => switchAuthMode(t.id)}
                className={[
                  "h-9 rounded-pill text-chip font-medium transition-colors",
                  authMode === t.id ? "bg-surface text-ink shadow-card" : "text-ink-muted",
                ].join(" ")}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Email / mobile switch (email only while auth is on Supabase) */}
          {supabaseMode ? (
            <p className="mb-4 text-[11px] leading-5 text-ink-muted">
              Mobile sign-in is coming soon — use your email for now.
            </p>
          ) : null}
          <div className={supabaseMode ? "hidden" : "mb-4 grid grid-cols-2 gap-1 rounded-pill bg-canvas p-1"}>
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

          {isSignUp ? (
            <div className="mb-4">
              <label className="label" htmlFor="name">
                Full name
              </label>
              <input
                id="name"
                className="field"
                autoComplete="name"
                placeholder="We'll use this on your prescriptions"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          ) : null}

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
            <label className="label" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete={isSignUp ? "new-password" : "current-password"}
                className="field pr-11"
                placeholder={isSignUp ? "At least 8 characters" : "Your password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={password.length > 0 && !passwordReady}
                aria-describedby="password-hint"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 grid w-11 place-items-center text-ink-muted"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
              </button>
            </div>
            <p id="password-hint" className="mt-1.5 text-[11px] leading-5 text-ink-muted">
              {password.length > 0 && !passwordReady
                ? `${8 - password.length} more character${8 - password.length === 1 ? "" : "s"} to go.`
                : isSignUp
                  ? "At least 8 characters. You'll use this to sign in next time."
                  : "The password you set when you created your account."}
            </p>
          </div>

          {isSignUp ? (
            <>
              <div className="mt-4">
                <label className="label" htmlFor="confirm-password">
                  Confirm password
                </label>
                <input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  className="field"
                  placeholder="Enter the same password again"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  aria-invalid={confirmPassword.length > 0 && !confirmReady}
                />
                {confirmPassword.length > 0 && !confirmReady ? (
                  <p className="mt-1.5 text-[11px] leading-5 text-ink-muted">
                    Those passwords don&apos;t match yet.
                  </p>
                ) : null}
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
            </>
          ) : null}

          {notice ? (
            <div className="mb-3 mt-3">
              <Notice tone="ok" icon={<LockIcon size={18} />}>
                {notice}
              </Notice>
            </div>
          ) : null}

          {error ? (
            <div className="mb-3 mt-3">
              <Notice tone="danger" icon={<AlertIcon size={18} />}>
                {error}
              </Notice>
            </div>
          ) : null}

          <Button full onClick={submit} loading={busy} disabled={!canContinue} className="mt-2">
            {isSignUp ? "Create account" : "Sign in"}
          </Button>

          <p className="mt-3 text-center text-[11px] leading-5 text-ink-muted">
            {isSignUp ? (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchAuthMode("signIn")}
                  className="font-medium text-primary-dark underline"
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                New to CareNow?{" "}
                <button
                  type="button"
                  onClick={() => switchAuthMode("signUp")}
                  className="font-medium text-primary-dark underline"
                >
                  Create an account
                </button>
              </>
            )}
          </p>

          <p className="mt-2 text-center text-[11px] leading-5 text-ink-muted">
            Your password is never stored in plain text.
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
