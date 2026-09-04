"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fundedCommand = void 0;
const discord_js_1 = require("discord.js");
const moderationLog_1 = require("../../services/moderationLog");
const selfRoleService_1 = require("../../services/selfRoleService");
const errors_1 = require("../../utils/errors");
/**
 * /funded — approve or decline a funded-account verification.
 *
 * Deliberately a human decision. The bot cannot tell a real firm dashboard
 * from a convincing screenshot, and pretending otherwise would put a badge of
 * credibility on something nobody checked.
 */
exports.fundedCommand = {
    access: 'moderator',
    defer: 'ephemeral',
    data: new discord_js_1.SlashCommandBuilder()
        .setName('funded')
        .setDescription('Approve or decline a funded trader verification.')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ModerateMembers)
        .setDMPermission(false)
        .addSubcommand((sub) => sub
        .setName('approve')
        .setDescription('Grant the Funded role')
        .addUserOption((option) => option.setName('user').setDescription('The member').setRequired(true))
        .addStringOption((option) => option
        .setName('firm')
        .setDescription('Which firm the proof showed. Recorded in #moderation.')
        .setRequired(true)))
        .addSubcommand((sub) => sub
        .setName('decline')
        .setDescription('Decline, or revoke an existing Funded role')
        .addUserOption((option) => option.setName('user').setDescription('The member').setRequired(true))
        .addStringOption((option) => option.setName('reason').setDescription('Why').setRequired(true))),
    async execute({ interaction, guild, member }) {
        const approve = interaction.options.getSubcommand() === 'approve';
        const user = interaction.options.getUser('user', true);
        const target = await guild.members.fetch(user.id).catch(() => null);
        if (!target)
            throw new errors_1.OperationalError('That member is not in this server.');
        const detail = approve
            ? (interaction.options.getString('firm', true))
            : (interaction.options.getString('reason', true));
        const result = await (0, selfRoleService_1.decideFunded)(guild, target, approve, member.user.tag);
        await (0, moderationLog_1.recordModeration)(guild, {
            action: 'VERIFY',
            moderator: member.user,
            target: user,
            reason: detail,
            detail: approve ? 'funded verified' : 'funded declined',
        });
        await interaction.editReply(result);
    },
};
//# sourceMappingURL=funded.js.map