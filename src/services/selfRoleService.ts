import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ThreadAutoArchiveDuration,
  type ButtonInteraction,
  type ChannelSelectMenuInteraction,
  type Guild,
  type GuildMember,
  type StringSelectMenuInteraction,
} from 'discord.js';
import { BRAND, COLORS } from '../config/branding';
import { SERVER } from '../config/server';
import {
  FUNDED_REQUEST_BUTTON,
  FUNDED_ROLE_KEY,
  SELF_ROLE_GROUPS,
  groupFor,
  keysInGroup,
  type SelfRoleGroup,
} from '../config/selfRoles';
import { OperationalError } from '../utils/errors';
import { truncate } from '../utils/format';
import { logger } from './logger';
import { findRole, findTextChannel } from './resolve';
import { state } from './state';

/* ────────────────────────────────────────────────────────────
 * Self-assignable roles
 *
 * One published message per group, each with a select menu. Selecting is
 * idempotent: the member's roles within that group are made to match their
 * selection exactly, so deselecting removes the role rather than leaving it
 * stuck forever.
 *
 * Funded status is the deliberate exception — it is a claim about someone's
 * capital, which is exactly the sort of thing people inflate, so it goes
 * through staff review instead of a menu.
 * ──────────────────────────────────────────────────────────── */

export interface RolePanel {
  key: string;
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[];
}

export function rolePanels(): RolePanel[] {
  const panels: RolePanel[] = SELF_ROLE_GROUPS.map((group) => ({
    key: `roles:${group.key}`,
    embeds: [
      new EmbedBuilder()
        .setColor(COLORS.neutral)
        .setTitle(group.title)
        .setDescription(group.intro)
        .setFooter({ text: `${BRAND.footer} · select to add, deselect to remove` }),
    ],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(group.customId)
          .setPlaceholder(
            group.maxValues > 1 ? 'Pick as many as apply' : 'Pick one',
          )
          .setMinValues(group.minValues)
          // Discord rejects maxValues above the option count.
          .setMaxValues(Math.min(group.maxValues, group.options.length))
          .addOptions(
            group.options.map((option) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(truncate(option.label, 100))
                .setDescription(truncate(option.description, 100))
                .setValue(option.key),
            ),
          ),
      ),
    ],
  }));

  panels.push({
    key: 'roles:funded',
    embeds: [
      new EmbedBuilder()
        .setColor(COLORS.neutral)
        .setTitle('FUNDED TRADER')
        .setDescription(
          [
            'This one is not self-served. A claim about trading firm capital is exactly the sort of thing that gets inflated, so a moderator checks it.',
            '',
            'Press the button and a **private thread** opens with the staff. Post **one** of:',
            '',
            '• A screenshot of your firm dashboard showing the account status and the firm name',
            '• A payout confirmation from the firm',
            '• The funded certificate the firm issued you',
            '',
            '**Redact everything else.** Cover the account number, your full name, your address, your balance and any payment details — none of that proves anything and all of it is worth stealing. The firm name and the account status is the whole check.',
            '',
            'Staff will never ask you for login credentials, an API key, or money. Anyone who does is not staff.',
          ].join('\n'),
        )
        .setFooter({ text: `${BRAND.footer} · reviewed by a human, not a bot` }),
    ],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(FUNDED_REQUEST_BUTTON)
          .setLabel('Request funded verification')
          .setStyle(ButtonStyle.Secondary),
      ),
    ],
  });

  return panels;
}

/** Apply a menu selection: the member's roles in that group match it exactly. */
export async function handleSelfRoleSelect(
  interaction: StringSelectMenuInteraction | ChannelSelectMenuInteraction,
): Promise<void> {
  if (!interaction.inCachedGuild()) return;

  const group = groupFor(interaction.customId);
  if (!group) return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const member = await interaction.guild.members.fetch(interaction.user.id);
  const chosen = new Set(
    'values' in interaction ? (interaction.values as string[]) : [],
  );

  const { added, removed, failed } = await applyGroup(member, group, chosen);

  if (failed.length > 0) {
    logger.warn(
      'MEMBER',
      `Could not apply ${failed.length} self-role(s) for ${member.user.tag} — missing role or hierarchy`,
    );
  }

  const lines: string[] = [];
  if (added.length > 0) lines.push(`**Added:** ${added.join(', ')}`);
  if (removed.length > 0) lines.push(`**Removed:** ${removed.join(', ')}`);
  if (lines.length === 0) lines.push('Nothing changed.');
  if (failed.length > 0) {
    lines.push('', `Could not apply: ${failed.join(', ')}. A moderator has been notified.`);
  }

  await interaction.editReply(lines.join('\n'));
}

