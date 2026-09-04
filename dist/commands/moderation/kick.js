"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kickCommand = void 0;
const discord_js_1 = require("discord.js");
const guards_1 = require("../../permissions/guards");
const moderationLog_1 = require("../../services/moderationLog");
const errors_1 = require("../../utils/errors");
exports.kickCommand = {
    access: 'moderator',
    defer: 'ephemeral',
    data: new discord_js_1.SlashCommandBuilder()
        .setName('kick')
        .setDescription('Remove a member from the server. They can rejoin with a new invite.')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.KickMembers)
        .setDMPermission(false)
        .addUserOption((option) => option.setName('user').setDescription('The member to remove').setRequired(true))
        .addStringOption((option) => option.setName('reason').setDescription('Recorded in #moderation').setRequired(true)),
    async execute({ interaction, guild, member }) {
        const user = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason', true);
        const target = await guild.members.fetch(user.id).catch(() => null);
        if (!target)
            throw new errors_1.OperationalError('That member is not in this server.');
        const permitted = (0, guards_1.canActOn)(member, target);
        if (!permitted.ok)
            throw new errors_1.OperationalError(permitted.reason);
        // Best effort: a member with DMs closed must not block the kick.
        await target
            .send(`You have been removed from **${guild.name}**.\n\nReason: ${reason}`)
            .catch(() => undefined);
        await target.kick(`${reason} — by ${member.user.tag}`);
        await (0, moderationLog_1.recordModeration)(guild, {
            action: 'KICK',
            moderator: member.user,
            target: user,
            reason,
        });
        await interaction.editReply(`Removed **${user.tag}**.`);
    },
};
//# sourceMappingURL=kick.js.map