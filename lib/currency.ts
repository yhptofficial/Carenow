/**
 * Money formatting.
 *
 * Fees are per-doctor and per-booking, so the currency travels with the record
 * rather than being assumed by the UI. That matters here: CareNow prices in
 * naira (₦) but the schema and types keep room for other markets, and a
 * hardcoded symbol in a screen is exactly how a patient ends up reading the
 * wrong number.
 */

import type { Currency } from "./types";

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  NGN: "₦",
  INR: "₹",
  USD: "$",
};

/** The currency CareNow prices in. */
export const DEFAULT_CURRENCY: Currency = "NGN";

/** Fictional, human-readable example: `formatMoney(8000)` → "₦8,000". */
export function formatMoney(amount: number, currency: Currency = DEFAULT_CURRENCY): string {
  const symbol = CURRENCY_SYMBOL[currency] ?? "";
  const rounded = Math.round(amount);
  // Group thousands without depending on ICU locale data being complete.
  const grouped = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${symbol}${grouped}`;
}

/** "₦8,000 paid" / "₦8,000 unpaid" — the phrasing used on booking rows. */
export function formatMoneyWithLabel(
  amount: number,
  currency: Currency,
  label: string,
): string {
  return `${formatMoney(amount, currency)} ${label}`;
}
