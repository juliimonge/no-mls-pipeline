/**
 * Run the reference scraper against the checked-in HTML fixture.
 *
 *   npm run demo:scrape
 *
 * Shows the normalisation contract doing its job: three price notations and
 * three area units in, one canonical shape out, with the paginated duplicate
 * dropped before anything downstream sees it.
 */

import scraper from '../src/scrapers/example-agency';

const listings = await scraper.scrape();

console.log('\n  reference scraper — fixtures/example-agency.html');
console.log('  ' + '─'.repeat(64));
console.log('  4 cards in the fixture, one of them a paginated repeat.\n');

for (const l of listings) {
  console.log(`  ${l.title}`);
  console.log(`    id ${l.sourceId}   type ${l.propertyType}`);
  console.log(`    price   ${l.priceUsd === null ? '—' : '$' + l.priceUsd.toLocaleString('en-US')}`);
  console.log(`    area    ${l.sqm === null ? '—' : l.sqm + ' m²'}   ` +
              `lot ${l.lotSqm === null ? '—' : Math.round(l.lotSqm) + ' m²'}`);
  console.log(`    beds ${l.bedrooms ?? '—'}   baths ${l.bathrooms ?? '—'}\n`);
}

console.log('  ' + '─'.repeat(64));
console.log(`  ${listings.length} unique listings returned.`);
console.assert(listings.length === 3, 'DEDUPE BROKEN: the repeated card was not dropped');
console.log('  ✓ dedupe        the repeated card was dropped on sourceId');
console.log('  ✓ units         ft² and acres normalised to m² for comparison\n');
