"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishGuildDescription = publishGuildDescription;
exports.publishChannelGuides = publishChannelGuides;
exports.publishRolePanels = publishRolePanels;
exports.publishFaq = publishFaq;
exports.summarisePublishing = summarisePublishing;
const discord_js_1 = require("discord.js");
const branding_1 = require("../config/branding");
const channelGuides_1 = require("../config/channelGuides");
const faq_1 = require("../config/faq");
const server_1 = require("../config/server");
const format_1 = require("../utils/format");
const logger_1 = require("./logger");
const mentions_1 = require("./mentions");
const resolve_1 = require("./resolve");
const state_1 = require("./state");
const selfRoleService_1 = require("./selfRoleService");
const tickets_1 = require("./tickets");
/** The server's own description, shown in the discovery/invite card. */
async function publishGuildDescription(guild, dryRun) {
    const description = 'An international trading community built on research, process and execution. ' +
        'No signals, no guarantees, no shortcuts. English first, with a dedicated Italian section.';
    if (!guild.features.includes('COMMUNITY')) {
        return { key: 'guild-description', status: 'skipped', detail: 'requires Community mode' };
    }
    if (!guild.members.me?.permissions.has(discord_js_1.PermissionFlagsBits.ManageGuild)) {
        return {
            key: 'guild-description',
            status: 'skipped',
            detail: 'I need the Manage Server permission',
        };
    }
    if (guild.description === description) {
        return { key: 'guild-description', status: 'unchanged' };
    }
    if (dryRun) {
        return { key: 'guild-description', status: 'updated', detail: 'would be set' };
    }
    try {
        await guild.edit({ description, reason: 'THE DESK server profile' });
        logger_1.logger.info('SETUP', 'Updated the server description');
        return { key: 'guild-description', status: 'updated' };
    }
    catch {
        return { key: 'guild-description', status: 'failed', detail: 'Discord rejected the change' };
    }
}
/** One pinned card per channel that defines a guide. */
async function publishChannelGuides(guild, dryRun) {
    const results = [];
    for (const { channel: definition } of (0, server_1.allChannels)()) {
        const guide = channelGuides_1.CHANNEL_GUIDES[definition.key];
        if (!guide)
            continue;
        const live = (0, resolve_1.findChannel)(guild, definition.key);
        if (!live) {
            results.push({ key: definition.key, status: 'skipped', detail: 'channel missing' });
            continue;
        }
        const embed = guideEmbed(definition.name, guide);
        // The ticket channel's card carries the button, so it doubles as the panel.
        const isTicketChannel = definition.key === server_1.SERVER.ticketChannelKey;
        const panel = isTicketChannel ? (0, tickets_1.ticketPanel)() : null;
        try {
            if (live.type === discord_js_1.ChannelType.GuildForum) {
                results.push(await publishForumGuide(live, definition.key, embed, dryRun));
            }
            else if (live.type === discord_js_1.ChannelType.GuildText || live.type === discord_js_1.ChannelType.GuildAnnouncement) {
                results.push(await publishMessage(guild, definition.key, `guide:${definition.key}`, panel ? panel.embeds : [embed], panel ? panel.components : [], dryRun));
            }
            else {
                results.push({ key: definition.key, status: 'skipped', detail: 'not a postable channel' });
            }
        }
        catch (error) {
            logger_1.logger.error('SETUP', `Could not publish the guide for ${definition.name}`, error);
            results.push({ key: definition.key, status: 'failed' });
        }
    }
    return results;
}
/** The self-assignable role menus. */
async function publishRolePanels(guild, dryRun) {
    const results = [];
    for (const panel of (0, selfRoleService_1.rolePanels)()) {
        results.push(await publishMessage(guild, server_1.SERVER.rolesChannelKey, panel.key, panel.embeds, panel.components, dryRun));
    }
    return results;
}
/** The FAQ, as pinned embeds in #faq — one per section. */
async function publishFaq(guild, dryRun) {
    const results = [];
    const header = new discord_js_1.EmbedBuilder()
        .setColor(branding_1.COLORS.primary)
        .setTitle(`${branding_1.BRAND.name} — FAQ`)
        .setDescription('The questions that come up most, answered once. Run `/faq` to search them, or open a ticket if yours is not here.')
        .setFooter({ text: branding_1.BRAND.footer });
    results.push(await publishMessage(guild, server_1.SERVER.faqChannelKey, 'faq:header', [header], [], dryRun));
    for (const section of (0, faq_1.faqSections)()) {
        const entries = faq_1.FAQ.filter((entry) => entry.section === section);
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(branding_1.COLORS.neutral)
            .setTitle(section.toUpperCase())
            .addFields(entries.map((entry) => ({
            name: (0, format_1.truncate)(entry.question, 256),
            value: (0, format_1.truncate)(entry.answer, format_1.EMBED_FIELD_LIMIT),
        })));
        results.push(await publishMessage(guild, server_1.SERVER.faqChannelKey, `faq:${slug(section)}`, [embed], [], dryRun));
    }
    return results;
}
/* ── Internals ─────────────────────────────────────────────── */
function guideEmbed(channelName, guide) {
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(branding_1.COLORS.neutral)
        .setTitle(channelName.replace(/^[^\w]+/u, '').toUpperCase())
        .setDescription((0, format_1.truncate)(guide.headline, format_1.EMBED_DESCRIPTION_LIMIT));
    if (guide.belongs.length > 0) {
        embed.addFields({
            name: 'WHAT BELONGS HERE',
            value: (0, format_1.truncate)(guide.belongs.map((line) => `• ${line}`).join('\n'), format_1.EMBED_FIELD_LIMIT),
        });
    }
    if (guide.avoid && guide.avoid.length > 0) {
        embed.addFields({
            name: 'WHAT DOES NOT',
            value: (0, format_1.truncate)(guide.avoid.map((line) => `• ${line}`).join('\n'), format_1.EMBED_FIELD_LIMIT),
        });
    }
    if (guide.standard) {
        embed.addFields({ name: 'STANDARD', value: (0, format_1.truncate)(guide.standard, format_1.EMBED_FIELD_LIMIT) });
    }
    return embed.setFooter({ text: branding_1.BRAND.footer });
}
/**
 * Publish or refresh a single bot-owned message, remembered by key.
 * A message deleted by hand is simply reposted on the next run.
 */
