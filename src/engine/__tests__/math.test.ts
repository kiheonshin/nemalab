// ============================================================================
// Math Utility Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import { clamp, lerp, formatNumber, formatSigned, deepClone, mergeDeep, getByPath, setByPath } from '../math';

describe('clamp', () => {
  it('should clamp below min', () => expect(clamp(-5, 0, 10)).toBe(0));
  it('should clamp above max', () => expect(clamp(15, 0, 10)).toBe(10));
  it('should pass through values in range', () => expect(clamp(5, 0, 10)).toBe(5));
  it('should handle equal min/max', () => expect(clamp(5, 3, 3)).toBe(3));
});

describe('lerp', () => {
  it('should return a at t=0', () => expect(lerp(10, 20, 0)).toBe(10));
  it('should return b at t=1', () => expect(lerp(10, 20, 1)).toBe(20));
  it('should return midpoint at t=0.5', () => expect(lerp(10, 20, 0.5)).toBe(15));
});

describe('formatNumber', () => {
  it('should format with fixed digits', () => expect(formatNumber(3.14159, 2)).toBe('3.14'));
  it('should return em-dash for null', () => expect(formatNumber(null)).toBe('\u2014'));
  it('should return em-dash for NaN', () => expect(formatNumber(NaN)).toBe('\u2014'));
});

describe('formatSigned', () => {
  it('should add + for positive', () => expect(formatSigned(3.14, 1)).toBe('+3.1'));
  it('should keep - for negative', () => expect(formatSigned(-2.5, 1)).toBe('-2.5'));
  it('should return em-dash for null', () => expect(formatSigned(null)).toBe('\u2014'));
});

describe('deepClone', () => {
  it('should deep clone an object', () => {
    const original = { a: 1, b: { c: 2 } };
    const cloned = deepClone(original);
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned.b).not.toBe(original.b);
  });
});

describe('mergeDeep', () => {
  it('should deep merge overrides', () => {
    const base = { a: 1, b: { c: 2, d: 3 } } as Record<string, unknown>;
    const override = { b: { c: 99 } } as Record<string, unknown>;
    const result = mergeDeep(base, override);
    expect(result).toEqual({ a: 1, b: { c: 99, d: 3 } });
  });

  it('should not mutate base', () => {
    const base = { a: 1 } as Record<string, unknown>;
    mergeDeep(base, { a: 2 } as Record<string, unknown>);
    expect(base.a).toBe(1);
  });
});

describe('getByPath / setByPath', () => {
  it('should get nested value', () => {
    const obj = { a: { b: { c: 42 } } };
    expect(getByPath(obj as Record<string, unknown>, 'a.b.c')).toBe(42);
  });

  it('should return undefined for missing path', () => {
    const obj = { a: 1 };
    expect(getByPath(obj as Record<string, unknown>, 'a.b.c')).toBeUndefined();
  });

  it('should set nested value', () => {
    const obj: Record<string, unknown> = { a: { b: 1 } };
    setByPath(obj, 'a.b', 99);
    expect((obj.a as Record<string, unknown>).b).toBe(99);
  });

  it('should create intermediate objects', () => {
    const obj: Record<string, unknown> = {};
    setByPath(obj, 'x.y.z', 'hello');
    expect(getByPath(obj, 'x.y.z')).toBe('hello');
  });
});
