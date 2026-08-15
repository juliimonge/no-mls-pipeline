-- ============================================================
-- Nosara Open Listings Database — Supabase Schema
-- Run this entire file once in the Supabase SQL editor
-- ============================================================

-- property_groups must be created FIRST because raw_listings FK references it
CREATE TABLE property_groups (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_title   TEXT NOT NULL,
  canonical_price   NUMERIC(12, 2),
  canonical_location TEXT,
  bedrooms          SMALLINT,
  bathrooms         SMALLINT,
  sqm               NUMERIC(10, 2),
  lot_sqm           INTEGER,
  property_type     TEXT NOT NULL DEFAULT 'other',
  primary_image_url TEXT,
  source_count      SMALLINT NOT NULL DEFAULT 1,
  is_open_listing   BOOLEAN NOT NULL DEFAULT false,
  first_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE raw_listings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source        TEXT NOT NULL,
  source_id     TEXT NOT NULL,
  source_url    TEXT NOT NULL,
  title         TEXT,
  location      TEXT,
  price_usd     NUMERIC(12, 2),
  bedrooms      SMALLINT,
  bathrooms     SMALLINT,
  sqm           INTEGER,
  lot_sqm       INTEGER,
  property_type TEXT NOT NULL DEFAULT 'other',
  description   TEXT,
  image_urls    TEXT[] DEFAULT '{}',
  amenities     TEXT[] DEFAULT '{}',
  raw_data      JSONB DEFAULT '{}',
  group_id      UUID REFERENCES property_groups(id) ON DELETE SET NULL,
  scraped_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, source_id)
);

-- Indexes
CREATE INDEX idx_raw_listings_source     ON raw_listings(source);
CREATE INDEX idx_raw_listings_group_id   ON raw_listings(group_id);
CREATE INDEX idx_raw_listings_price      ON raw_listings(price_usd);
CREATE INDEX idx_raw_listings_scraped_at ON raw_listings(scraped_at DESC);

CREATE INDEX idx_groups_is_open      ON property_groups(is_open_listing);
CREATE INDEX idx_groups_price        ON property_groups(canonical_price);
CREATE INDEX idx_groups_source_count ON property_groups(source_count DESC);
CREATE INDEX idx_groups_type         ON property_groups(property_type);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_raw_listings
  BEFORE UPDATE ON raw_listings
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_property_groups
  BEFORE UPDATE ON property_groups
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Row Level Security
-- Anon key (Next.js frontend) can only SELECT.
-- Service key (scraper scripts) bypasses RLS entirely.
ALTER TABLE raw_listings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read raw_listings"
  ON raw_listings FOR SELECT USING (true);

CREATE POLICY "Public read property_groups"
  ON property_groups FOR SELECT USING (true);