async function publishMessage(guild, channelKey, messageKey, embeds, components, dryRun) {
    const channel = (0, resolve_1.findTextChannel)(guild, channelKey);
    if (!channel)
        return { key: messageKey, status: 'skipped', detail: `#${channelKey} is missing` };
    const remembered = state_1.state.message(messageKey);
    const existing = remembered && remembered.channelId === channel.id
        ? await channel.messages.fetch(remembered.messageId).catch(() => null)
        : null;
    if (dryRun) {
        return { key: messageKey, status: existing ? 'unchanged' : 'created', detail: `#${channel.name}` };
    }
    // {{#channel}} and {{@role}} placeholders become real links only now, when
    // the ids exist. See services/mentions.ts.
    const linked = resolveEmbeds(embeds, guild);
    if (existing) {
        await existing.edit({ embeds: linked, components });
        return { key: messageKey, status: 'updated' };
    }
    const sent = await channel.send({ embeds: linked, components });
    state_1.state.rememberMessage(messageKey, channel.id, sent.id);
    await sent.pin().catch(() => undefined);
    logger_1.logger.info('SETUP', `Published ${messageKey} to #${channel.name}`);
    return { key: messageKey, status: 'created' };
}
/**
 * A forum has no message list, so its card is the first post — created once,
 * then pinned and edited in place.
 */
async function publishForumGuide(forum, channelKey, embed, dryRun) {
    const messageKey = `guide:${channelKey}`;
    const remembered = state_1.state.message(messageKey);
    if (remembered) {
        const thread = await forum.threads.fetch(remembered.channelId).catch(() => null);
        const starter = thread ? await thread.fetchStarterMessage().catch(() => null) : null;
        if (starter) {
            if (dryRun)
                return { key: messageKey, status: 'unchanged' };
            await starter.edit({ embeds: [embed] });
            return { key: messageKey, status: 'updated' };
        }
    }
    if (dryRun)
        return { key: messageKey, status: 'created', detail: 'would open a pinned post' };
    const post = await forum.threads.create({
        name: 'How this channel works',
        message: { embeds: [embed] },
        reason: 'Channel guide',
    });
    await post.pin().catch(() => undefined);
    const starter = await post.fetchStarterMessage().catch(() => null);
    state_1.state.rememberMessage(messageKey, post.id, starter?.id ?? post.id);
    logger_1.logger.info('SETUP', `Published the guide post in ${forum.name}`);
    return { key: messageKey, status: 'created' };
}
function slug(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}
/** Convenience for the setup report: collapse many results into counts. */
function summarisePublishing(results) {
    const counts = new Map();
    for (const result of results)
        counts.set(result.status, (counts.get(result.status) ?? 0) + 1);
    return ((0, format_1.chunkLines)([...counts.entries()].map(([status, count]) => `${count} ${status}`), 200)[0] ?? '—');
}
/** Resolve `{{#channel}}` / `{{@role}}` placeholders inside built embeds. */
function resolveEmbeds(embeds, guild) {
    return embeds.map((embed) => discord_js_1.EmbedBuilder.from((0, mentions_1.resolveDeep)(embed.toJSON(), guild)));
}
//# sourceMappingURL=publishing.js.map