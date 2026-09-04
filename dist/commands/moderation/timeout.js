"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.timeoutCommand = void 0;
const discord_js_1 = require("discord.js");
const guards_1 = require("../../permissions/guards");
const moderationLog_1 = require("../../services/moderationLog");
const errors_1 = require("../../utils/errors");
const format_1 = require("../../utils/format");
/** Discord's maximum timeout length. */
const MAX_MINUTES = 28 * 24 * 60;
exports.timeoutCommand = {
    access: 'moderator',
    defer: 'ephemeral',
    data: new discord_js_1.SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Temporarily mute a member, or clear an existing timeout.')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ModerateMembers)
        .setDMPermission(false)
        .addUserOption((option) => option.setName('user').setDescription('The member to time out').setRequired(true))
        .addIntegerOption((option) => option
        .setName('minutes')
        .setDescription(`Length in minutes (0 clears the timeout, max ${MAX_MINUTES})`)
        .setMinValue(0)
        .setMaxValue(MAX_MINUTES)
        .setRequired(true))
        .addStringOption((option) => option.setName('reason').setDescription('Recorded in #moderation').setRequired(true)),
    async execute({ interaction, guild, member }) {
        const user = interaction.options.getUser('user', true);
        const minutes = interaction.options.getInteger('minutes', true);
        const reason = interaction.options.getString('reason', true);
        const target = await guild.members.fetch(user.id).catch(() => null);
        if (!target)
            throw new errors_1.OperationalError('That member is not in this server.');
        const permitted = (0, guards_1.canActOn)(member, target);
        if (!permitted.ok)
            throw new errors_1.OperationalError(permitted.reason);
        if (minutes === 0) {
            await target.timeout(null, `Timeout cleared — by ${member.user.tag}`);
            await (0, moderationLog_1.recordModeration)(guild, {
                action: 'TIMEOUT',
                moderator: member.user,
                target: user,
                reason,
                detail: 'cleared',
            });
            await interaction.editReply(`Cleared the timeout on **${user.tag}**.`);
            return;
        }
        await target.timeout(minutes * 60_000, `${reason} — by ${member.user.tag}`);
        await target
            .send(`You have been timed out in **${guild.name}** for ${(0, format_1.plural)(minutes, 'minute')}.\n\nReason: ${reason}`)
            .catch(() => undefined);
        await (0, moderationLog_1.recordModeration)(guild, {
            action: 'TIMEOUT',
            moderator: member.user,
            target: user,
            reason,
            detail: (0, format_1.plural)(minutes, 'minute'),
        });
        await interaction.editReply(`**${user.tag}** timed out for ${(0, format_1.plural)(minutes, 'minute')}.`);
    },
};
//# sourceMappingURL=timeout.js.map