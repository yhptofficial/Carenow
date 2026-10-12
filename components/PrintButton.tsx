"use client";

import { DownloadIcon } from "./Icons";

/**
 * "Download" in a PWA means the browser's own print-to-PDF flow. `window.print()`
 * is the one reliable way to produce a file on iOS Safari, which is where most
 * of these prescriptions get handed to a pharmacist.
 */
export function PrintButton({ label = "Download" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print -mr-1 inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-chip font-medium text-primary-dark pressable hover:bg-primary-tint"
    >
      <DownloadIcon size={16} />
      {label}
    </button>
  );
}
