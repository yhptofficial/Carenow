"use client";

import { DetailHeader } from "./AppHeader";
import { Card, Notice } from "./ui";
import { AlertIcon } from "./Icons";
import type { ReactNode } from "react";

export const LEGAL_VERSION = "2026-02-01";
export const LEGAL_UPDATED = "1 February 2026";

/**
 * Shared shell for the legal documents.
 *
 * These are drafted to be read on a phone — short paragraphs, plain headings,
 * and a visible "what this means for you" summary at the top of each section
 * rather than pure legalese.
 */
export function LegalLayout({
  title,
  summary,
  children,
  backHref = "/onboarding",
}: {
  title: string;
  summary: string;
  children: ReactNode;
  backHref?: string;
}) {
  return (
    <div className="min-h-[100dvh]">
      <DetailHeader title={title} subtitle={`Version ${LEGAL_VERSION} · updated ${LEGAL_UPDATED}`} backHref={backHref} />

      <div className="app-scroll">
        <div className="space-y-section">
          <Card className="p-4">
            <p className="text-[13px] leading-6 text-ink">{summary}</p>
          </Card>

          <article className="space-y-section">{children}</article>

          <Notice tone="warn" icon={<AlertIcon size={18} />} title="This is a template">
            CareNow v1 is a pre-launch build. These documents are written against the Nigeria Data
            Protection Act 2023, but they must be reviewed by a qualified Nigerian lawyer before
            release — including naming a Data Protection Officer and registering with the Nigeria
            Data Protection Commission.
          </Notice>

          <p className="pb-6 text-center text-[11px] leading-5 text-ink-muted">
            Questions about this document? privacy@carenow.health
            <br />
            CareNow Telemedicine · Version {LEGAL_VERSION}
          </p>
        </div>
      </div>
    </div>
  );
}

export function Clause({
  n,
  heading,
  children,
}: {
  n: number;
  heading: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`clause-${n}`}>
      <h2 id={`clause-${n}`} className="mb-3 text-[15px] font-semibold text-ink">
        <span className="text-primary">{n}. </span>
        {heading}
      </h2>
      <div className="space-y-3 text-[13px] leading-6 text-ink-muted">{children}</div>
    </section>
  );
}

export function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((t) => (
        <li key={t} className="flex gap-2.5">
          <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}
