"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewCommand = void 0;
const discord_js_1 = require("discord.js");
const branding_1 = require("../../config/branding");
const review_1 = require("../../config/review");
const errors_1 = require("../../utils/errors");
const format_1 = require("../../utils/format");
/**
 * /review — the structured trade review template.
 *
 * The template is posted, then a thread is opened on it. The review happens in
 * the thread, so #trade-review stays a readable index of reviews rather than a
 * wall of half-finished ones.
 */
exports.reviewCommand = {
    access: 'member',
    defer: 'none',
    data: new discord_js_1.SlashCommandBuilder()
        .setName('review')
        .setDescription('Post the structured trade review template.')
        .setDMPermission(false)
        .addStringOption((option) => option
        .setName('instrument')
        .setDescription('What did you trade? e.g. ES, NQ, EURUSD, BTC')
        .setRequired(true)
        .setMaxLength(40))
        .addStringOption((option) => option
        .setName('direction')
        .setDescription('Long or short')
        .addChoices({ name: 'Long', value: 'Long' }, { name: 'Short', value: 'Short' }))
        .addStringOption((option) => option
        .setName('session')
        .setDescription('Which session')
        .addChoices({ name: 'Asia', value: 'Asia' }, { name: 'London', value: 'London' }, { name: 'New York', value: 'New York' }, { name: 'Overnight', value: 'Overnight' }, { name: 'Other', value: 'Other' }))
        .addBooleanOption((option) => option
        .setName('private')
        .setDescription('Get the raw template privately instead of posting it')),
    async execute({ interaction, member }) {
        const instrument = interaction.options.getString('instrument', true).trim();
        const direction = interaction.options.getString('direction') ?? '—';
        const session = interaction.options.getString('session') ?? '—';
        const isPrivate = interaction.options.getBoolean('private') ?? false;
        if (isPrivate) {
            await interaction.reply({
                content: (0, format_1.truncate)(plainTemplate(instrument, session, direction), 1990),
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        const channel = interaction.channel;
        if (!channel || channel.type !== discord_js_1.ChannelType.GuildText) {
            throw new errors_1.OperationalError('Post reviews in a normal text channel.');
        }
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(branding_1.COLORS.primary)
            .setTitle('TRADE REVIEW')
            .setDescription([
            `**Instrument:** ${(0, format_1.escapeMarkdown)(instrument)}`,
            `**Session:** ${session}`,
            `**Direction:** ${direction}`,
            `**Trader:** <@${member.id}>`,
        ].join('\n'))
            .addFields(review_1.REVIEW_SECTIONS.map((section) => ({
            name: section.heading,
            value: (0, format_1.truncate)(section.prompts.map((prompt) => `• ${prompt}`).join('\n'), format_1.EMBED_FIELD_LIMIT),
        })))
            .setFooter({ text: `${branding_1.BRAND.footer} · ${review_1.REVIEW_FOOTER}` })
            .setTimestamp(new Date());
        const message = await channel.send({ embeds: [embed] });
        const threadName = (0, format_1.truncate)(`Review — ${instrument} — ${member.displayName}`, 100);
        const thread = await message
            .startThread({ name: threadName, autoArchiveDuration: 10080, reason: 'Trade review' })
            .catch(() => null);
        await interaction.editReply(thread
            ? `Template posted. Fill it in here: ${thread.url}`
            : 'Template posted. Reply to it with your review.');
    },
};
/** Plain-text version, for people who would rather write it in their editor. */
function plainTemplate(instrument, session, direction) {
    const lines = [
        branding_1.BRAND.rule,
        'TRADE REVIEW',
        branding_1.BRAND.rule,
        '',
        `Instrument: ${instrument}`,
        `Session: ${session}`,
        `Direction: ${direction}`,
        '',
    ];
    for (const section of review_1.REVIEW_SECTIONS) {
        lines.push(section.heading);
        for (const prompt of section.prompts)
            lines.push(`  ${prompt}`);
        lines.push('');
    }
    lines.push(review_1.REVIEW_FOOTER);
    return `\`\`\`\n${lines.join('\n')}\n\`\`\``;
}
//# sourceMappingURL=review.js.map