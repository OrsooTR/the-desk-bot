"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.warnCommand = void 0;
const discord_js_1 = require("discord.js");
const branding_1 = require("../../config/branding");
const moderation_1 = require("../../config/moderation");
const guards_1 = require("../../permissions/guards");
const warnings_1 = require("../../services/warnings");
const errors_1 = require("../../utils/errors");
/**
 * /warn — file a strike.
 *
 * The moderator picks the offence; the ladder picks the consequence. That
 * separation is the point: the same behaviour costs the same regardless of
 * who is on duty or how irritating the member was being.
 */
exports.warnCommand = {
    access: 'moderator',
    defer: 'ephemeral',
    data: new discord_js_1.SlashCommandBuilder()
        .setName('warn')
        .setDescription('File a strike against a member. The ladder decides the consequence.')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ModerateMembers)
        .setDMPermission(false)
        .addUserOption((option) => option.setName('user').setDescription('The member').setRequired(true))
        .addStringOption((option) => option
        .setName('offence')
        .setDescription('What rule was broken')
        .setRequired(true)
        .addChoices(...moderation_1.OFFENCES.slice(0, 25).map((offence) => ({
        name: `${offence.label} (${offence.immediate ? 'immediate ' + offence.immediate : offence.points + ' pt'})`,
        value: offence.key,
    }))))
        .addStringOption((option) => option
        .setName('reason')
        .setDescription('What actually happened. Shown to the member.')
        .setRequired(true)),
    async execute({ interaction, guild, member }) {
        const user = interaction.options.getUser('user', true);
        const offenceKey = interaction.options.getString('offence', true);
        const reason = interaction.options.getString('reason', true);
        const target = await guild.members.fetch(user.id).catch(() => null);
        if (!target)
            throw new errors_1.OperationalError('That member is not in this server.');
        if (target.user.bot)
            throw new errors_1.OperationalError('Bots do not get warnings.');
        const permitted = (0, guards_1.canActOn)(member, target);
        if (!permitted.ok)
            throw new errors_1.OperationalError(permitted.reason);
        const outcome = await (0, warnings_1.fileStrike)(guild, target, member.user, offenceKey, reason);
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(outcome.problem ? branding_1.COLORS.warning : branding_1.COLORS.success)
            .setTitle('STRIKE FILED')
            .addFields({ name: 'Member', value: `<@${user.id}>`, inline: true }, { name: 'Offence', value: outcome.offence.label, inline: true }, { name: 'Points', value: `+${outcome.offence.points} → ${outcome.activePoints}`, inline: true }, { name: 'Applied', value: outcome.applied }, { name: 'Reason', value: reason })
            .setFooter({ text: `Points expire after ${moderation_1.STRIKE_DECAY_DAYS} days` });
        if (outcome.problem)
            embed.addFields({ name: 'Note', value: outcome.problem });
        await interaction.editReply({ embeds: [embed] });
    },
};
//# sourceMappingURL=warn.js.map