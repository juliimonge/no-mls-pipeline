/**
 * Matcher behaviour, pinned.
 *
 * These are behavioural claims, not coverage: each one corresponds to a
 * sentence in docs/MATCHING.md, so the prose and the code cannot drift apart
 * silently.
 *
 *   npm test
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { areLikelyDuplicates, matchListings, pickCanonical } from '../src/lib/matcher';
import type { DBListing } from '../src/lib/types';

const fixture: DBListing[] = JSON.parse(
  readFileSync(join(process.cwd(), 'fixtures', 'listings.sample.json'), 'utf-8'),
);

const byId = (id: string) => fixture.find((r) => r.id === id)!;
const groupContaining = (groups: ReturnType<typeof matchListings>, id: string) =>
  groups.find((g) => g.listingIds.includes(id))!;

test('resolves the fixture to the expected number of properties', () => {
  const groups = matchListings(fixture);
  assert.equal(groups.length, 5, '9 listings should resolve to 5 distinct properties');
  assert.equal(groups.filter((g) => g.isOpenListing).length, 2);
});

test('groups a property carried by three agencies', () => {
  const groups = matchListings(fixture);
  const group = groupContaining(groups, 'L1');
  assert.deepEqual([...group.listingIds].sort(), ['L1', 'L2', 'L3']);
  assert.equal(group.sourceCount, 3);
  assert.equal(group.isOpenListing, true);
});

test('duplication is transitive: T1 and T3 group via T2 without pairing directly', () => {
  assert.equal(
    areLikelyDuplicates(byId('T1'), byId('T3')),
    false,
    'precondition: T1 and T3 must NOT pair directly, or the test proves nothing',
  );
  assert.ok(areLikelyDuplicates(byId('T1'), byId('T2')));
  assert.ok(areLikelyDuplicates(byId('T2'), byId('T3')));

  const group = groupContaining(matchListings(fixture), 'T1');
  assert.ok(group.listingIds.includes('T3'), 'connected components must close the chain');
});

test('a bedroom mismatch rejects even when every other field agrees', () => {
  const b1 = byId('B1');
  const b2 = byId('B2');
  assert.equal(areLikelyDuplicates(b1, b2), false);

  // Same pair with bedrooms reconciled matches on the remaining fields —
  // proving the rejection came from the gate and nothing else.
  assert.ok(areLikelyDuplicates(b1, { ...b2, bedrooms: 3 }));
});

test('a single-source listing is a group of one and not an open listing', () => {
  const group = groupContaining(matchListings(fixture), 'S1');
  assert.deepEqual(group.listingIds, ['S1']);
  assert.equal(group.isOpenListing, false);
});

test('two listings from the same agency are never compared', () => {
  const a = { ...byId('L1'), id: 'X1', source: 'remax' };
  const b = { ...byId('L1'), id: 'X2', source: 'remax' };
  const groups = matchListings([a, b] as DBListing[]);
  assert.equal(groups.length, 2, 'within-source duplicates are a crawl bug, not a match');
});

test('the canonical record is the most complete one, not the cheapest or the first', () => {
  const sparse: DBListing = { ...byId('L3'), id: 'C1' };
  const complete: DBListing = { ...byId('L1'), id: 'C2' };
  assert.equal(pickCanonical([sparse, complete]).id, 'C2');
  assert.equal(pickCanonical([complete, sparse]).id, 'C2', 'order must not matter');
});

test('matching is order-independent', () => {
  const forward = matchListings(fixture).length;
  const reversed = matchListings([...fixture].reverse()).length;
  assert.equal(forward, reversed);
});

test('nulls never fabricate a match', () => {
  const bare: DBListing = {
    id: 'N1', source: 'remax', title: null, location: null, price_usd: null,
    bedrooms: null, bathrooms: null, sqm: null, lot_sqm: null,
    property_type: 'house', image_urls: [],
  };
  const other: DBListing = { ...bare, id: 'N2', source: 'mango' };
  assert.equal(
    areLikelyDuplicates(bare, other),
    false,
    'two records with no comparable fields must not match',
  );
});
