"use client";

import { useEffect, useRef, useState } from "react";
import { CloseIcon, SearchIcon } from "./Icons";

/**
 * Full pill search bar: white, 1px light border, no shadow.
 *
 * The placeholder is multi-intent — it names several kinds of input so the
 * patient knows symptoms are searchable, not just doctor names.
 */
export function SearchBar({
  value,
  onChange,
  placeholder = "Specialty, name or symptom",
  autoFocus = false,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onSubmit?: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
        ref.current?.blur();
      }}
      className={[
        "flex h-12 items-center gap-2.5 rounded-pill border bg-surface px-4",
        focused ? "border-primary ring-4 ring-primary-tint" : "border-line",
      ].join(" ")}
    >
      <span className="text-ink-muted" aria-hidden="true">
        <SearchIcon size={20} />
      </span>
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        aria-label="Search doctors by specialty, name or symptom"
        enterKeyHint="search"
        autoComplete="off"
        className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-muted [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            onChange("");
            ref.current?.focus();
          }}
          aria-label="Clear search"
          className="-mr-1 rounded-full p-1.5 text-ink-muted pressable hover:bg-canvas"
        >
          <CloseIcon size={16} />
        </button>
      ) : null}
    </form>
  );
}
