"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { RequireAuth } from "@/components/AppShell";
import { DetailHeader } from "@/components/AppHeader";
import { Button, Card, Notice, useToast } from "@/components/ui";
import { CheckIcon, CloseIcon, PlusIcon, ShieldIcon } from "@/components/Icons";

/**
 * Health information.
 *
 * Deliberately blank-safe: nothing here is required to book, but every field
 * that a doctor reads before a call is captured so the patient isn't asked the
 * same questions verbally.
 */
export default function HealthPage() {
  return (
    <RequireAuth skeleton="detail">
      <HealthScreen />
    </RequireAuth>
  );
}

const COMMON_ALLERGIES = ["Penicillin", "Sulfa drugs", "Aspirin", "Latex", "Peanuts"];
const COMMON_CONDITIONS = [
  "Asthma",
  "Diabetes (Type 2)",
  "Hypertension",
  "Thyroid disorder",
  "PCOS",
  "Migraine",
];

function HealthScreen() {
  const store = useStore();
  const router = useRouter();
  const toast = useToast();
  const session = store.session!;

  const [dob, setDob] = useState(session.dateOfBirth ?? "");
  const [gender, setGender] = useState(session.gender ?? "undisclosed");
  const [allergies, setAllergies] = useState<string[]>(session.allergies);
  const [conditions, setConditions] = useState<string[]>(session.conditions);
  const [medications, setMedications] = useState<string[]>(session.currentMedications);
  const [location, setLocation] = useState(session.location);
  const [saved, setSaved] = useState(false);

  const age = ageFromDOB(dob);

  function save() {
    store.updateProfile({
      dateOfBirth: dob || undefined,
      age,
      gender: gender as typeof session.gender,
      allergies,
      conditions,
      currentMedications: medications,
      location: location.trim() || "Coimbatore",
    });
    setSaved(true);
    toast("Health information updated.", "ok");
    window.setTimeout(() => router.back(), 600);
  }

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <DetailHeader title="Health information" subtitle="Seen only by doctors you book" />

      <div className="app-scroll flex-1">
        <div className="space-y-section">
          <Notice tone="info" icon={<ShieldIcon size={18} />} title="Why doctors need this">
            Allergies and current medication change which drugs are safe to prescribe. Filling this in
            saves five minutes of questions on every call.
          </Notice>

          <Card className="space-y-4 p-4">
            <div>
              <label className="label" htmlFor="dob">
                Date of birth
              </label>
              <input
                id="dob"
                type="date"
                className="field"
                value={dob}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDob(e.target.value)}
              />
              {age ? <p className="mt-1.5 text-[11px] text-ink-muted">{age} years old</p> : null}
            </div>

            <div>
              <span className="label">Gender</span>
              <div className="grid grid-cols-2 gap-2">
                {(["female", "male", "other", "undisclosed"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={[
                      "h-11 rounded-2xl border text-[13px] font-medium capitalize pressable",
                      gender === g
                        ? "border-primary bg-primary-tint text-primary-dark"
                        : "border-line bg-surface text-ink",
                    ].join(" ")}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label" htmlFor="location">
                City
              </label>
              <input
                id="location"
                className="field"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Coimbatore"
              />
              <p className="mt-1.5 text-[11px] text-ink-muted">
                Used for the timezone on your appointment times and to suggest local specialists.
              </p>
            </div>
          </Card>

          <TagList
            title="Allergies"
            hint="Anything that has caused a reaction. Include drug names."
            values={allergies}
            onChange={setAllergies}
            suggestions={COMMON_ALLERGIES}
            placeholder="e.g. Penicillin"
            tone="danger"
          />

          <TagList
            title="Long-term conditions"
            hint="Diagnosed conditions a doctor should know about."
            values={conditions}
            onChange={setConditions}
            suggestions={COMMON_CONDITIONS}
            placeholder="e.g. Asthma"
          />

          <TagList
            title="Current medication"
            hint="Include the dose if you know it."
            values={medications}
            onChange={setMedications}
            suggestions={[]}
            placeholder="e.g. Metformin 500mg"
          />

          <Notice tone="warn" title="Keep it accurate">
            This information is not verified by CareNow. Tell your doctor about anything new, even if
            you haven&apos;t updated it here.
          </Notice>
        </div>
      </div>

      <div
        className="sticky bottom-0 border-t border-line bg-canvas/95 px-gutter pt-3 backdrop-blur-md"
        style={{ paddingBottom: "calc(12px + var(--safe-b))" }}
      >
        <Button full onClick={save} icon={saved ? <CheckIcon size={18} /> : undefined}>
          {saved ? "Saved" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

function TagList({
  title,
  hint,
  values,
  onChange,
  suggestions,
  placeholder,
  tone,
}: {
  title: string;
  hint: string;
  values: string[];
  onChange: (v: string[]) => void;
  suggestions: string[];
  placeholder: string;
  tone?: "danger";
}) {
  const [draft, setDraft] = useState("");

  function add(value: string) {
    const v = value.trim();
    if (!v || values.includes(v)) return;
    onChange([...values, v]);
    setDraft("");
  }

  return (
    <Card className="p-4">
      <h3 className="text-[14px] font-semibold text-ink">{title}</h3>
      <p className="mt-0.5 text-sub text-ink-muted">{hint}</p>

      {values.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {values.map((v) => (
            <li key={v}>
              <span
                className={[
                  "inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-[12px] font-medium",
                  tone === "danger" ? "bg-[#FBEDED] text-danger" : "bg-primary-tint text-primary-dark",
                ].join(" ")}
              >
                {v}
                <button
                  type="button"
                  onClick={() => onChange(values.filter((x) => x !== v))}
                  aria-label={`Remove ${v}`}
                  className="opacity-70 pressable hover:opacity-100"
                >
                  <CloseIcon size={13} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[12px] text-ink-muted/80">Nothing recorded yet</p>
      )}

      <div className="mt-3 flex gap-2">
        <input
          className="field flex-1"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            }
          }}
        />
        <Button size="lg" variant="secondary" onClick={() => add(draft)} icon={<PlusIcon size={17} />}>
          Add
        </Button>
      </div>

      {suggestions.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions
            .filter((s) => !values.includes(s))
            .map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => add(s)}
                className="rounded-pill border border-line px-3 py-1.5 text-[12px] text-ink-muted pressable hover:border-primary hover:text-primary-dark"
              >
                + {s}
              </button>
            ))}
        </div>
      ) : null}
    </Card>
  );
}

function ageFromDOB(dob: string): number | undefined {
  if (!dob) return undefined;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return undefined;
  const diff = Date.now() - d.getTime();
  const years = Math.floor(diff / (365.25 * 86_400_000));
  return years >= 0 && years < 130 ? years : undefined;
}
