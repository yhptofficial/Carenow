"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { StarIcon, ChevronRightIcon, CloseIcon, CheckIcon } from "./Icons";
import type { AvatarAccent } from "@/lib/types";

/* ------------------------------------------------------------------ *
 * Avatar
 * ------------------------------------------------------------------ */

const AVATAR_FILL: Record<AvatarAccent, string> = {
  // Soft gradients keep the initials legible while staying on-palette.
  teal: "bg-[linear-gradient(135deg,#3FC1AE_0%,#1FA390_100%)]",
  blue: "bg-[linear-gradient(135deg,#5FB8E8_0%,#2D9CDB_100%)]",
  purple: "bg-[linear-gradient(135deg,#A98BF0_0%,#8B5CF6_100%)]",
};

export function Avatar({
  initials,
  accent = "teal",
  size = 44,
  className = "",
}: {
  initials: string;
  accent?: AvatarAccent;
  /** 44px for doctors, 32px for the user. */
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full text-white font-semibold ${AVATAR_FILL[accent]} ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        letterSpacing: "0.01em",
      }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Rating badge — small teal-tint pill with a filled star
 * ------------------------------------------------------------------ */

export function RatingBadge({
  rating,
  count,
  className = "",
}: {
  rating: number;
  count?: number;
  className?: string;
}) {
  if (!rating) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-pill bg-canvas px-2 py-[3px] text-[11px] font-medium text-ink-muted ${className}`}>
        New on CareNow
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill bg-primary-tint px-2 py-[3px] text-meta font-medium text-primary-dark ${className}`}
    >
      <StarIcon size={12} />
      {rating.toFixed(1)}
      {count !== undefined ? <span className="font-normal opacity-70">({count})</span> : null}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Chip
 * ------------------------------------------------------------------ */

export function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        // Full pill, ~32px tall
        "h-8 shrink-0 rounded-pill px-4 text-chip font-medium pressable",
        "border transition-colors duration-150",
        active
          ? "bg-primary-tint text-primary-dark border-primary-tint"
          : "bg-surface text-ink-muted border-line",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Buttons
 * ------------------------------------------------------------------ */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "lg" | "md" | "sm";
  loading?: boolean;
  full?: boolean;
  icon?: ReactNode;
};

