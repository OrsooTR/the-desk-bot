"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearCommand = void 0;
const discord_js_1 = require("discord.js");
const moderationLog_1 = require("../../services/moderationLog");
const errors_1 = require("../../utils/errors");
const format_1 = require("../../utils/format");
/**
 * /clear — bulk delete recent messages.
 *
 * Admin-only by design: it is the only command here that destroys member
 * content, and Discord's bulk endpoint cannot undo it.
 */
exports.clearCommand = {
    access: 'admin',
    defer: 'ephemeral',
    data: new discord_js_1.SlashCommandBuilder()
        .setName('clear')
        .setDescription('Delete recent messages in this channel. Admin only.')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addIntegerOption((option) => option
        .setName('amount')
        .setDescription('How many messages to scan and delete (1–100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true))
        .addUserOption((option) => option.setName('user').setDescription('Only delete messages from this member'))
        .addStringOption((option) => option.setName('reason').setDescription('Recorded in #moderation')),
    async execute({ interaction, guild, member }) {
        const amount = interaction.options.getInteger('amount', true);
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') ?? undefined;
        const channel = interaction.channel;
        if (!channel || channel.type !== discord_js_1.ChannelType.GuildText) {
            throw new errors_1.OperationalError('This command only works in a normal text channel.');
        }
        const fetched = await channel.messages.fetch({ limit: amount });
        // Discord refuses to bulk delete anything older than 14 days. Filtering
        // first turns a hard API error into an accurate count.
        const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
        const deletable = fetched.filter((message) => message.createdTimestamp > cutoff && (!user || message.author.id === user.id) && !message.pinned);
        if (deletable.size === 0) {
            await interaction.editReply('Nothing to delete. Messages older than 14 days and pinned messages are skipped.');
            return;
        }
        const deleted = await channel.bulkDelete(deletable, true);
        const detail = `${(0, format_1.plural)(deleted.size, 'message')} in #${channel.name}${user ? ` from ${user.tag}` : ''}`;
        await (0, moderationLog_1.recordModeration)(guild, {
            action: 'CLEAR',
            moderator: member.user,
            ...(user ? { target: user } : {}),
            ...(reason ? { reason } : {}),
            detail,
        });
        await interaction.editReply(`Deleted ${detail}.${deleted.size < deletable.size ? ' Some were too old to remove.' : ''}`);
    },
};
//# sourceMappingURL=clear.js.map