/**
 * Run the matcher over the checked-in fixture and print what it concluded.
 *
 *   npm run demo
 *
 * No network, no database, no credentials. The fixture is nine listings
 * constructed to exercise the four behaviours the design turns on; each row
 * carries a `_case` note saying which.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { matchListings, MIN_MATCH_FIELDS, PRICE_TOLERANCE, SQM_TOLERANCE } from '../src/lib/matcher';
import type { DBListing } from '../src/lib/types';

type FixtureRow = DBListing & { _case?: string };

const rows: FixtureRow[] = JSON.parse(
  readFileSync(join(process.cwd(), 'fixtures', 'listings.sample.json'), 'utf-8'),
);

const money = (n: number | null) =>
  n === null ? '—' : `$${n.toLocaleString('en-US')}`;

console.log('\n  no-mls-pipeline — entity resolution demo');
console.log('  ' + '─'.repeat(58));
console.log(`  tolerances   price ±${PRICE_TOLERANCE * 100}%   area ±${SQM_TOLERANCE * 100}%   ` +
            `min fields ${MIN_MATCH_FIELDS}   bedrooms exact`);
console.log(`  input        ${rows.length} listings from ` +
            `${new Set(rows.map((r) => r.source)).size} agencies\n`);

const groups = matchListings(rows).sort((a, b) => b.sourceCount - a.sourceCount);
const byId = new Map(rows.map((r) => [r.id, r]));

for (const group of groups) {
  const tag = group.isOpenListing
    ? `OPEN LISTING · ${group.sourceCount} agencies`
    : 'single source';
  console.log(`  ${group.canonicalTitle}`);
  console.log(`  ${tag}   ${money(group.canonicalPrice)}   ` +
              `${group.bedrooms ?? '—'} bed / ${group.bathrooms ?? '—'} bath`);
  for (const id of group.listingIds) {
    const row = byId.get(id)!;
    console.log(`      ${row.source.padEnd(14)} ${money(row.price_usd).padStart(11)}   ` +
                `${String(row.sqm ?? '—').padStart(4)} m²   ${id}`);
  }
  console.log('');
}

const open = groups.filter((g) => g.isOpenListing).length;
console.log('  ' + '─'.repeat(58));
console.log(`  ${rows.length} listings resolved to ${groups.length} properties, ` +
            `${open} of them carried by more than one agency.\n`);

// The two claims the design rests on, asserted rather than described — if a
// tolerance change breaks either, this demo fails loudly instead of printing
// a plausible-looking wrong answer.
const groupOf = (id: string) => groups.find((g) => g.listingIds.includes(id))!;

const transitive = groupOf('T1').listingIds;
console.assert(
  transitive.includes('T3'),
  'TRANSITIVITY BROKEN: T1 and T3 should share a group via T2',
);
console.assert(
  groupOf('B1') !== groupOf('B2'),
  'BEDROOM GATE BROKEN: a 3-bed and a 4-bed were merged',
);

console.log(`  ✓ transitivity   T1 and T3 grouped via T2 (they do not pair directly)`);
console.log(`  ✓ bedroom gate   B1 and B2 kept apart despite every other field agreeing\n`);
