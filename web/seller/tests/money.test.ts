import { describe, it, expect } from 'vitest';
import { inputStepForMinorUnit, majorToMinor, minorToMajor } from '../src/lib/money';

describe('minorToMajor', () => {
  it('converts minor units to a major decimal string (EGP, minor_unit 2)', () => {
    expect(minorToMajor(12345, 2)).toBe('123.45');
    expect(minorToMajor(5, 2)).toBe('0.05');
    expect(minorToMajor(50, 2)).toBe('0.50');
    expect(minorToMajor(100, 2)).toBe('1.00');
  });

  it('converts minor units with minor_unit 3 (KWD)', () => {
    expect(minorToMajor(12345, 3)).toBe('12.345');
    expect(minorToMajor(1, 3)).toBe('0.001');
    expect(minorToMajor(123450, 3)).toBe('123.450');
  });

  it('returns integers for zero-decimal currencies', () => {
    expect(minorToMajor(500, 0)).toBe('500');
    expect(minorToMajor(0, 0)).toBe('0');
  });

  it('handles zero, negatives and non-finite input without float drift', () => {
    expect(minorToMajor(0, 2)).toBe('0.00');
    expect(minorToMajor(-12345, 2)).toBe('-123.45');
    // Large amounts (still exact as JS numbers) must not drift.
    expect(minorToMajor(9007199254740991, 2)).toBe('90071992547409.91');
    expect(majorToMinor('90071992547409.91', 2)).toBe(9007199254740991);
    expect(minorToMajor(NaN, 2)).toBe('0');
    expect(minorToMajor(Infinity, 2)).toBe('0');
  });
});

describe('majorToMinor', () => {
  it('parses major input to minor units (EGP, minor_unit 2)', () => {
    expect(majorToMinor('123.45', 2)).toBe(12345);
    expect(majorToMinor('0.05', 2)).toBe(5);
    expect(majorToMinor('100', 2)).toBe(10000);
    expect(majorToMinor('100.', 2)).toBe(10000);
    expect(majorToMinor('.99', 2)).toBe(99);
  });

  it('parses major input to minor units (KWD, minor_unit 3)', () => {
    expect(majorToMinor('12.345', 3)).toBe(12345);
    expect(majorToMinor('0.001', 3)).toBe(1);
    expect(majorToMinor('12.3', 3)).toBe(12300);
  });

  it('accepts numeric input', () => {
    expect(majorToMinor(123.45, 2)).toBe(12345);
    expect(majorToMinor(12.345, 3)).toBe(12345);
    expect(majorToMinor(100, 2)).toBe(10000);
  });

  it('rounds half-up digits beyond the minor unit', () => {
    expect(majorToMinor('1.005', 2)).toBe(101);
    expect(majorToMinor('1.004', 2)).toBe(100);
    expect(majorToMinor('1.0049', 3)).toBe(1005);
  });

  it('handles zero-decimal currencies, empties and invalid input', () => {
    expect(majorToMinor('123', 0)).toBe(123);
    expect(majorToMinor('123.7', 0)).toBe(124);
    expect(majorToMinor('', 2)).toBe(0);
    expect(majorToMinor('   ', 2)).toBe(0);
    expect(majorToMinor('abc', 2)).toBeNaN();
    expect(majorToMinor('12.3.4', 2)).toBeNaN();
  });

  it('handles negative amounts', () => {
    expect(majorToMinor('-123.45', 2)).toBe(-12345);
  });
});

describe('inputStepForMinorUnit', () => {
  it('maps minor units to decimal step strings', () => {
    expect(inputStepForMinorUnit(0)).toBe('1');
    expect(inputStepForMinorUnit(1)).toBe('0.1');
    expect(inputStepForMinorUnit(2)).toBe('0.01');
    expect(inputStepForMinorUnit(3)).toBe('0.001');
  });

  it('treats negative minor units as zero-decimal', () => {
    expect(inputStepForMinorUnit(-1)).toBe('1');
  });
});
