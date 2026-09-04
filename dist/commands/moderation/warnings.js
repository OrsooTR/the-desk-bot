"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.warningsCommand = void 0;
const discord_js_1 = require("discord.js");
const branding_1 = require("../../config/branding");
const moderation_1 = require("../../config/moderation");
const guards_1 = require("../../permissions/guards");
const warnings_1 = require("../../services/warnings");
const moderationLog_1 = require("../../services/moderationLog");
const format_1 = require("../../utils/format");
/** /warnings — read or clear a member's record. */
exports.warningsCommand = {
    access: 'moderator',
    defer: 'ephemeral',
    data: new discord_js_1.SlashCommandBuilder()
        .setName('warnings')
        .setDescription('Show or clear a member\u2019s strike record.')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ModerateMembers)
        .setDMPermission(false)
        .addSubcommand((sub) => sub
        .setName('show')
        .setDescription('Show a member\u2019s strikes')
        .addUserOption((option) => option.setName('user').setDescription('The member').setRequired(true)))
        .addSubcommand((sub) => sub
        .setName('clear')
        .setDescription('Wipe a member\u2019s record. Admin only.')
        .addUserOption((option) => option.setName('user').setDescription('The member').setRequired(true))
        .addStringOption((option) => option.setName('reason').setDescription('Why').setRequired(true))),
    async execute({ interaction, guild, member }) {
        const user = interaction.options.getUser('user', true);
        if (interaction.options.getSubcommand() === 'clear') {
            (0, guards_1.assertAccess)(member, 'admin', 'warnings clear');
            const reason = interaction.options.getString('reason', true);
            const removed = (0, warnings_1.clearStrikes)(user.id);
            await (0, moderationLog_1.recordModeration)(guild, {
                action: 'WARN',
                moderator: member.user,
                target: user,
                reason,
                detail: `record cleared (${(0, format_1.plural)(removed, 'strike')})`,
            });
            await interaction.editReply(`Cleared ${(0, format_1.plural)(removed, 'strike')} from **${user.tag}**.`);
            return;
        }
        const active = (0, warnings_1.activeStrikes)(user.id);
        const history = (0, warnings_1.allStrikes)(user.id);
        const points = (0, warnings_1.activePoints)(user.id);
        const step = (0, moderation_1.resolveLadder)(points);
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(points >= 5 ? branding_1.COLORS.danger : points > 0 ? branding_1.COLORS.warning : branding_1.COLORS.success)
            .setTitle(`RECORD — ${user.tag}`)
            .setDescription((0, format_1.truncate)([
            `**Active points:** ${points}`,
            `**Current standing:** ${step ? step.summary : 'clean'}`,
            `**Active strikes:** ${active.length} of ${history.length} on record`,
            '',
            active.length === 0
                ? 'No active strikes.'
                : active
                    .slice(0, 15)
                    .map((strike) => {
                    const offence = (0, moderation_1.findOffence)(strike.offenceKey);
                    return `${(0, format_1.timestamp)(new Date(strike.at), 'D')} — **${offence?.label ?? strike.offenceKey}** (${strike.points} pt)${strike.automatic ? ' · auto' : ''}\n\u2003${(0, format_1.truncate)(strike.reason, 150)}`;
                })
                    .join('\n\n'),
        ].join('\n'), format_1.EMBED_DESCRIPTION_LIMIT))
            .setFooter({ text: `Points expire after ${moderation_1.STRIKE_DECAY_DAYS} days` });
        await interaction.editReply({ embeds: [embed] });
    },
};
//# sourceMappingURL=warnings.js.map