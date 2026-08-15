export type SourceAgency =
  | 'remax'
  | 'century21'
  | 'two_costa_rica'
  | 'tropicasa'
  | 'wanderlust'
  | 'bluezone'
  | 'mango'
  | 'sothebys'
  | 'coldwell';

export type PropertyTypeValue =
  | 'house'
  | 'condo'
  | 'villa'
  | 'lot'
  | 'penthouse'
  | 'commercial'
  | 'farm'
  | 'other';

/** Normalized shape every scraper must return */
export interface ScrapedListing {
  source: SourceAgency;
  sourceId: string;
  sourceUrl: string;
  title: string | null;
  location: string | null;
  priceUsd: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqm: number | null;
  lotSqm: number | null;
  propertyType: PropertyTypeValue;
  description: string | null;
  imageUrls: string[];
  amenities: string[];
  rawData: Record<string, unknown>;
}

/** Contract every scraper module must satisfy */
export interface Scraper {
  source: SourceAgency;
  scrape(): Promise<ScrapedListing[]>;
}

/** DB row shape fetched by the matcher */
export interface DBListing {
  id: string;
  source: string;
  title: string | null;
  location: string | null;
  price_usd: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqm: number | null;
  lot_sqm: number | null;
  property_type: string;
  image_urls: string[];
}

/** Output of the matcher for one group */
export interface MatchGroup {
  listingIds: string[];
  canonicalTitle: string;
  canonicalPrice: number | null;
  canonicalLocation: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqm: number | null;
  lotSqm: number | null;
  propertyType: PropertyTypeValue;
  primaryImageUrl: string | null;
  sourceCount: number;
  isOpenListing: boolean;
}