export function Button({
  variant = "primary",
  size = "lg",
  loading = false,
  full = false,
  icon,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const sizes = {
    lg: "h-12 px-5 text-[14px]",
    md: "h-10 px-4 text-[13px]",
    sm: "h-8 px-3 text-chip",
  }[size];

  const variants = {
    primary:
      "bg-primary text-white shadow-[0_6px_18px_rgba(31,163,144,0.28)] hover:bg-primary-dark disabled:bg-primary/40 disabled:shadow-none",
    secondary:
      "bg-surface text-ink border border-line hover:border-primary hover:text-primary-dark disabled:text-ink-muted/60",
    ghost: "bg-transparent text-primary-dark hover:bg-primary-tint disabled:text-ink-muted/60",
    danger: "bg-danger/10 text-danger hover:bg-danger/15 disabled:opacity-50",
  }[variant];

  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-pill font-semibold pressable",
        "disabled:cursor-not-allowed disabled:active:scale-100",
        sizes,
        variants,
        full ? "w-full" : "",
        className,
      ].join(" ")}
    >
      {loading ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Card — white, 20px radius, soft diffused shadow, no border
 * ------------------------------------------------------------------ */

export function Card({
  children,
  className = "",
  as: As = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "li";
}) {
  return <As className={`card ${className}`}>{children}</As>;
}

/** Card that behaves like a link: whole card is the tap target, chevron on the right. */
export function TapCard({
  children,
  onClick,
  href,
  className = "",
  ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const cls = `card pressable block w-full text-left ${className}`;
  if (href) {
    return (
      <a href={href} className={cls} aria-label={ariaLabel}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls} aria-label={ariaLabel}>
      {children}
    </button>
  );
}

/** Grey chevron shown at the trailing edge of every tappable card. */
export function Chevron({ size = 18 }: { size?: number }) {
  return (
    <span className="text-ink-muted/70" aria-hidden="true">
      <ChevronRightIcon size={size} />
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Section header
 * ------------------------------------------------------------------ */

export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-[15px] font-semibold text-ink">{children}</h2>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Bottom sheet
 * ------------------------------------------------------------------ */

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  maxHeight = "88vh",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxHeight?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Lock the page behind the sheet so the background doesn't scroll.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(15,40,36,0.32)] backdrop-blur-[2px] animate-[fade-up_0.2s_ease-out]"
      />
      <div
        ref={ref}
        tabIndex={-1}
        className="relative w-full max-w-[440px] rounded-t-[24px] bg-surface shadow-sheet animate-sheet-up flex flex-col outline-none"
        style={{ maxHeight }}
      >
        <div className="flex items-start justify-between gap-4 px-gutter pt-4 pb-3">
          <div className="min-w-0">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" aria-hidden="true" />
            {title ? <h2 className="text-[17px] font-bold text-ink">{title}</h2> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 mt-3 rounded-full p-2 text-ink-muted pressable hover:bg-canvas"
          >
            <CloseIcon size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-gutter pb-4">{children}</div>
        {footer ? (
          <div
            className="border-t border-line px-gutter pt-3"
            style={{ paddingBottom: "calc(12px + var(--safe-b))" }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Toast
 * ------------------------------------------------------------------ */

type Toast = { id: number; message: string; tone: "ok" | "warn" | "info" };

const ToastCtx = createContext<(message: string, tone?: Toast["tone"]) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const push = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = ++counter.current;
    setToasts((t) => [...t.slice(-2), { id, message, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-gutter"
        style={{ bottom: "calc(var(--nav-h) + var(--nav-inset) + var(--safe-b) + 16px)" }}
        aria-live="polite"
        role="status"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={[
              "pointer-events-auto w-full max-w-[380px] rounded-2xl px-4 py-3 text-[13px] font-medium shadow-nav animate-fade-up",
              t.tone === "ok"
                ? "bg-primary-dark text-white"
                : t.tone === "warn"
                  ? "bg-warning text-white"
                  : "bg-ink text-white",
            ].join(" ")}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

/* ------------------------------------------------------------------ *
 * Toggle switch
 * ------------------------------------------------------------------ */

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-[14px] font-medium text-ink">
          {label}
        </label>
        {description ? (
          <p className="mt-1 text-sub text-ink-muted">{description}</p>
        ) : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-pill transition-colors duration-200",
          checked ? "bg-primary" : "bg-line",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200",
            checked ? "translate-x-[22px]" : "translate-x-0.5",
          ].join(" ")}
        />
        <span className="sr-only">{checked ? "On" : "Off"}</span>
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Checkbox
 * ------------------------------------------------------------------ */

export function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-2">
      <span
        className={[
          "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-[7px] border-[1.5px] transition-colors",
          checked ? "border-primary bg-primary text-white" : "border-line bg-surface",
        ].join(" ")}
      >
        {checked ? <CheckIcon size={14} /> : null}
      </span>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-[13px] leading-5 text-ink">{children}</span>
    </label>
  );
}

/* ------------------------------------------------------------------ *
 * Empty state
 * ------------------------------------------------------------------ */

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
      {icon ? (
        <span className="grid h-12 w-12 place-items-center rounded-full bg-primary-tint text-primary-dark">
          {icon}
        </span>
      ) : null}
      <div>
        <p className="text-[15px] font-semibold text-ink">{title}</p>
        {body ? <p className="mt-1 text-sub text-ink-muted">{body}</p> : null}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Inline notice
 * ------------------------------------------------------------------ */

export function Notice({
  tone = "info",
  title,
  children,
  icon,
}: {
  tone?: "info" | "warn" | "danger" | "ok";
  title?: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  const tones = {
    info: "bg-primary-tint text-primary-dark",
    ok: "bg-primary-tint text-primary-dark",
    warn: "bg-[#FDF3E3] text-warning",
    danger: "bg-[#FBEDED] text-danger",
  }[tone];

  return (
    <div className={`flex gap-3 rounded-2xl px-4 py-3 ${tones}`}>
      {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
      <div className="min-w-0 text-[13px] leading-5">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={title ? "mt-0.5 opacity-90" : ""}>{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Skeletons
 * ------------------------------------------------------------------ */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-line/60 ${className}`} />;
}

export function DoctorCardSkeleton() {
  return (
    <div className="card p-card">
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    </div>
  );
}
