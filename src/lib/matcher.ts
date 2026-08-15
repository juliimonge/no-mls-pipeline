/**
 * Entity resolution across agencies that share no key.
 *
 * THE PROBLEM
 * ===========
 * Nosara has no MLS. Listings are open and non-exclusive, so one house is
 * advertised by several agencies at several prices under several descriptions.
 * There is no listing id, no address standard and no shared taxonomy — nothing
 * to join on. Identity has to be inferred from attributes each agency records
 * differently, or does not record at all.
 *
 * WHY UNION-FIND AND NOT PAIRWISE MATCHING
 * ========================================
 * Duplication is transitive. If A matches B and B matches C, they are one
 * house — even when A and C do not look like each other, which happens
 * constantly because one agency omits the lot size, another rounds the price,
 * a third lists interior area where the rest list total. Pairwise matching
 * produces overlapping pairs and no answer to "how many houses are there".
 * Connected components produce the answer directly.
 *
 * THE COMPARISON IS O(n²)
 * =======================
 * Deliberately. At Nosara's scale — roughly 500 listings — that is a few
 * hundred thousand comparisons and finishes in milliseconds. Blocking or an
 * index would be the right call at 100k listings and premature here, and there
 * is a stronger argument against it: the correct place to spend effort is
 * measuring the matcher's accuracy (see docs/MATCHING.md), and any blocking
 * scheme has to be validated against that measurement anyway.
 */

import type { DBListing, MatchGroup, PropertyTypeValue } from './types';

// ── TUNING KNOBS ──────────────────────────────────────────────
// Hand-tuned against observed data, NOT learned. See docs/MATCHING.md for
// what it would take to justify these numbers rather than assert them.
export const PRICE_TOLERANCE  = 0.15; // ±15%
export const SQM_TOLERANCE    = 0.20; // ±20%
export const MIN_MATCH_FIELDS = 2;    // fields that must agree
// ──────────────────────────────────────────────────────────────

/**
 * Group listings that describe the same physical property.
 *
 * Pure: same input, same output, no I/O. The Supabase-backed entry point is
 * `runMatcher` in `matcher.db.ts`, which fetches and then calls this. Keeping
 * the algorithm free of I/O is what makes it testable against fixtures.
 */
export function matchListings(listings: DBListing[]): MatchGroup[] {
  // ── Union-Find with path compression ────────────────────────
  const parent = new Map<string, string>(listings.map((l) => [l.id, l.id]));

  function find(id: string): string {
    const p = parent.get(id)!;
    if (p !== id) parent.set(id, find(p));
    return parent.get(id)!;
  }

  function union(a: string, b: string): void {
    parent.set(find(a), find(b));
  }

  for (let i = 0; i < listings.length; i++) {
    for (let j = i + 1; j < listings.length; j++) {
      const a = listings[i];
      const b = listings[j];
      // One agency listing the same house twice is their data problem, not a
      // cross-source duplicate. Comparing them would inflate the group count.
      if (a.source === b.source) continue;
      if (areLikelyDuplicates(a, b)) union(a.id, b.id);
    }
  }

  // ── Collect connected components ────────────────────────────
  const groupMap = new Map<string, DBListing[]>();
  for (const listing of listings) {
    const root = find(listing.id);
    if (!groupMap.has(root)) groupMap.set(root, []);
    groupMap.get(root)!.push(listing);
  }

  const groups: MatchGroup[] = [];
  for (const members of groupMap.values()) {
    const sources = new Set(members.map((m) => m.source));
    const canonical = pickCanonical(members);

    groups.push({
      listingIds:        members.map((m) => m.id),
      canonicalTitle:    canonical.title ?? 'Untitled Property',
      canonicalPrice:    canonical.price_usd,
      canonicalLocation: canonical.location,
      bedrooms:          canonical.bedrooms,
      bathrooms:         canonical.bathrooms,
      sqm:               canonical.sqm,
      lotSqm:            canonical.lot_sqm,
      propertyType:      canonical.property_type as PropertyTypeValue,
      primaryImageUrl:   canonical.image_urls?.[0] ?? null,
      sourceCount:       sources.size,
      // The product claim: a property carried by two or more agencies is
      // demonstrably an open listing, because exclusivity would forbid it.
      isOpenListing:     sources.size >= 2,
    });
  }

  return groups;
}

/**
 * Does this pair describe the same property?
 *
 * Asymmetric on purpose. Bedrooms are a hard gate — agencies disagree about
 * area and price all the time, but a 3-bedroom and a 4-bedroom are not the
 * same house, and treating that as one vote among several merges distinct
 * properties. Everything else votes, and a single disagreement on a
 * quantitative field vetoes the match.
 */
export function areLikelyDuplicates(a: DBListing, b: DBListing): boolean {
  let matched = 0;
  let failed = 0;

  // Price — agencies quote the same house differently, hence a wide band.
  if (a.price_usd !== null && b.price_usd !== null) {
    const diff = Math.abs(a.price_usd - b.price_usd) / Math.max(a.price_usd, b.price_usd);
    if (diff <= PRICE_TOLERANCE) matched++;
    else failed++;
  }

  // Bedrooms — hard match. A mismatch rejects immediately.
  if (a.bedrooms !== null && b.bedrooms !== null) {
    if (a.bedrooms === b.bedrooms) matched++;
    else return false;
  }

  // Bathrooms — votes in favour, never vetoes. Half-baths are counted
  // inconsistently across agencies, so a mismatch here is weak evidence.
  if (a.bathrooms !== null && b.bathrooms !== null) {
    if (a.bathrooms === b.bathrooms) matched++;
  }

  // Construction area — wider band than price; some agencies publish interior
  // area and others total built area, including terraces.
  if (a.sqm !== null && b.sqm !== null) {
    const diff = Math.abs(a.sqm - b.sqm) / Math.max(a.sqm, b.sqm);
    if (diff <= SQM_TOLERANCE) matched++;
    else failed++;
  }

  // Lot area — votes in favour, never vetoes. Frequently absent or copied
  // from an outdated plano.
  if (a.lot_sqm !== null && b.lot_sqm !== null) {
    const diff = Math.abs(a.lot_sqm - b.lot_sqm) / Math.max(a.lot_sqm, b.lot_sqm);
    if (diff <= SQM_TOLERANCE) matched++;
  }

  return matched >= MIN_MATCH_FIELDS && failed === 0;
}

/**
 * Pick the record that represents the group.
 *
 * Completeness, not preference: the listing carrying the most usable fields
 * wins. Ranking by agency instead would bake a commercial preference into what
 * is meant to be a neutral view of the market.
 */
export function pickCanonical(members: DBListing[]): DBListing {
  const score = (m: DBListing) =>
    (m.title !== null ? 2 : 0) +
    (m.price_usd !== null ? 2 : 0) +
    (m.bedrooms !== null ? 1 : 0) +
    (m.sqm !== null ? 1 : 0) +
    (m.image_urls?.length ?? 0);

  return members.reduce((best, curr) => (score(curr) > score(best) ? curr : best));
}
