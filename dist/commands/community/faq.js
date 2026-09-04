"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.faqCommand = void 0;
const discord_js_1 = require("discord.js");
const branding_1 = require("../../config/branding");
const faq_1 = require("../../config/faq");
const format_1 = require("../../utils/format");
/**
 * /faq — the standing answers, searchable.
 *
 * Answers privately by default so a repeated question does not fill a channel;
 * `share: true` posts it publicly, which is what a moderator wants when they
 * are answering someone.
 */
exports.faqCommand = {
    access: 'everyone',
    defer: 'none',
    data: new discord_js_1.SlashCommandBuilder()
        .setName('faq')
        .setDescription('Answers to the questions that come up most.')
        .setDMPermission(false)
        .addStringOption((option) => option
        .setName('topic')
        .setDescription('Jump straight to one answer')
        .addChoices(...faq_1.FAQ.slice(0, 25).map((entry) => ({
        name: (0, format_1.truncate)(entry.question, 100),
        value: entry.key,
    }))))
        .addStringOption((option) => option.setName('search').setDescription('Search the FAQ text'))
        .addBooleanOption((option) => option.setName('share').setDescription('Post it in the channel instead of privately')),
    async execute({ interaction }) {
        const topic = interaction.options.getString('topic');
        const query = interaction.options.getString('search');
        const share = interaction.options.getBoolean('share') ?? false;
        const embed = topic ? single(topic) : query ? results(query) : overview();
        await interaction.reply({
            embeds: [embed],
            ...(share ? {} : { flags: discord_js_1.MessageFlags.Ephemeral }),
        });
    },
};
function single(key) {
    const entry = (0, faq_1.findFaq)(key);
    if (!entry)
        return notFound();
    return new discord_js_1.EmbedBuilder()
        .setColor(branding_1.COLORS.primary)
        .setTitle((0, format_1.truncate)(entry.question, 256))
        .setDescription((0, format_1.truncate)(entry.answer, format_1.EMBED_DESCRIPTION_LIMIT))
        .setFooter({ text: `${branding_1.BRAND.footer} · ${entry.section}` });
}
function results(query) {
    const matches = (0, faq_1.searchFaq)(query);
    if (matches.length === 0)
        return notFound();
    if (matches.length === 1 && matches[0])
        return single(matches[0].key);
    return new discord_js_1.EmbedBuilder()
        .setColor(branding_1.COLORS.primary)
        .setTitle(`FAQ — ${matches.length} matches for "${(0, format_1.truncate)(query, 60)}"`)
        .addFields(matches.slice(0, 8).map((entry) => ({
        name: (0, format_1.truncate)(entry.question, 256),
        value: (0, format_1.truncate)(entry.answer, 300),
    })))
        .setFooter({ text: `${branding_1.BRAND.footer} · narrow it with /faq topic:` });
}
function overview() {
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(branding_1.COLORS.primary)
        .setTitle(`${branding_1.BRAND.name} — FAQ`)
        .setDescription('Pick a question with `/faq topic:`, or search with `/faq search:`.');
    const sections = [...new Set(faq_1.FAQ.map((entry) => entry.section))];
    for (const section of sections) {
        embed.addFields({
            name: section.toUpperCase(),
            value: (0, format_1.truncate)(faq_1.FAQ.filter((entry) => entry.section === section)
                .map((entry) => `• ${entry.question}`)
                .join('\n'), format_1.EMBED_FIELD_LIMIT),
        });
    }
    return embed.setFooter({ text: `${branding_1.BRAND.footer} · not here? open a ticket` });
}
function notFound() {
    return new discord_js_1.EmbedBuilder()
        .setColor(branding_1.COLORS.neutral)
        .setDescription('Nothing in the FAQ matches that. Open a ticket in the support channel and a moderator will answer.');
}
//# sourceMappingURL=faq.js.map