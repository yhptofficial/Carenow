"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useStore, useCareNow } from "@/lib/store";
import { ScreenHeader } from "@/components/AppHeader";
import { SearchBar } from "@/components/SearchBar";
import { DoctorCard } from "@/components/DoctorCard";
import { Chip, EmptyState, Notice } from "@/components/ui";
import { initialsOf } from "@/lib/db";
import { AlertIcon, FindIcon, SparkIcon } from "@/components/Icons";
import type { SpecialtyId } from "@/lib/types";

type Filter = SpecialtyId | "all";

export default function FindPage() {
  return (
    <Suspense fallback={<FindFallback />}>
      <FindScreen />
    </Suspense>
  );
}

function FindFallback() {
  return (
    <div className="app-scroll pt-[max(20px,var(--safe-t))]">
      <ScreenHeader context="Finding doctors near you" title="Find a doctor" />
    </div>
  );
}

function FindScreen() {
  const store = useStore();
  const { session } = useCareNow();
  const params = useSearchParams();

  const [query, setQuery] = useState(params.get("q") ?? "");
  const [filter, setFilter] = useState<Filter>((params.get("specialty") as Filter) ?? "all");

  // Keep the URL in step so a search result can be shared or reloaded.
  useEffect(() => {
    const q = params.get("q") ?? "";
    if (q && q !== query) setQuery(q);
    const s = (params.get("specialty") as Filter) ?? "all";
    setFilter((prev) => (prev === "all" ? s : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const results = useMemo(
    () => store.listDoctors({ specialty: filter, query }),
    [store, filter, query],
  );

  const chipRow = [
    { id: "all" as Filter, label: "All" },
    ...store.specialties.map((s) => ({ id: s.id as Filter, label: s.label })),
  ];

  const searching = query.trim().length > 0;

  return (
    <div className="app-scroll pt-[max(20px,var(--safe-t))]">
      <ScreenHeader
        context={`${session?.location ?? "Lagos"} · ${store.listDoctors().length} doctors online`}
        title="Find a doctor"
        initials={session ? initialsOf(session.fullName) : undefined}
        accent={session?.accent ?? "teal"}
      />

      <div className="space-y-4">
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Specialty, name or symptom"
        />

        {/* Horizontal chip row — active chips use the teal tint, not an underline. */}
        <div className="chip-row" role="group" aria-label="Filter by specialty">
          {chipRow.map((c) => (
            <Chip
              key={c.id}
              label={c.label}
              active={filter === c.id}
              onClick={() => setFilter(c.id)}
            />
          ))}
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold text-ink">
            {searching ? "Search results" : filter === "all" ? "Available soonest" : `${labelFor(filter)} doctors`}
          </h2>
          <span className="text-sub text-ink-muted">
            {results.length} {results.length === 1 ? "doctor" : "doctors"}
          </span>
        </div>

        {results.length === 0 ? (
          <EmptyState
            icon={<FindIcon size={24} />}
            title="No doctors matched that"
            body={
              searching
                ? `We couldn't find anyone for “${query}”. Try a specialty like Skin or Child, or clear the search.`
                : "There are no verified doctors in this specialty yet. Try another filter."
            }
          />
        ) : (
          <ul className="space-y-3">
            {results.map((view) => (
              <li key={view.doctor.id}>
                <DoctorCard view={view} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5 space-y-3">
        <Notice tone="info" icon={<SparkIcon size={18} />} title="Why you can trust this list">
          Every doctor on CareNow is manually checked against their medical council registration
          before they appear here. Unverified applications stay hidden.
        </Notice>
        <Notice tone="warn" icon={<AlertIcon size={18} />} title="Not for emergencies">
          For chest pain, breathing difficulty, fainting or heavy bleeding, call your local emergency
          number rather than booking a video consultation.
        </Notice>
      </div>
    </div>
  );
}

function labelFor(filter: Filter): string {
  if (filter === "all") return "All";
  return filter.replace("-", " ");
}
