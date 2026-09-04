import { EmbedBuilder, type Guild } from 'discord.js';
import { BRAND, COLORS } from '../config/branding';
import { NEWS, NEWS_FEEDS, type NewsFeed } from '../config/news';
import { SERVER } from '../config/server';
import { describeError } from '../utils/errors';
import { truncate } from '../utils/format';
import { logger } from './logger';
import { findTextChannel } from './resolve';

/* ────────────────────────────────────────────────────────────
 * The daily digest
 *
 * Fetches the configured RSS feeds, keeps what was published in the lookback
 * window, and posts one message: a monospace table, newest last, so the
 * channel reads as a log rather than a stream of link previews.
 *
 * Feed content is untrusted input from the open internet. Two consequences
 * that are enforced below and must stay enforced:
 *   - every headline is stripped of markup and mention syntax;
 *   - the message is sent with allowedMentions disabled, so a headline
 *     containing "@everyone" cannot ping the server.
 * ──────────────────────────────────────────────────────────── */

export interface NewsItem {
  feed: NewsFeed;
  title: string;
  link: string;
  publishedAt: Date;
}

export async function buildDigest(): Promise<{ items: NewsItem[]; failures: string[] }> {
  const cutoff = Date.now() - NEWS.lookbackHours * 60 * 60 * 1000;
  const items: NewsItem[] = [];
  const failures: string[] = [];

  const results = await Promise.allSettled(NEWS_FEEDS.map((feed) => fetchFeed(feed)));

  for (const [index, result] of results.entries()) {
    const feed = NEWS_FEEDS[index];
    if (!feed) continue;
    if (result.status === 'rejected') {
      failures.push(feed.label);
      logger.warn('EVENT', `News feed ${feed.label} failed`, { discord: false });
      continue;
    }
    items.push(...result.value.filter((item) => item.publishedAt.getTime() >= cutoff));
  }

  items.sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());
  return { items: items.slice(-NEWS.maxItems), failures };
}

/** Posts the digest. Returns null when there was nothing to say. */
export async function postDigest(guild: Guild): Promise<string | null> {
  const channel = findTextChannel(guild, SERVER.newsChannelKey);
  if (!channel) {
    logger.warn('EVENT', 'No news channel — run /setup.');
    return null;
  }

  const { items, failures } = await buildDigest();

  const embed = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(`MARKET DIGEST — ${new Date().toISOString().slice(0, 10)}`)
    .setDescription(
      items.length === 0
        ? 'Nothing published by the tracked sources in the last 24 hours.'
        : table(items),
    )
    .setFooter({
      text:
        `${BRAND.footer} · ${NEWS_FEEDS.map((feed) => feed.label).join(' · ')}` +
        (failures.length > 0 ? ` · unreachable: ${failures.join(', ')}` : ''),
    })
    .setTimestamp(new Date());

  const message = await channel.send({
    embeds: [embed],
    // A headline is untrusted text. It must never be able to ping anyone.
    allowedMentions: { parse: [] },
  });

  if (NEWS.openThread && items.length > 0) {
    await message
      .startThread({
        name: truncate(`Digest — ${new Date().toISOString().slice(0, 10)}`, 100),
        autoArchiveDuration: 1440,
        reason: 'Discussion thread for the daily digest',
      })
      .catch(() => undefined);
  }

  logger.info('EVENT', `Posted the market digest (${items.length} items)`);
  return message.url;
}

/**
 * A fixed-width table. Discord has no table markup, so a code block is the
 * only way to get columns that line up on every client.
 */
function table(items: NewsItem[]): string {
  const rows = items.map((item) => {
    const time = item.publishedAt.toISOString().slice(5, 16).replace('T', ' ');
    return `${time}  ${item.feed.label.padEnd(4)}  ${truncate(item.title, 62)}`;
  });

  const header = `${'DATE  TIME'.padEnd(11)}  ${'SRC'.padEnd(4)}  HEADLINE`;
  const divider = '─'.repeat(80);

  return ['```', header, divider, ...rows, '```'].join('\n');
}

/* ── Feed fetching and parsing ─────────────────────────────── */

async function fetchFeed(feed: NewsFeed): Promise<NewsItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NEWS.timeoutMs);

  try {
    const response = await fetch(feed.url, {
      signal: controller.signal,
      headers: { 'user-agent': 'THE-DESK-bot/1.0 (Discord community digest)' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parseFeed(await response.text(), feed);
  } catch (error) {
    logger.debug('EVENT', `Feed ${feed.key}: ${describeError(error)}`, { discord: false });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A deliberately small RSS/Atom reader.
 *
 * This handles the two shapes the configured feeds actually use — `<item>`
 * with `<pubDate>` and `<entry>` with `<updated>` — and nothing else. It is
 * not a general XML parser and does not pretend to be one; the alternative
 * was a dependency to read five well-formed government feeds.
 *
 * If you add a feed that this cannot read, it fails closed: that feed is
 * reported as unreachable in the digest footer and the others still post.
 */
export function parseFeed(xml: string, feed: NewsFeed): NewsItem[] {
  const blocks = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/g)].map((match) => match[0]);
  const items: NewsItem[] = [];

  for (const block of blocks) {
    const title = clean(tag(block, 'title'));
    if (!title) continue;

    const link = tag(block, 'link') || attribute(block, 'link', 'href') || '';
    const raw = tag(block, 'pubDate') || tag(block, 'updated') || tag(block, 'published');
    const publishedAt = raw ? new Date(raw) : new Date(NaN);
    if (Number.isNaN(publishedAt.getTime())) continue;

    items.push({ feed, title, link: clean(link), publishedAt });
  }

  return items;
}

function tag(block: string, name: string): string {
  const match = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(block);
  return match?.[1]?.trim() ?? '';
}

function attribute(block: string, name: string, attr: string): string {
  const match = new RegExp(`<${name}[^>]*\\b${attr}="([^"]*)"`).exec(block);
  return match?.[1] ?? '';
}

/**
 * Strip CDATA, entities, HTML and anything Discord would interpret.
 *
 * The backtick removal matters more than it looks: the table is rendered
 * inside a code fence, and a headline containing one would break out of it.
 */
function clean(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/[`@]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
