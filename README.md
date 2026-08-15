# no-mls-pipeline

Nosara, Costa Rica has no MLS. Listings are open and non-exclusive, so the same
house is advertised by four agencies at four prices under four descriptions —
and nobody, buyer or seller or agent, can see what is actually for sale.

This resolves those listings into properties. The hard part is that **there is
no join key**: no listing id, no address standard, no shared taxonomy. Identity
has to be inferred from attributes each agency records differently, or does not
record at all.

```bash
npm install
npm run demo          # entity resolution over a fixture — no network, no DB
npm run demo:scrape   # the scraper contract over an HTML fixture
npm test              # 9 behavioural tests
```

---

## What the matcher does

```
  9 listings from 8 agencies
        │
        ▼
  pairwise comparison, cross-source only ──▶ union-find ──▶ connected components
        │
        ▼
  5 properties, 2 of them carried by more than one agency
```

Real output of `npm run demo`:

```
  Ocean-view villa above Playa Guiones
  OPEN LISTING · 3 agencies   $1,250,000   3 bed / 3 bath
      remax           $1,250,000    280 m²   L1
      century21       $1,295,000    275 m²   L2
      sothebys        $1,190,000      — m²   L3
```

One house, three agencies, a $105,000 spread between the highest and lowest
asking price for the same property. That spread is invisible in a market
without an MLS, and surfacing it is the entire product.

### Why Union-Find rather than pairwise matching

Duplication is transitive, and the data makes that unavoidable. If A matches B
and B matches C, they are one house — even when A and C do not resemble each
other, which happens constantly: one agency omits the lot size, another rounds
the price, a third publishes interior area where the rest publish total built
area.

The fixture includes exactly this case and the test suite pins it:

| Pair | Price gap | Area gap | Direct match? |
|---|---|---|---|
| T1 ↔ T2 | 10.1% | 14.3% | yes |
| T2 ↔ T3 | 9.6% | 14.6% | yes |
| **T1 ↔ T3** | **18.8%** | **26.8%** | **no** |

T1 and T3 never pair directly. They are one property because T2 bridges them.
Pairwise matching returns overlapping pairs and no answer to *how many houses
are there*; connected components answer it directly.

### The similarity function

Deliberately asymmetric. Bedrooms gate; everything else votes.

| Field | Rule | On mismatch |
|---|---|---|
| `bedrooms` | Exact | **Rejects immediately** |
| `price_usd` | Within ±15% | Vetoes the match |
| `sqm` | Within ±20% | Vetoes the match |
| `lot_sqm` | Within ±20% | Ignored |
| `bathrooms` | Exact | Ignored |

A pair matches on **≥2 fields agreeing and 0 disagreeing**.

Bedrooms are a hard gate because agencies disagree about area and price
constantly, but a 3-bedroom and a 4-bedroom are not the same house — treating
that as one vote among several merges genuinely distinct properties. The
fixture carries a pair that agrees on price, bathrooms, area *and* lot and is
still correctly kept apart, and a test asserts that reconciling only the
bedroom count makes them match, proving the rejection came from the gate and
nothing else.

Bathrooms and lot area vote but never veto: half-baths are counted
inconsistently, and lot figures are often copied from an outdated *plano*.

Same-agency pairs are never compared. One agency listing a house twice is a
crawl bug, and counting it as a cross-source duplicate would inflate the
"open listing" number that the product is built on.

Full reasoning, including what would falsify these choices:
**[docs/MATCHING.md](docs/MATCHING.md)**.

---

## The honest gap

**The tolerances are judgement, not measurement.** ±15%, ±20%, two-field
minimum — those came from looking at data, not from optimising against labelled
ground truth. I cannot tell you this matcher's precision or recall, because no
labelled set exists yet.

That is the most important open problem in the repository, and
[docs/MATCHING.md](docs/MATCHING.md) sets out what it would take to close it.
Every threshold is a named exported constant at the top of `src/lib/matcher.ts`,
so the tuning surface is already there when the ground truth is.

The comparison is also `O(n²)`. At roughly 500 listings that is a few hundred
thousand comparisons and finishes in milliseconds. Blocking would be correct at
100k listings and premature here — and any blocking scheme has to be validated
against an accuracy measurement that does not exist yet, so it would be
optimising the wrong thing first.

---

## About the scrapers

The production pipeline runs nine source adapters, one per agency operating in
Nosara. **They are not in this repository.** They encode the DOM structure of
named businesses I compete with as a working agent in the same market, and
publishing them is a commercial and legal question with no engineering content
in it.

What is here is the part that carries the engineering:
[`src/scrapers/example-agency.ts`](src/scrapers/example-agency.ts), a fully
documented reference adapter running against a checked-in HTML fixture. It
demonstrates the whole contract — every adapter returns `ScrapedListing[]` and
nothing else couples a source to the pipeline, so adding an agency means
writing one of these and changing nothing else.

The fixture is built to contain what actually makes scraping hard, and
`npm run demo:scrape` shows the normalizer handling it:

| Input | Output |
|---|---|
| `$1,250,000` · `USD 890.000` · `395000` | `1250000` · `890000` · `395000` |
| `1,884 sq ft` | `175 m²` |
| `0.25 acres` · `2.1 acres` | `1012 m²` · `8498 m²` |
| Same card repeated by pagination | dropped on `sourceId` |

Comparing raw strings across sources is the single easiest way to get this
wrong, which is why normalisation happens at the source boundary and never
in the matcher.

---

## Layout

```
src/lib/matcher.ts          the core — union-find, similarity, canonical pick
src/lib/types.ts            the contract every source adapter satisfies
src/lib/normalizer.ts       price/area/type parsing at the source boundary
src/scrapers/               one documented reference adapter
fixtures/                   HTML page + 9 annotated listings
scripts/demo-match.ts       entity resolution demo
scripts/demo-scrape.ts      scraper contract demo
tests/matcher.test.ts       9 behavioural tests
supabase/schema.sql         the listings + groups schema
docs/MATCHING.md            design reasoning and the open accuracy problem
```

The matcher is a pure function of its input. The Supabase-backed entry point in
the production repo fetches and then calls it; keeping the algorithm free of
I/O is what makes it testable against fixtures at all.

---

## Status

Portfolio extract of a working system. The full pipeline — nine adapters, the
Supabase warehouse, the Next.js app and the referral system — runs privately.
This repository is the part that is interesting to read and safe to publish.

MIT licensed. See [LICENSE](LICENSE).
