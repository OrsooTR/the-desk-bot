"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.banCommand = void 0;
const discord_js_1 = require("discord.js");
const guards_1 = require("../../permissions/guards");
const moderationLog_1 = require("../../services/moderationLog");
const errors_1 = require("../../utils/errors");
exports.banCommand = {
    access: 'moderator',
    defer: 'ephemeral',
    data: new discord_js_1.SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a member from the server.')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.BanMembers)
        .setDMPermission(false)
        .addUserOption((option) => option.setName('user').setDescription('The member to ban').setRequired(true))
        .addStringOption((option) => option.setName('reason').setDescription('Recorded in #moderation').setRequired(true))
        .addIntegerOption((option) => option
        .setName('delete-days')
        .setDescription('Also delete their messages from the last N days (0–7, default 0)')
        .setMinValue(0)
        .setMaxValue(7)),
    async execute({ interaction, guild, member }) {
        const user = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason', true);
        const deleteDays = interaction.options.getInteger('delete-days') ?? 0;
        // A member who has already left can still be banned, so a missing member
        // object is not an error here — only a failed hierarchy check is.
        const target = await guild.members.fetch(user.id).catch(() => null);
        if (target) {
            const permitted = (0, guards_1.canActOn)(member, target);
            if (!permitted.ok)
                throw new errors_1.OperationalError(permitted.reason);
            await target
                .send(`You have been banned from **${guild.name}**.\n\nReason: ${reason}`)
                .catch(() => undefined);
        }
        await guild.members.ban(user.id, {
            reason: `${reason} — by ${member.user.tag}`,
            deleteMessageSeconds: deleteDays * 24 * 60 * 60,
        });
        await (0, moderationLog_1.recordModeration)(guild, {
            action: 'BAN',
            moderator: member.user,
            target: user,
            reason,
            ...(deleteDays > 0 ? { detail: `messages purged: ${deleteDays}d` } : {}),
        });
        await interaction.editReply(`Banned **${user.tag}**.`);
    },
};
//# sourceMappingURL=ban.js.map