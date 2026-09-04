"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishCommunityContent = publishCommunityContent;
exports.welcomeEmbeds = welcomeEmbeds;
exports.rulesEmbeds = rulesEmbeds;
exports.verificationRow = verificationRow;
const discord_js_1 = require("discord.js");
const branding_1 = require("../config/branding");
const content_1 = require("../config/content");
const server_1 = require("../config/server");
const format_1 = require("../utils/format");
const logger_1 = require("./logger");
const mentions_1 = require("./mentions");
const resolve_1 = require("./resolve");
const state_1 = require("./state");
/**
 * Publishes the welcome brief and the rules.
 *
 * Idempotent by message ID: on a second run the existing message is edited in
 * place, so pins, links and the verification button all survive. A message
 * that has been deleted by hand is simply reposted.
 */
async function publishCommunityContent(guild, dryRun) {
    const results = [];
    results.push(await publish(guild, server_1.SERVER.welcomeChannelKey, 'welcome-message', dryRun, () => ({
        embeds: welcomeEmbeds(),
        components: [],
    })));
    results.push(await publish(guild, server_1.SERVER.rulesChannelKey, 'rules-message', dryRun, () => ({
        embeds: rulesEmbeds(),
        components: [verificationRow()],
    })));
    return results;
}
async function publish(guild, channelKey, messageKey, dryRun, build) {
    const channel = (0, resolve_1.findTextChannel)(guild, channelKey);
    if (!channel) {
        return {
            key: messageKey,
            status: 'skipped',
            detail: `#${channelKey} does not exist yet.`,
        };
    }
    const remembered = state_1.state.message(messageKey);
    const existing = remembered && remembered.channelId === channel.id
        ? await channel.messages.fetch(remembered.messageId).catch(() => null)
        : null;
    if (dryRun) {
        return {
            key: messageKey,
            status: existing ? 'updated' : 'created',
            detail: existing ? `would refresh the message in #${channel.name}` : `would post to #${channel.name}`,
        };
    }
    const payload = build();
    const linked = payload.embeds.map((embed) => discord_js_1.EmbedBuilder.from((0, mentions_1.resolveDeep)(embed.toJSON(), guild)));
    if (existing) {
        await existing.edit({ embeds: linked, components: payload.components });
        logger_1.logger.info('SETUP', `Refreshed ${messageKey} in #${channel.name}`);
        return { key: messageKey, status: 'updated' };
    }
    const sent = await channel.send({ embeds: linked, components: payload.components });
    state_1.state.rememberMessage(messageKey, channel.id, sent.id);
    await pinQuietly(channel, sent.id);
    logger_1.logger.info('SETUP', `Published ${messageKey} to #${channel.name}`);
    return { key: messageKey, status: 'created' };
}
/** Pinning is a nicety; a missing Manage Messages permission must not fail setup. */
async function pinQuietly(channel, messageId) {
    try {
        const message = await channel.messages.fetch(messageId);
        await message.pin();
    }
    catch {
        logger_1.logger.debug('SETUP', `Could not pin message in #${channel.name} (missing permission?)`);
    }
}
/* ── Embed builders ────────────────────────────────────────── */
function welcomeEmbeds() {
    const header = new discord_js_1.EmbedBuilder()
        .setColor(branding_1.COLORS.primary)
        .setTitle(content_1.WELCOME.title)
        .setDescription((0, format_1.truncate)([content_1.WELCOME.intro, '', branding_1.BRAND.rule, '', branding_1.PRINCIPLES.map((p) => `• ${p}`).join('\n')].join('\n'), format_1.EMBED_DESCRIPTION_LIMIT));
    const body = new discord_js_1.EmbedBuilder().setColor(branding_1.COLORS.neutral).addFields(content_1.WELCOME.sections.map((section) => ({
        name: section.heading,
        value: (0, format_1.truncate)(section.body, format_1.EMBED_FIELD_LIMIT),
    })));
    const footer = new discord_js_1.EmbedBuilder()
        .setColor(branding_1.COLORS.neutral)
        .setDescription((0, format_1.truncate)(content_1.WELCOME.closing, format_1.EMBED_DESCRIPTION_LIMIT))
        .setFooter({ text: `${branding_1.BRAND.footer} · ${branding_1.BRAND.tagline}` });
    return [header, body, footer];
}
function rulesEmbeds() {
    const numbered = content_1.RULES.rules.map((rule, index) => `**${index + 1}.** ${rule}`).join('\n\n');
    const main = new discord_js_1.EmbedBuilder()
        .setColor(branding_1.COLORS.primary)
        .setTitle(content_1.RULES.title)
        .setDescription((0, format_1.truncate)([content_1.RULES.intro, '', numbered].join('\n'), format_1.EMBED_DESCRIPTION_LIMIT));
    const closing = new discord_js_1.EmbedBuilder()
        .setColor(branding_1.COLORS.neutral)
        .addFields({ name: 'ENFORCEMENT', value: (0, format_1.truncate)(content_1.RULES.enforcement, format_1.EMBED_FIELD_LIMIT) }, {
        name: 'QUESTIONS YOU SHOULD EXPECT',
        value: (0, format_1.truncate)(`${branding_1.HOUSE_QUESTIONS.map((question) => `• ${question}`).join('\n')}\n\nAsking them is not hostility. It is the standard here.`, format_1.EMBED_FIELD_LIMIT),
    })
        .setFooter({ text: `${branding_1.BRAND.footer} · accept below to unlock the server` });
    return [main, closing];
}
function verificationRow() {
    return new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(content_1.VERIFICATION.customId)
        .setLabel(content_1.VERIFICATION.buttonLabel)
        .setStyle(discord_js_1.ButtonStyle.Secondary));
}
//# sourceMappingURL=content.js.map