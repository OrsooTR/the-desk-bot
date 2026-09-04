import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  ThreadAutoArchiveDuration,
  type ButtonInteraction,
  type Guild,
  type GuildMember,
  type ThreadChannel,
} from 'discord.js';
import { BRAND, COLORS } from '../config/branding';
import { SERVER } from '../config/server';
import { OperationalError, toUserMessage } from '../utils/errors';
import { truncate } from '../utils/format';
import { logger } from './logger';
import { recordModeration } from './moderationLog';
import { findRole, findTextChannel } from './resolve';
import { state } from './state';

/* ────────────────────────────────────────────────────────────
 * Tickets
 *
 * A ticket is a private thread inside #open-a-ticket. Threads rather than
 * channels, for three reasons: no channel-limit ceiling, no permission
 * overwrite to get wrong, and closing one archives it in place so the history
 * stays where the staff can find it.
 *
 * Visibility: private threads are invisible to anyone not added to them. The
 * opener is added on creation, and staff are pinged into it.
 * ──────────────────────────────────────────────────────────── */

export const TICKET_OPEN_BUTTON = 'desk:ticket:open';
export const TICKET_CLOSE_BUTTON = 'desk:ticket:close';

/** The standing panel in #open-a-ticket. Republished idempotently by /setup. */
export function ticketPanel(): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
  const embed = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle('OPEN A TICKET')
    .setDescription(
      [
        'Press the button below to open a private thread with the staff.',
        'Only you and the moderators can read it.',
        '',
        '**Use a ticket for**',
        '• Reporting a member — include a message link',
        '• Appealing a warning, timeout or ban',
        '• Verification problems',
        '• A message that AutoMod blocked by mistake',
        '• Anything you would rather not say in public',
        '',
        '**Do not** DM moderators directly. Tickets are logged and answered in turn; a DM is neither.',
      ].join('\n'),
    )
    .setFooter({ text: `${BRAND.footer} · one ticket at a time, please` });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(TICKET_OPEN_BUTTON)
      .setLabel('Open a ticket')
      .setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row] };
}

/** Handles the panel button: creates the thread and brings staff in. */
export async function openTicket(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = interaction.guild;
  const member = await guild.members.fetch(interaction.user.id);

  const existing = openTicketFor(member.id);
  if (existing) {
    await interaction.editReply(
      `You already have a ticket open: <#${existing.threadId}>. Continue there, or close it before opening another.`,
    );
    return;
  }

  const channel = findTextChannel(guild, SERVER.ticketChannelKey);
  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new OperationalError(
      'The ticket channel is missing.',
      'An admin should run `/setup` to restore it.',
    );
  }

  const number = nextTicketNumber();
  const name = truncate(`ticket-${String(number).padStart(4, '0')} · ${member.displayName}`, 100);

  let thread: ThreadChannel;
  try {
    thread = await channel.threads.create({
      name,
      type: ChannelType.PrivateThread,
      invitable: false,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
      reason: `Ticket opened by ${member.user.tag}`,
    });
  } catch (error) {
    logger.error('MODERATION', `Could not open a ticket for ${member.user.tag}`, error);
    const { message } = toUserMessage(error);
    await interaction.editReply(`${message} Ask a moderator directly in #general for now.`);
    return;
  }

  await thread.members.add(member.id).catch(() => undefined);

  const moderator = findRole(guild, 'moderator');
  const intro = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(`Ticket #${String(number).padStart(4, '0')}`)
    .setDescription(
      [
        `Opened by <@${member.id}>.`,
        '',
        'Describe the problem in one message: what happened, when, and a message link if there is one.',
        'A moderator will answer here. Press **Close ticket** when it is resolved.',
      ].join('\n'),
    )
    .setFooter({ text: BRAND.footer })
    .setTimestamp(new Date());

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(TICKET_CLOSE_BUTTON)
      .setLabel('Close ticket')
      .setStyle(ButtonStyle.Secondary),
  );

  await thread.send({
    // Pinging the role is what actually pulls staff into a private thread.
    ...(moderator ? { content: `<@&${moderator.id}>` } : {}),
    embeds: [intro],
    components: [row],
    allowedMentions: moderator ? { roles: [moderator.id] } : { parse: [] },
  });

  state.update((current) => {
    current.tickets[thread.id] = {
      threadId: thread.id,
      openerId: member.id,
      subject: name,
      openedAt: new Date().toISOString(),
    };
  });

  logger.info('MODERATION', `Ticket #${number} opened by ${member.user.tag}`);
  await interaction.editReply(`Ticket opened: <#${thread.id}>`);
}

/**
 * Closes a ticket: archived and locked, never deleted. The record is the
 * point — an appeal six weeks later needs the original conversation.
 */
export async function closeTicket(
  guild: Guild,
  thread: ThreadChannel,
  closedBy: GuildMember,
  reason?: string,
): Promise<void> {
  const ticket = state.read().tickets[thread.id];
  if (!ticket) throw new OperationalError('This thread is not a ticket.');
  if (ticket.closedAt) throw new OperationalError('This ticket is already closed.');

  const isOwner = ticket.openerId === closedBy.id;
  const isStaff = staffCanClose(closedBy);
  if (!isOwner && !isStaff) {
    throw new OperationalError('Only the person who opened this ticket, or a moderator, can close it.');
  }

  await thread.send({
    embeds: [
      new EmbedBuilder()
        .setColor(COLORS.neutral)
        .setDescription(
          `Closed by <@${closedBy.id}>.${reason ? `\n\n**Reason:** ${truncate(reason, 500)}` : ''}`,
        )
        .setFooter({ text: `${BRAND.footer} · archived, not deleted` })
        .setTimestamp(new Date()),
    ],
  });

  state.update((current) => {
    const stored = current.tickets[thread.id];
    if (stored) {
      stored.closedAt = new Date().toISOString();
      stored.closedById = closedBy.id;
    }
  });

  await thread.setLocked(true, `Ticket closed by ${closedBy.user.tag}`).catch(() => undefined);
  await thread.setArchived(true, `Ticket closed by ${closedBy.user.tag}`).catch(() => undefined);

  logger.info('MODERATION', `Ticket ${ticket.subject} closed by ${closedBy.user.tag}`);
  await recordModeration(guild, {
    action: 'TICKET',
    moderator: closedBy.user,
    detail: `closed ${ticket.subject}`,
    ...(reason ? { reason } : {}),
  });
}

export async function handleCloseButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;

  const thread = interaction.channel;
  if (!thread?.isThread()) {
    await interaction.reply({
      content: 'That button only works inside a ticket.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id);
  await closeTicket(interaction.guild, thread, member);
  await interaction.reply({ content: 'Ticket closed and archived.', flags: MessageFlags.Ephemeral });
}

function staffCanClose(member: GuildMember): boolean {
  for (const key of ['moderator', 'admin', 'founder'] as const) {
    const role = findRole(member.guild, key);
    if (role && member.roles.cache.has(role.id)) return true;
  }
  return member.id === member.guild.ownerId;
}

function openTicketFor(userId: string) {
  return Object.values(state.read().tickets).find(
    (ticket) => ticket.openerId === userId && !ticket.closedAt,
  );
}

function nextTicketNumber(): number {
  let next = 0;
  state.update((current) => {
    current.ticketCounter += 1;
    next = current.ticketCounter;
  });
  return next;
}
