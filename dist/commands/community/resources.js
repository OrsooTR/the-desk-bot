"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resourcesCommand = void 0;
const discord_js_1 = require("discord.js");
const branding_1 = require("../../config/branding");
const resources_1 = require("../../config/resources");
const format_1 = require("../../utils/format");
/**
 * /resources — the curated starting library.
 *
 * Answers privately by default so the channel does not fill with the same
 * booklist; `share: true` posts it for everyone when it is genuinely part of
 * the conversation.
 */
exports.resourcesCommand = {
    access: 'member',
    defer: 'none',
    data: new discord_js_1.SlashCommandBuilder()
        .setName('resources')
        .setDescription('Curated books, papers, tools and data.')
        .setDMPermission(false)
        .addStringOption((option) => option
        .setName('topic')
        .setDescription('Narrow it to one area')
        .addChoices(...resources_1.RESOURCE_TOPICS.map((topic) => ({ name: topic.label, value: topic.key }))))
        .addBooleanOption((option) => option.setName('share').setDescription('Post it in the channel instead of privately')),
    async execute({ interaction }) {
        const topicKey = interaction.options.getString('topic');
        const share = interaction.options.getBoolean('share') ?? false;
        const topic = topicKey ? (0, resources_1.findTopic)(topicKey) : null;
        const embed = topic ? topicEmbed(topic) : overviewEmbed();
        await interaction.reply({
            embeds: [embed],
            ...(share ? {} : { flags: discord_js_1.MessageFlags.Ephemeral }),
        });
    },
};
function topicEmbed(topic) {
    return new discord_js_1.EmbedBuilder()
        .setColor(branding_1.COLORS.primary)
        .setTitle(topic.label.toUpperCase())
        .setDescription(topic.summary)
        .addFields(topic.entries.map((entry) => ({
        name: (0, format_1.truncate)(entry.by ? `${entry.title} — ${entry.by}` : entry.title, 256),
        value: (0, format_1.truncate)(entry.url ? `${entry.note}\n${entry.url}` : entry.note, format_1.EMBED_FIELD_LIMIT),
    })))
        .setFooter({ text: `${branding_1.BRAND.footer} · add your own in #resources` });
}
function overviewEmbed() {
    return new discord_js_1.EmbedBuilder()
        .setColor(branding_1.COLORS.primary)
        .setTitle(`${branding_1.BRAND.name} — RESOURCES`)
        .setDescription((0, format_1.truncate)([
        'Foundations, not shortcuts. Nothing here hands you an edge — these are the tools you build one with.',
        '',
        branding_1.PRINCIPLES.slice(0, 3)
            .map((principle) => `_${principle}_`)
            .join('\n'),
        '',
        'Pick a topic with `/resources topic:`',
    ].join('\n'), format_1.EMBED_DESCRIPTION_LIMIT))
        .addFields(resources_1.RESOURCE_TOPICS.map((topic) => ({
        name: topic.label,
        value: (0, format_1.truncate)(`${topic.summary}\n${topic.entries
            .slice(0, 2)
            .map((entry) => `• ${entry.title}`)
            .join('\n')}`, format_1.EMBED_FIELD_LIMIT),
    })))
        .setFooter({ text: `${branding_1.BRAND.footer} · ${branding_1.BRAND.tagline}` });
}
//# sourceMappingURL=resources.js.map