async function applyGroup(
  member: GuildMember,
  group: SelfRoleGroup,
  chosen: Set<string>,
): Promise<{ added: string[]; removed: string[]; failed: string[] }> {
  const added: string[] = [];
  const removed: string[] = [];
  const failed: string[] = [];

  for (const key of keysInGroup(group)) {
    const role = findRole(member.guild, key);
    if (!role) {
      if (chosen.has(key)) failed.push(key);
      continue;
    }

    const shouldHave = chosen.has(key);
    const hasIt = member.roles.cache.has(role.id);
    if (shouldHave === hasIt) continue;

    try {
      if (shouldHave) {
        await member.roles.add(role, 'Self-assigned role');
        added.push(role.name);
      } else {
        await member.roles.remove(role, 'Self-assigned role removed');
        removed.push(role.name);
      }
    } catch {
      failed.push(role.name);
    }
  }

  return { added, removed, failed };
}

/* ── Funded verification ───────────────────────────────────── */

export async function handleFundedRequest(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = interaction.guild;
  const member = await guild.members.fetch(interaction.user.id);

  const funded = findRole(guild, FUNDED_ROLE_KEY);
  if (funded && member.roles.cache.has(funded.id)) {
    await interaction.editReply('You are already verified as a funded trader.');
    return;
  }

  const pending = state.read().fundedRequests[member.id];
  if (pending) {
    await interaction.editReply(
      `You already have a verification open: <#${pending.threadId}>. Post your proof there.`,
    );
    return;
  }

  const channel = findTextChannel(guild, SERVER.ticketChannelKey);
  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new OperationalError(
      'The support channel is missing.',
      'An admin should run `/setup` to restore it.',
    );
  }

  // A private thread: the proof stays between the member and the staff, which
  // is the entire point given what is being posted.
  const thread = await channel.threads.create({
    name: truncate(`funded · ${member.displayName}`, 100),
    type: ChannelType.PrivateThread,
    invitable: false,
    autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
    reason: `Funded verification requested by ${member.user.tag}`,
  });

  await thread.members.add(member.id).catch(() => undefined);

  const moderator = findRole(guild, 'moderator');
  await thread.send({
    ...(moderator ? { content: `<@&${moderator.id}>` } : {}),
    embeds: [
      new EmbedBuilder()
        .setColor(COLORS.primary)
        .setTitle('FUNDED VERIFICATION')
        .setDescription(
          [
            `Requested by <@${member.id}>.`,
            '',
            '**Post one piece of proof:** a firm dashboard screenshot, a payout confirmation, or your funded certificate.',
            '',
            '**Redact before you post.** Cover the account number, your legal name, your address, your balance and anything to do with payments. The firm name and the account status is all that is being checked.',
            '',
            'A moderator will approve or decline with `/funded`.',
          ].join('\n'),
        )
        .setFooter({ text: `${BRAND.footer} · never share credentials or payment details` }),
    ],
    allowedMentions: moderator ? { roles: [moderator.id] } : { parse: [] },
  });

  state.update((current) => {
    current.fundedRequests[member.id] = {
      threadId: thread.id,
      requestedAt: new Date().toISOString(),
    };
  });

  logger.info('MEMBER', `Funded verification requested by ${member.user.tag}`);
  await interaction.editReply(`Verification opened: <#${thread.id}>`);
}

/** Staff decision. Called by /funded. */
export async function decideFunded(
  guild: Guild,
  target: GuildMember,
  approve: boolean,
  moderatorTag: string,
): Promise<string> {
  const role = findRole(guild, FUNDED_ROLE_KEY);
  if (!role) {
    throw new OperationalError(
      'The Funded role does not exist.',
      'Run `/setup` to create it, then try again.',
    );
  }

  if (approve) {
    await target.roles.add(role, `Funded account verified by ${moderatorTag}`);
  } else if (target.roles.cache.has(role.id)) {
    await target.roles.remove(role, `Funded verification revoked by ${moderatorTag}`);
  }

  state.update((current) => {
    delete current.fundedRequests[target.id];
  });

  logger.info(
    'MEMBER',
    `Funded verification ${approve ? 'approved' : 'declined'} for ${target.user.tag} by ${moderatorTag}`,
  );

  return approve
    ? `**${target.user.tag}** is now verified as a funded trader.`
    : `Declined. **${target.user.tag}** was not given the Funded role.`;
}
