"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serverStatusCommand = void 0;
const discord_js_1 = require("discord.js");
const branding_1 = require("../../config/branding");
const server_1 = require("../../config/server");
const provisioner_1 = require("../../services/provisioning/provisioner");
const resolve_1 = require("../../services/resolve");
const state_1 = require("../../services/state");
const format_1 = require("../../utils/format");
/**
 * /server-status — a read-only audit of blueprint vs reality.
 *
 * Deliberately makes no API writes: this is the command you run when something
 * looks wrong and you do not yet want to change anything.
 */
exports.serverStatusCommand = {
    access: 'moderator',
    defer: 'ephemeral',
    data: new discord_js_1.SlashCommandBuilder()
        .setName('server-status')
        .setDescription('Audit the server against the blueprint. Read-only.')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageMessages)
        .setDMPermission(false),
    async execute({ interaction, guild }) {
        await guild.roles.fetch();
        await guild.channels.fetch();
        const audit = auditGuild(guild);
        const persisted = state_1.state.read();
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(audit.missing.length === 0 ? branding_1.COLORS.success : branding_1.COLORS.warning)
            .setTitle(`${branding_1.BRAND.name} — SERVER STATUS`)
            .setDescription([
            audit.missing.length === 0
                ? 'Every resource in the blueprint exists.'
                : `**${(0, format_1.plural)(audit.missing.length, 'missing resource')}.** Run \`/setup\` to restore.`,
            '',
            `Roles      ${audit.roles.present}/${audit.roles.total}`,
            `Categories ${audit.categories.present}/${audit.categories.total}`,
            `Channels   ${audit.channels.present}/${audit.channels.total}`,
        ].join('\n'))
            .setFooter({ text: `${branding_1.BRAND.footer} · ${guild.name}` })
            .setTimestamp(new Date());
        embed.addFields({ name: 'ROLES', value: (0, format_1.codeBlock)(audit.roleLines.join('\n')) });
        for (const chunk of (0, format_1.chunkLines)(audit.structureLines, 1000)) {
            embed.addFields({ name: 'STRUCTURE', value: (0, format_1.codeBlock)(chunk) });
        }
        if (audit.missing.length > 0) {
            embed.addFields({
                name: 'MISSING',
                value: (0, format_1.truncate)(audit.missing.map((item) => `• ${item}`).join('\n'), format_1.EMBED_FIELD_LIMIT),
            });
        }
        if (audit.unmanaged.length > 0) {
            embed.addFields({
                name: 'NOT IN THE BLUEPRINT',
                value: (0, format_1.truncate)(`${audit.unmanaged.map((name) => `#${name}`).join(', ')}\n_Untouched by setup._`, format_1.EMBED_FIELD_LIMIT),
            });
        }
        embed.addFields({
            name: 'CONFIGURATION',
            value: [
                `Last setup: ${persisted.lastSetupAt ?? 'never'}`,
                `Triggered by: ${persisted.lastSetupBy ? `<@${persisted.lastSetupBy}>` : '—'}`,
                `Tracked IDs: ${Object.keys(persisted.roles).length} roles, ${Object.keys(persisted.categories).length} categories, ${Object.keys(persisted.channels).length} channels`,
                `Join role: @${server_1.SERVER.roles.find((r) => r.key === server_1.SERVER.joinRole)?.name ?? '?'} → @${server_1.SERVER.roles.find((r) => r.key === server_1.SERVER.verifiedRole)?.name ?? '?'} on verification`,
            ].join('\n'),
        });
        await interaction.editReply({ embeds: [embed] });
    },
};
const OK = ' ok ';
const GONE = 'MISS';
function auditGuild(guild) {
    const audit = {
        roles: { present: 0, total: server_1.SERVER.roles.length },
        categories: { present: 0, total: server_1.SERVER.categories.length },
        channels: { present: 0, total: 0 },
        roleLines: [],
        structureLines: [],
        missing: [],
        unmanaged: [],
    };
    for (const definition of server_1.SERVER.roles) {
        const role = (0, resolve_1.findRole)(guild, definition.key);
        if (role)
            audit.roles.present += 1;
        else
            audit.missing.push(`@${definition.name} (role)`);
        audit.roleLines.push(`[${role ? OK : GONE}] ${definition.name.padEnd(12)} ${role ? `${role.members.size} member(s)` : ''}`.trimEnd());
    }
    for (const category of server_1.SERVER.categories) {
        const found = (0, resolve_1.findCategory)(guild, category.key);
        if (found)
            audit.categories.present += 1;
        else
            audit.missing.push(`${category.name} (category)`);
        audit.structureLines.push(`[${found ? OK : GONE}] ${category.name}`);
        for (const channel of category.channels) {
            audit.channels.total += 1;
            const live = (0, resolve_1.findChannel)(guild, channel.key);
            if (live)
                audit.channels.present += 1;
            else
                audit.missing.push(`${channel.type === 'text' ? '#' : ''}${channel.name} (channel)`);
            const marker = channel.type === 'text' ? '#' : '<)';
            audit.structureLines.push(`[${live ? OK : GONE}]    ${marker}${channel.name}`);
        }
    }
    const managed = (0, provisioner_1.managedChannelIds)(guild);
    audit.unmanaged = [
        ...guild.channels.cache
            .filter((channel) => !managed.has(channel.id) &&
            channel.type !== discord_js_1.ChannelType.GuildCategory &&
            !channel.isThread())
            .map((channel) => channel.name),
    ];
    return audit;
}
//# sourceMappingURL=serverStatus.js.map