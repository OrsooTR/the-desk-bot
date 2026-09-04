"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDigest = buildDigest;
exports.postDigest = postDigest;
exports.parseFeed = parseFeed;
const discord_js_1 = require("discord.js");
const branding_1 = require("../config/branding");
const news_1 = require("../config/news");
const server_1 = require("../config/server");
const errors_1 = require("../utils/errors");
const format_1 = require("../utils/format");
const logger_1 = require("./logger");
const resolve_1 = require("./resolve");
async function buildDigest() {
    const cutoff = Date.now() - news_1.NEWS.lookbackHours * 60 * 60 * 1000;
    const items = [];
    const failures = [];
    const results = await Promise.allSettled(news_1.NEWS_FEEDS.map((feed) => fetchFeed(feed)));
    for (const [index, result] of results.entries()) {
        const feed = news_1.NEWS_FEEDS[index];
        if (!feed)
            continue;
        if (result.status === 'rejected') {
            failures.push(feed.label);
            logger_1.logger.warn('EVENT', `News feed ${feed.label} failed`, { discord: false });
            continue;
        }
        items.push(...result.value.filter((item) => item.publishedAt.getTime() >= cutoff));
    }
    items.sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());
    return { items: items.slice(-news_1.NEWS.maxItems), failures };
}
/** Posts the digest. Returns null when there was nothing to say. */
async function postDigest(guild) {
    const channel = (0, resolve_1.findTextChannel)(guild, server_1.SERVER.newsChannelKey);
    if (!channel) {
        logger_1.logger.warn('EVENT', 'No news channel — run /setup.');
        return null;
    }
    const { items, failures } = await buildDigest();
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(branding_1.COLORS.primary)
        .setTitle(`MARKET DIGEST — ${new Date().toISOString().slice(0, 10)}`)
        .setDescription(items.length === 0
        ? 'Nothing published by the tracked sources in the last 24 hours.'
        : table(items))
        .setFooter({
        text: `${branding_1.BRAND.footer} · ${news_1.NEWS_FEEDS.map((feed) => feed.label).join(' · ')}` +
            (failures.length > 0 ? ` · unreachable: ${failures.join(', ')}` : ''),
    })
        .setTimestamp(new Date());
    const message = await channel.send({
        embeds: [embed],
        // A headline is untrusted text. It must never be able to ping anyone.
        allowedMentions: { parse: [] },
    });
    if (news_1.NEWS.openThread && items.length > 0) {
        await message
            .startThread({
            name: (0, format_1.truncate)(`Digest — ${new Date().toISOString().slice(0, 10)}`, 100),
            autoArchiveDuration: 1440,
            reason: 'Discussion thread for the daily digest',
        })
            .catch(() => undefined);
    }
    logger_1.logger.info('EVENT', `Posted the market digest (${items.length} items)`);
    return message.url;
}
/**
 * A fixed-width table. Discord has no table markup, so a code block is the
 * only way to get columns that line up on every client.
 */
function table(items) {
    const rows = items.map((item) => {
        const time = item.publishedAt.toISOString().slice(5, 16).replace('T', ' ');
        return `${time}  ${item.feed.label.padEnd(4)}  ${(0, format_1.truncate)(item.title, 62)}`;
    });
    const header = `${'DATE  TIME'.padEnd(11)}  ${'SRC'.padEnd(4)}  HEADLINE`;
    const divider = '─'.repeat(80);
    return ['```', header, divider, ...rows, '```'].join('\n');
}
/* ── Feed fetching and parsing ─────────────────────────────── */
async function fetchFeed(feed) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), news_1.NEWS.timeoutMs);
    try {
        const response = await fetch(feed.url, {
            signal: controller.signal,
            headers: { 'user-agent': 'THE-DESK-bot/1.0 (Discord community digest)' },
        });
        if (!response.ok)
            throw new Error(`HTTP ${response.status}`);
        return parseFeed(await response.text(), feed);
    }
    catch (error) {
        logger_1.logger.debug('EVENT', `Feed ${feed.key}: ${(0, errors_1.describeError)(error)}`, { discord: false });
        throw error;
    }
    finally {
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
function parseFeed(xml, feed) {
    const blocks = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/g)].map((match) => match[0]);
    const items = [];
    for (const block of blocks) {
        const title = clean(tag(block, 'title'));
        if (!title)
            continue;
        const link = tag(block, 'link') || attribute(block, 'link', 'href') || '';
        const raw = tag(block, 'pubDate') || tag(block, 'updated') || tag(block, 'published');
        const publishedAt = raw ? new Date(raw) : new Date(NaN);
        if (Number.isNaN(publishedAt.getTime()))
            continue;
        items.push({ feed, title, link: clean(link), publishedAt });
    }
    return items;
}
function tag(block, name) {
    const match = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(block);
    return match?.[1]?.trim() ?? '';
}
function attribute(block, name, attr) {
    const match = new RegExp(`<${name}[^>]*\\b${attr}="([^"]*)"`).exec(block);
    return match?.[1] ?? '';
}
/**
 * Strip CDATA, entities, HTML and anything Discord would interpret.
 *
 * The backtick removal matters more than it looks: the table is rendered
 * inside a code fence, and a headline containing one would break out of it.
 */
function clean(value) {
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
//# sourceMappingURL=news.js.map