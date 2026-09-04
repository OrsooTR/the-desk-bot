/**
 * The daily market digest.
 *
 * Sources are deliberately primary: central banks and national statistics
 * offices publish the releases that actually move a market, they publish them
 * on stable RSS endpoints, they are free, they need no API key, and they do
 * not editorialise. A financial-media feed would be higher volume and lower
 * information — which is precisely the "news spam channel" the server is
 * supposed not to have.
 *
 * Add a feed by adding a line. Nothing else changes.
 */

export interface NewsFeed {
  key: string;
  /** Short label used in the digest table. Keep it under ~10 characters. */
  label: string;
  url: string;
  /** Shown in the digest footer as an attribution. */
  publisher: string;
}

export const NEWS_FEEDS: NewsFeed[] = [
  {
    key: 'fed',
    label: 'FED',
    url: 'https://www.federalreserve.gov/feeds/press_all.xml',
    publisher: 'Federal Reserve',
  },
  {
    key: 'ecb',
    label: 'ECB',
    url: 'https://www.ecb.europa.eu/rss/press.html',
    publisher: 'European Central Bank',
  },
  {
    key: 'bls',
    label: 'BLS',
    url: 'https://www.bls.gov/feed/bls_latest.rss',
    publisher: 'US Bureau of Labor Statistics',
  },
  {
    key: 'boe',
    label: 'BOE',
    url: 'https://www.bankofengland.co.uk/rss/news',
    publisher: 'Bank of England',
  },
  {
    key: 'sec',
    label: 'SEC',
    url: 'https://www.sec.gov/news/pressreleases.rss',
    publisher: 'US Securities and Exchange Commission',
  },
];

/*
 * Every URL above was probed before being committed: each returns HTTP 200 and
 * parseable items. Two obvious candidates were dropped for failing that test —
 * the US Treasury press feed times out, and the BEA endpoint 404s. If you add
 * a feed, probe it first; a silently dead source is worse than an absent one
 * because the digest still looks complete.
 */

export interface NewsConfig {
  /** Master switch for the scheduled digest. */
  enabled: boolean;
  /** UTC hour and minute the digest is posted. */
  postAtUtc: { hour: number; minute: number };
  /** Only include items published within this many hours. */
  lookbackHours: number;
  /** Hard cap on rows in the table, so the message always fits. */
  maxItems: number;
  /** Per-feed request timeout. */
  timeoutMs: number;
  /** Open a discussion thread under each digest. */
  openThread: boolean;
}

export const NEWS: NewsConfig = {
  enabled: true,
  // 06:30 UTC: after the Asian session, before the European open.
  postAtUtc: { hour: 6, minute: 30 },
  lookbackHours: 24,
  maxItems: 18,
  timeoutMs: 8000,
  openThread: true,
};
