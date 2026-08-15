/**
 * Reference scraper — the contract every source adapter satisfies.
 *
 * WHY THIS IS THE ONLY SCRAPER IN THIS REPOSITORY
 * ===============================================
 * The production pipeline runs nine of these, one per agency operating in
 * Nosara. Those are not published here: they encode the DOM structure of named
 * businesses I compete with, and publishing working scrapers against them
 * would be a commercial and legal question with no engineering content. The
 * interesting part is not the CSS selectors — it is the normalisation contract
 * below and the entity resolution in `src/lib/matcher.ts`, and both are here in
 * full.
 *
 * This scraper runs against a checked-in HTML fixture, so `npm run demo` works
 * offline with no network and no credentials.
 *
 * THE CONTRACT
 * ============
 * Every source adapter, whatever the site looks like, returns
 * `ScrapedListing[]` in the shape below. That is the entire coupling between a
 * source and the rest of the pipeline: add an agency by writing one of these,
 * change nothing else. Each real adapter opens with a CONFIGURATION block like
 * the one below, so a site redesign is a one-place edit rather than a hunt.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as cheerio from 'cheerio';

import type { ScrapedListing, Scraper } from '../lib/types';
import {
  cleanTitle,
  guessPropertyType,
  idFromUrl,
  parseArea,
  parseNumber,
  parsePrice,
} from '../lib/normalizer';

// ── CONFIGURATION ─────────────────────────────────────────────
// In a production adapter these point at the live site. Here they point at a
// fixture so the demo is hermetic.
const BASE_URL = 'https://example-agency.test';
const FIXTURE = join(process.cwd(), 'fixtures', 'example-agency.html');

const SEL = {
  card: '.property-card',
  link: 'a.property-link',
  title: '.property-title',
  price: '.property-price',
  beds: '[data-beds]',
  baths: '[data-baths]',
  area: '.property-area',
  lot: '.property-lot',
  location: '.property-location',
  image: 'img.property-image',
};
// ──────────────────────────────────────────────────────────────

const exampleAgencyScraper: Scraper = {
  // NOTE: 'remax' is used only because SourceAgency is a closed union in
  // src/lib/types.ts and this repo ships no fictional agency member. In the
  // production pipeline each adapter declares its own source.
  source: 'remax',

  async scrape(): Promise<ScrapedListing[]> {
    const html = readFileSync(FIXTURE, 'utf-8');
    const $ = cheerio.load(html);
    const results: ScrapedListing[] = [];
    const seen = new Set<string>();

    $(SEL.card).each((_, el) => {
      const card = $(el);
      const href = card.find(SEL.link).attr('href') ?? '';
      if (!href) return;

      const sourceUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
      const sourceId = idFromUrl(sourceUrl);

      // Real listing pages paginate and lazy-load; the same card can appear
      // twice in one crawl. Dedupe within a source before the matcher ever
      // sees it — cross-source duplicates are the matcher's job, but
      // within-source duplicates are a crawl bug and should not leak out.
      if (seen.has(sourceId)) return;
      seen.add(sourceId);

      const title = cleanTitle(card.find(SEL.title).text());

      results.push({
        source: exampleAgencyScraper.source,
        sourceId,
        sourceUrl,
        title,
        location: card.find(SEL.location).text().trim() || null,
        // Every quantitative field goes through the normalizer. Agencies write
        // "$1,250,000", "USD 1.25M" and "1250000" for the same number, and
        // area in m², ft² and acres — comparing raw strings across sources is
        // the single easiest way to get this wrong.
        priceUsd: parsePrice(card.find(SEL.price).text()),
        bedrooms: parseNumber(card.find(SEL.beds).attr('data-beds')),
        bathrooms: parseNumber(card.find(SEL.baths).attr('data-baths')),
        sqm: parseArea(card.find(SEL.area).text()),
        lotSqm: parseArea(card.find(SEL.lot).text()),
        propertyType: guessPropertyType(`${title ?? ''} ${card.text()}`),
        description: null,
        imageUrls: [card.find(SEL.image).attr('src')].filter(Boolean) as string[],
        amenities: [],
        // Keep the untransformed card. When a match looks wrong six months
        // later, the question is always "what did the site actually say?", and
        // without this the answer is gone.
        rawData: { html: card.html()?.slice(0, 2000) ?? null },
      });
    });

    return results;
  },
};

export default exampleAgencyScraper;
