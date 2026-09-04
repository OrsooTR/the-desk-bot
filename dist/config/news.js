"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.NEWS = exports.NEWS_FEEDS = void 0;
exports.NEWS_FEEDS = [
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
exports.NEWS = {
    enabled: true,
    // 06:30 UTC: after the Asian session, before the European open.
    postAtUtc: { hour: 6, minute: 30 },
    lookbackHours: 24,
    maxItems: 18,
    timeoutMs: 8000,
    openThread: true,
};
//# sourceMappingURL=news.js.map