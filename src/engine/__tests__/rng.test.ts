// ============================================================================
// RNG Tests — Verify determinism of hashString + mulberry32
// ============================================================================

import { describe, it, expect } from 'vitest';
import { hashString, mulberry32, randomSeed } from '../rng';

describe('hashString', () => {
  it('should produce the same seed for the same input', () => {
    const gen1 = hashString('test-input');
    const gen2 = hashString('test-input');
    expect(gen1()).toBe(gen2());
  });

  it('should produce different seeds for different inputs', () => {
    const gen1 = hashString('input-a');
    const gen2 = hashString('input-b');
    expect(gen1()).not.toBe(gen2());
  });

  it('should return a 32-bit unsigned integer', () => {
    const gen = hashString('hello');
    const seed = gen();
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThanOrEqual(0xFFFFFFFF);
    expect(Number.isInteger(seed)).toBe(true);
  });
});

describe('mulberry32', () => {
  it('should produce deterministic sequences', () => {
    const rng1 = mulberry32(12345);
    const rng2 = mulberry32(12345);
    for (let i = 0; i < 100; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it('should produce values in [0, 1)', () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('should produce different sequences for different seeds', () => {
    const rng1 = mulberry32(111);
    const rng2 = mulberry32(222);
    const match = Array.from({ length: 10 }, () => rng1() === rng2()).every(Boolean);
    expect(match).toBe(false);
  });
});

describe('randomSeed', () => {
  it('should return a 6-character alphanumeric string', () => {
    const seed = randomSeed();
    expect(typeof seed).toBe('string');
    expect(seed.length).toBe(6);
    expect(/^[a-z0-9]+$/.test(seed)).toBe(true);
  });

  it('should produce different values on each call', () => {
    const seeds = new Set(Array.from({ length: 20 }, randomSeed));
    // At least 15 unique out of 20 (probabilistic but virtually certain)
    expect(seeds.size).toBeGreaterThan(15);
  });
});
