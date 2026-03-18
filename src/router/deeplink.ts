// ============================================================================
// Deep Link Parser & Generator
// Supports: ?preset=<id>, ?config=<base64JSON>, ?seed=<string>
// These can be combined: ?preset=food-seeking&seed=abc123
// or: ?config=<base64>&seed=xyz
// ============================================================================

import type { SimConfig } from '../engine/types';
import { PRESETS, DEFAULT_CONFIG } from '../engine/constants';
import { mergeDeep, deepClone } from '../engine/math';

function encodeBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function decodeBase64Utf8(value: string): string {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeepLinkResult {
  /** Resolved SimConfig (from preset or decoded base64). Null if nothing parseable. */
  config: SimConfig | null;
  /** Seed override, if provided. */
  seed: string | null;
  /** Name of the matched preset (for UI display). */
  presetName: string | null;
  /** Any parse errors encountered (invalid base64, unknown preset, etc.). */
  errors: string[];
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

/**
 * Parse URL search params into a deep link result.
 *
 * Priority: `config` param takes precedence over `preset`.
 * If both are provided, `config` wins and `preset` is ignored.
 */
export function parseDeepLink(searchParams: URLSearchParams): DeepLinkResult {
  const result: DeepLinkResult = {
    config: null,
    seed: null,
    presetName: null,
    errors: [],
  };

  // --- Seed ---
  const seedParam = searchParams.get('seed');
  if (seedParam && seedParam.trim().length > 0) {
    result.seed = seedParam.trim();
  }

  // --- Config (base64-encoded JSON) ---
  const configParam = searchParams.get('config');
  if (configParam) {
    try {
      let decoded = '';
      try {
        decoded = decodeBase64Utf8(configParam);
      } catch {
        decoded = atob(configParam);
      }
      const parsed = JSON.parse(decoded);

      // Validate it has at least the shape of a SimConfig
      if (parsed && typeof parsed === 'object') {
        // Merge onto default config to fill any missing fields
        const merged = mergeDeep(
          deepClone(DEFAULT_CONFIG) as unknown as Record<string, unknown>,
          parsed as Record<string, unknown>,
        ) as unknown as SimConfig;
        result.config = merged;
        result.presetName = merged.presetName || null;
      } else {
        result.errors.push('deeplink.error.invalidConfigShape');
      }
    } catch (e) {
      if (e instanceof DOMException || (e instanceof Error && e.message.includes('atob'))) {
        result.errors.push('deeplink.error.invalidBase64');
      } else if (e instanceof SyntaxError) {
        result.errors.push('deeplink.error.invalidJSON');
      } else {
        result.errors.push('deeplink.error.unknownConfigError');
      }
    }

    // If config param is present, skip preset processing
    return result;
  }

  // --- Preset ---
  const presetParam = searchParams.get('preset');
  if (presetParam) {
    const normalizedId = presetParam.trim().toLowerCase();
    const preset = PRESETS.find((p) => p.id === normalizedId);

    if (preset) {
      // Merge preset overrides onto default config
      const merged = mergeDeep(
        deepClone(DEFAULT_CONFIG) as unknown as Record<string, unknown>,
        preset.overrides as Record<string, unknown>,
      ) as unknown as SimConfig;

      // Ensure presetName is set
      if (!merged.presetName || merged.presetName === DEFAULT_CONFIG.presetName) {
        merged.presetName = preset.name;
      }

      result.config = merged;
      result.presetName = preset.name;
    } else {
      result.errors.push('deeplink.error.unknownPreset');
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Generate
// ---------------------------------------------------------------------------

/**
 * Generate a deep link URL search string for the given config and seed.
 * The config is base64-encoded as JSON.
 *
 * @param config  The full SimConfig to encode.
 * @param seed    The seed string.
 * @returns       A URL search string like `?config=<base64>&seed=<seed>`
 */
export function generateDeepLink(config: SimConfig, seed: string): string {
  const params = new URLSearchParams();

  // Encode config as base64 JSON
  const json = JSON.stringify(config);
  const base64 = encodeBase64Utf8(json);
  params.set('config', base64);

  if (seed) {
    params.set('seed', seed);
  }

  return `?${params.toString()}`;
}

/**
 * Generate a deep link URL search string for a preset ID and optional seed.
 *
 * @param presetId  The preset ID (e.g. 'food-seeking').
 * @param seed      Optional seed string.
 * @returns         A URL search string like `?preset=food-seeking&seed=abc`
 */
export function generatePresetDeepLink(presetId: string, seed?: string): string {
  const params = new URLSearchParams();
  params.set('preset', presetId);

  if (seed) {
    params.set('seed', seed);
  }

  return `?${params.toString()}`;
}

export function buildAbsoluteDeepLink(search: string, path = '/simulator'): string {
  if (typeof window === 'undefined') {
    return `${path}${search}`;
  }

  return `${window.location.origin}${window.location.pathname}#${path}${search}`;
}

export function buildAbsoluteConfigDeepLink(config: SimConfig, seed: string): string {
  return buildAbsoluteDeepLink(generateDeepLink(config, seed));
}
