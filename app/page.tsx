import { redirect } from "next/navigation";

/**
 * App entry point.
 *
 * CareNow always starts with the onboarding flow (sign in / sign up, then
 * consent). Signed-in patients pass straight through it — the onboarding
 * screen sees the persisted session and forwards them to `/home` — but no
 * one lands on the home screen without going through that door first.
 */
export default function AppEntryPage() {
  redirect("/onboarding");
}
