import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type Guild,
} from 'discord.js';
import { BRAND, COLORS } from '../../config/branding';
import { SERVER } from '../../config/server';
import type { Command, CommandContext } from '../../core/command';
import { managedChannelIds } from '../../services/provisioning/provisioner';
import { findCategory, findChannel, findRole } from '../../services/resolve';
import { state } from '../../services/state';
import { chunkLines, codeBlock, plural, truncate, EMBED_FIELD_LIMIT } from '../../utils/format';

/**
 * /server-status — a read-only audit of blueprint vs reality.
 *
 * Deliberately makes no API writes: this is the command you run when something
 * looks wrong and you do not yet want to change anything.
 */
export const serverStatusCommand: Command = {
  access: 'moderator',
  defer: 'ephemeral',
  data: new SlashCommandBuilder()
    .setName('server-status')
    .setDescription('Audit the server against the blueprint. Read-only.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),

  async execute({ interaction, guild }: CommandContext): Promise<void> {
    await guild.roles.fetch();
    await guild.channels.fetch();

    const audit = auditGuild(guild);
    const persisted = state.read();

    const embed = new EmbedBuilder()
      .setColor(audit.missing.length === 0 ? COLORS.success : COLORS.warning)
      .setTitle(`${BRAND.name} — SERVER STATUS`)
      .setDescription(
        [
          audit.missing.length === 0
            ? 'Every resource in the blueprint exists.'
            : `**${plural(audit.missing.length, 'missing resource')}.** Run \`/setup\` to restore.`,
          '',
          `Roles      ${audit.roles.present}/${audit.roles.total}`,
          `Categories ${audit.categories.present}/${audit.categories.total}`,
          `Channels   ${audit.channels.present}/${audit.channels.total}`,
        ].join('\n'),
      )
      .setFooter({ text: `${BRAND.footer} · ${guild.name}` })
      .setTimestamp(new Date());

    embed.addFields({ name: 'ROLES', value: codeBlock(audit.roleLines.join('\n')) });

    for (const chunk of chunkLines(audit.structureLines, 1000)) {
      embed.addFields({ name: 'STRUCTURE', value: codeBlock(chunk) });
    }

    if (audit.missing.length > 0) {
      embed.addFields({
        name: 'MISSING',
        value: truncate(audit.missing.map((item) => `• ${item}`).join('\n'), EMBED_FIELD_LIMIT),
      });
    }

    if (audit.unmanaged.length > 0) {
      embed.addFields({
        name: 'NOT IN THE BLUEPRINT',
        value: truncate(
          `${audit.unmanaged.map((name) => `#${name}`).join(', ')}\n_Untouched by setup._`,
          EMBED_FIELD_LIMIT,
        ),
      });
    }

    embed.addFields({
      name: 'CONFIGURATION',
      value: [
        `Last setup: ${persisted.lastSetupAt ?? 'never'}`,
        `Triggered by: ${persisted.lastSetupBy ? `<@${persisted.lastSetupBy}>` : '—'}`,
        `Tracked IDs: ${Object.keys(persisted.roles).length} roles, ${Object.keys(persisted.categories).length} categories, ${Object.keys(persisted.channels).length} channels`,
        `Join role: @${SERVER.roles.find((r) => r.key === SERVER.joinRole)?.name ?? '?'} → @${SERVER.roles.find((r) => r.key === SERVER.verifiedRole)?.name ?? '?'} on verification`,
      ].join('\n'),
    });

    await interaction.editReply({ embeds: [embed] });
  },
};

interface Audit {
  roles: { present: number; total: number };
  categories: { present: number; total: number };
  channels: { present: number; total: number };
  roleLines: string[];
  structureLines: string[];
  missing: string[];
  unmanaged: string[];
}

const OK = ' ok ';
const GONE = 'MISS';

function auditGuild(guild: Guild): Audit {
  const audit: Audit = {
    roles: { present: 0, total: SERVER.roles.length },
    categories: { present: 0, total: SERVER.categories.length },
    channels: { present: 0, total: 0 },
    roleLines: [],
    structureLines: [],
    missing: [],
    unmanaged: [],
  };

  for (const definition of SERVER.roles) {
    const role = findRole(guild, definition.key);
    if (role) audit.roles.present += 1;
    else audit.missing.push(`@${definition.name} (role)`);
    audit.roleLines.push(
      `[${role ? OK : GONE}] ${definition.name.padEnd(12)} ${role ? `${role.members.size} member(s)` : ''}`.trimEnd(),
    );
  }

  for (const category of SERVER.categories) {
    const found = findCategory(guild, category.key);
    if (found) audit.categories.present += 1;
    else audit.missing.push(`${category.name} (category)`);
    audit.structureLines.push(`[${found ? OK : GONE}] ${category.name}`);

    for (const channel of category.channels) {
      audit.channels.total += 1;
      const live = findChannel(guild, channel.key);
      if (live) audit.channels.present += 1;
      else audit.missing.push(`${channel.type === 'text' ? '#' : ''}${channel.name} (channel)`);
      const marker = channel.type === 'text' ? '#' : '<)';
      audit.structureLines.push(`[${live ? OK : GONE}]    ${marker}${channel.name}`);
    }
  }

  const managed = managedChannelIds(guild);
  audit.unmanaged = [
    ...guild.channels.cache
      .filter(
        (channel) =>
          !managed.has(channel.id) &&
          channel.type !== ChannelType.GuildCategory &&
          !channel.isThread(),
      )
      .map((channel) => channel.name),
  ];

  return audit;
}
