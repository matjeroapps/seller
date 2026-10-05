/**
 * Money helpers for the Seller portal.
 *
 * Backend contracts carry money in minor units. Core's `money.Money` emits
 * `amount_minor`, while some seller-api DTOs (product detail) emit `amount`;
 * both are minor units. All UI math should go through these helpers so that
 * major/minor units are never mixed.
 */

export interface MoneyLike {
  currency?: string;
  amount_minor?: number;
  amount?: number;
}

const ZERO_DECIMAL = new Set(['JPY', 'KRW']);
const THREE_DECIMAL = new Set(['KWD', 'BHD', 'OMR', 'JOD']);

export function currencyExponent(currency?: string): number {
  const code = (currency || '').toUpperCase();
  if (ZERO_DECIMAL.has(code)) return 0;
  if (THREE_DECIMAL.has(code)) return 3;
  return 2;
}

/** Returns the minor-unit amount of a money object, or null when absent. */
export function minorAmount(money?: MoneyLike | null): number | null {
  if (!money) return null;
  const value = money.amount_minor ?? money.amount;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function minorToMajor(minor: number, currency?: string): number {
  return minor / Math.pow(10, currencyExponent(currency));
}

export function majorToMinor(major: number, currency?: string): number {
  return Math.round(major * Math.pow(10, currencyExponent(currency)));
}

/** Formats a money object as "SAR 120.00"; returns the fallback when absent. */
export function formatMoney(money?: MoneyLike | null, fallback = 'N/A'): string {
  const minor = minorAmount(money);
  if (minor === null) return fallback;
  const currency = money?.currency || '';
  return `${currency} ${minorToMajor(minor, currency).toFixed(currencyExponent(currency))}`.trim();
}
