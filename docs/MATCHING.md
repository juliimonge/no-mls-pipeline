# Matching: design reasoning and the open problem

Why the similarity function looks the way it does, and what would have to be
true for me to defend the numbers in it rather than merely assert them.

## The shape of the data

Nine agencies publish overlapping inventory with no shared identifier. What
they publish about the same house differs in ways that are systematic, not
random:

| Disagreement | Why it happens |
|---|---|
| Price differs by a few percent | Agencies negotiate their own asking price, and refresh at different times |
| Construction area differs by 10–25% | Some publish interior area, others include covered terrace or total built |
| Lot area is missing or stale | Copied from a *plano* that may predate a segregation |
| Bathroom count differs by 0.5 | Half-baths counted inconsistently |
| Titles share no vocabulary | "Ocean-view villa" / "Casa con vista al mar" / the property's given name |
| Location is a neighbourhood, not an address | Guiones, Pelada, Esperanza — no street numbers exist in most of Nosara |

Two consequences follow directly. **Text similarity is close to useless here**
— titles are marketing copy in two languages with no shared tokens, and there
is no address to normalise. And **every quantitative field needs a tolerance
band rather than equality**, because exact agreement between two agencies is
the exception.

## Why bedrooms gate and nothing else does

Every field except bedrooms is a *measurement* that agencies take differently.
Bedroom count is a *fact about the building* that is hard to get wrong and
rarely disputed.

That asymmetry is the whole design. If bedrooms were one vote among several, a
3-bedroom and a 4-bedroom in the same neighbourhood at similar prices would
merge on price + bathrooms + area — three votes, zero disagreements. The
fixture contains exactly that pair (`B1`, `B2`), and `npm test` asserts both
that they stay apart and that reconciling *only* the bedroom count makes them
match. The second assertion is the one that matters: it proves the rejection
came from the gate rather than from some incidental disagreement.

Bathrooms and lot area vote in favour but never veto, because their failure
modes are known and one-directional — a half-bath discrepancy or a stale
*plano* should not break a match that price, bedrooms and area all support.

## Why Union-Find

Duplication is transitive and the tolerance bands make intransitive pairs
common: A and B agree within tolerance, B and C agree within tolerance, and A
and C are two tolerance-widths apart. All three are one house.

A pairwise matcher produces a set of overlapping pairs and cannot answer *how
many distinct properties are there*, which is the only question the product
asks. Connected components answer it directly, and the union operation is
effectively constant time, so the structure costs nothing over the comparison
that dominates anyway.

The demo and the test suite both pin a real instance (`T1`, `T2`, `T3`) where
the endpoints are 18.8% apart on price and 26.8% on area — outside both bands —
and are correctly resolved as one property through the bridge.

## Canonical selection

The representative record is the most *complete* one, scored on field presence
and image count. Not the cheapest, not the most expensive, not the first
crawled, and explicitly not ranked by agency — the product's claim is a neutral
view of the market, and preferring one agency's record would quietly encode a
commercial preference into it.

## The open problem: no measured accuracy

**The thresholds are hand-tuned against observed data. There is no labelled
ground truth, so precision and recall are unknown.**

That is the honest state of it, and it is the first thing I would fix.

### What closing it looks like

1. **Build the labelled set.** Sample a few hundred cross-agency pairs,
   stratified so it is not dominated by obvious non-matches — some near-miss
   pairs, some sparse-record pairs, some genuinely ambiguous. Label each by
   hand, which for Nosara means recognising the house, usually from photos.
2. **Measure the current function** against it. Precision and recall
   separately, because the costs are not symmetric (below).
3. **Sweep the thresholds** rather than reasoning about them. Three parameters
   is a small enough space to grid-search exhaustively.
4. **Only then consider blocking.** Any candidate-generation scheme changes
   recall, and without step 2 there is no way to tell whether it broke
   anything.

### The costs are asymmetric

A **false merge** shows a user one property when there are two, with a price
that belongs to neither — a visibly wrong listing.

A **false split** shows the same house twice and fails to flag it as an open
listing, which is the product's whole value proposition. It looks like ordinary
duplication, so nobody reports it.

False splits are worse *and* quieter, which argues for looser tolerances than
intuition suggests. I would want that trade priced against real labels before
moving anything, which is exactly why the constants are exported and named
rather than inlined.

### What I would not do

Reach for embeddings on the title text. It is bilingual marketing copy with no
shared vocabulary between agencies describing the same house, and it would add
a model dependency and a plausible-looking similarity score with no measured
gain over the structured fields. Photo hashing is the far more promising signal
— agencies frequently reuse the owner's photographs — and it would be the first
thing I tested after the labelled set exists.
