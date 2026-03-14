// ============================================================================
// Nema Lab Simulation Engine — Math Utilities
// Pure TypeScript, zero browser/DOM/Canvas dependencies
// ============================================================================

/**
 * Clamp a value between min and max (inclusive).
 * Identical to original `clamp()` in app.js.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Linear interpolation from `a` to `b` by factor `t` in [0, 1].
 * Identical to original `lerp()` in app.js.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Format a number to fixed decimal places, returning em-dash for null/NaN.
 * Identical to original `formatNumber()` in app.js.
 */
export function formatNumber(value: number | null | undefined, digits: number = 2): string {
  if (value == null || Number.isNaN(value)) return '\u2014';
  return Number(value).toFixed(digits);
}

/**
 * Format a number with explicit sign prefix (+/\u2212).
 * Identical to original `formatSigned()` in app.js.
 */
export function formatSigned(value: number | null | undefined, digits: number = 2): string {
  if (value == null || Number.isNaN(value)) return '\u2014';
  const num = Number(value);
  const formatted = num.toFixed(digits);
  return num > 0 ? `+${formatted}` : formatted;
}

/**
 * Format seconds into a human-readable time label.
 * Identical to original `timeLabel()` in app.js.
 */
export function timeLabel(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return '\u2014';
  return `${(seconds as number).toFixed(1)} s`;
}

/**
 * Deep clone via JSON round-trip.
 * Identical to original `deepClone()` in app.js.
 */
export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Deep merge `override` into a deep clone of `base`.
 * Identical to original `mergeDeep()` in app.js.
 */
export function mergeDeep<T extends Record<string, unknown>>(
  base: T,
  override: Partial<T> | Record<string, unknown>,
): T {
  const output = deepClone(base);
  const walk = (target: Record<string, unknown>, source: Record<string, unknown>) => {
    Object.keys(source || {}).forEach((key) => {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key] || typeof target[key] !== 'object') target[key] = {};
        walk(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
      } else {
        target[key] = source[key];
      }
    });
  };
  walk(output as Record<string, unknown>, (override || {}) as Record<string, unknown>);
  return output;
}

/**
 * Get a deeply nested value by dot-delimited path.
 * Identical to original `getByPath()` in app.js.
 */
export function getByPath(object: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (acc, part) => (acc == null ? undefined : (acc as Record<string, unknown>)[part]),
    object,
  );
}

/**
 * Return a CSS colour string for a given SimEvent type.
 */
export function eventColorForType(type: string): string {
  switch (type) {
    case 'collision':
      return 'rgba(255, 140, 140, 0.9)';
    case 'turn':
      return 'rgba(255, 204, 116, 0.9)';
    case 'reverse':
      return 'rgba(245, 201, 123, 0.9)';
    case 'food':
    case 'food-exit':
      return 'rgba(139, 233, 180, 0.9)';
    default:
      return 'rgba(125, 226, 207, 0.9)';
  }
}

/**
 * Set a deeply nested value by dot-delimited path, creating intermediaries.
 * Identical to original `setByPath()` in app.js.
 */
export function setByPath(object: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  const last = parts.pop()!;
  let cursor: Record<string, unknown> = object;
  parts.forEach((part) => {
    if (!cursor[part] || typeof cursor[part] !== 'object') cursor[part] = {};
    cursor = cursor[part] as Record<string, unknown>;
  });
  cursor[last] = value;
}
