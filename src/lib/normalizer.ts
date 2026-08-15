import type { PropertyTypeValue } from './types';

/** Parse a price string like "$1,250,000" or "USD 350.000" → number */
export function parsePrice(raw: string | null | undefined): number | null {
  if (!raw) return null;
  // Replace European-style thousand separators (period before 3 digits)
  const cleaned = raw.replace(/\.(?=\d{3})/g, '').replace(/[^0-9]/g, '');
  const n = parseInt(cleaned, 10);
  return isNaN(n) || n === 0 ? null : n;
}

/** Parse a number from a string, stripping non-numeric chars */
export function parseNumber(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) || n === 0 ? null : n;
}

/** Convert square feet to square meters */
export function sqftToSqm(sqft: number): number {
  return Math.round(sqft * 0.0929);
}

/** Convert acres to square meters */
export function acresToSqm(acres: number): number {
  return Math.round(acres * 4046.86);
}

/** Normalize area: detect unit from string, return sqm */
export function parseArea(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const num = parseNumber(raw);
  if (!num) return null;

  if (lower.includes('sqft') || lower.includes('sq ft') || lower.includes('ft²')) {
    return sqftToSqm(num);
  }
  if (lower.includes('acre')) {
    return acresToSqm(num);
  }
  // Default: assume square meters
  return num;
}

/** Clean up a title string */
export function cleanTitle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.replace(/\s+/g, ' ').trim() || null;
}

/** Guess property type from title or type string */
export function guessPropertyType(raw: string | null | undefined): PropertyTypeValue {
  if (!raw) return 'other';
  const lower = raw.toLowerCase();
  if (lower.includes('lot') || lower.includes('land') || lower.includes('terreno')) return 'lot';
  if (lower.includes('villa')) return 'villa';
  if (lower.includes('condo') || lower.includes('apartment') || lower.includes('apto')) return 'condo';
  if (lower.includes('penthouse')) return 'penthouse';
  if (lower.includes('commercial') || lower.includes('comercial') || lower.includes('office')) return 'commercial';
  if (lower.includes('farm') || lower.includes('finca')) return 'farm';
  if (lower.includes('house') || lower.includes('home') || lower.includes('casa')) return 'house';
  return 'other';
}

/** Extract a stable slug-like ID from a URL */
export function idFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] ?? u.pathname;
  } catch {
    return url.slice(-60);
  }
}
