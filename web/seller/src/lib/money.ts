/**
 * Integer-safe money helpers.
 *
 * Monetary amounts are transported as integers in the currency's minor unit
 * (e.g. EGP minor_unit=2: 12345 minor => "123.45" major; KWD minor_unit=3:
 * 12345 minor => "12.345" major). All conversions below avoid floating point
 * arithmetic on the significant digits; only fixed-size integers and strings
 * are used, so no drift can occur for realistic amounts.
 */

/**
 * Convert an integer minor-unit amount into a major-unit decimal string.
 * Example: minorToMajor(12345, 2) === '123.45'; minorToMajor(5, 2) === '0.05';
 * minorToMajor(12345, 3) === '12.345'; minorToMajor(500, 0) === '500'.
 */
export function minorToMajor(amountMinor: number, minorUnit: number): string {
  if (!Number.isFinite(amountMinor)) return '0';
  const negative = amountMinor < 0;
  const digits = Math.abs(Math.trunc(amountMinor)).toString();

  if (minorUnit <= 0) {
    return (negative ? '-' : '') + digits;
  }

  let padded = digits;
  if (padded.length <= minorUnit) {
    padded = '0'.repeat(minorUnit - padded.length + 1) + padded;
  }
  const intPart = padded.slice(0, padded.length - minorUnit);
  const fracPart = padded.slice(padded.length - minorUnit);
  return (negative ? '-' : '') + `${intPart}.${fracPart}`;
}

/**
 * Parse a major-unit value (string or number) into an integer minor-unit
 * amount. Examples with minorUnit 2: '123.45' -> 12345; with minorUnit 3:
 * '12.345' -> 12345. Uses string/integer math, so no float drift.
 *
 * Returns 0 for empty/whitespace input. Digits beyond the minor unit are
 * rounded half-up (e.g. minorUnit 2, '1.005' -> 101, '1.004' -> 100).
 * Returns NaN when the input is not a valid non-exponential decimal number.
 */
export function majorToMinor(value: string | number, minorUnit: number): number {
  let raw = typeof value === 'number' ? String(value) : value.trim();
  if (typeof value === 'number' && /e/i.test(raw)) {
    // Exponential notation (very small/large literals): expand to a plain
    // decimal with a few guard digits; trailing digits get rounded below.
    raw = value.toFixed(Math.max(minorUnit, 0) + 6);
  }
  if (raw === '') return 0;

  const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(raw);
  if (!match || (match[2] === '' && (match[3] === undefined || match[3] === ''))) return NaN;

  const sign = match[1] === '-' ? -1 : 1;
  const intPart = match[2] || '0';
  const fracPart = match[3] || '';
  const unit = Math.max(minorUnit, 0);

  // Keep `unit` fractional digits, rounding half-up on the remainder.
  const kept = fracPart.slice(0, unit).padEnd(unit, '0');
  const rest = fracPart.slice(unit);
  let digits = BigInt(intPart + kept);
  if (rest.length > 0 && Number(rest[0]) >= 5) {
    digits += 1n;
  }
  return sign * Number(digits);
}

/**
 * HTML input `step` for a currency with the given minor unit, expressed as a
 * decimal string: 0 -> '1', 2 -> '0.01', 3 -> '0.001' (i.e. 10^-minorUnit).
 */
export function inputStepForMinorUnit(minorUnit: number): string {
  const unit = Math.max(minorUnit, 0);
  if (unit === 0) return '1';
  return '0.' + '0'.repeat(unit - 1) + '1';
}
