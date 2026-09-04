import {
  ChannelType,
  EmbedBuilder,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  GuildScheduledEventStatus,
  type Guild,
  type GuildScheduledEvent,
  type User,
} from 'discord.js';
import { BRAND, COLORS } from '../config/branding';
import type { EventPreset } from '../config/events';
import { SERVER } from '../config/server';
import { OperationalError } from '../utils/errors';
import { timestamp, truncate } from '../utils/format';
import { logger } from './logger';
import { findSessionChannel, findTextChannel } from './resolve';
import { state } from './state';

/* ────────────────────────────────────────────────────────────
 * Events
 *
 * Native Discord Scheduled Events are the source of truth: members get RSVPs,
 * mobile reminders and the event surface at the top of the server for free,
 * and nothing has to be re-implemented. The announcement embed in #events is
 * a companion to it, not a replacement — it carries the agenda and gives the
 * session a thread to collect questions in.
 * ──────────────────────────────────────────────────────────── */

export interface CreateEventInput {
  preset: EventPreset;
  start: Date;
  host: User;
  /** Optional override for the preset title. */
  title?: string;
  /** Extra context appended to the description. */
  notes?: string;
  durationMinutes?: number;
}

export interface CreateEventResult {
  event: GuildScheduledEvent;
  announcementUrl: string | null;
}

/** Discord's own limits, enforced before the API rejects us. */
const NAME_LIMIT = 100;
const DESCRIPTION_LIMIT = 1000;

export async function createEvent(
  guild: Guild,
  input: CreateEventInput,
): Promise<CreateEventResult> {
  const { preset, start, host } = input;

  if (start.getTime() <= Date.now()) {
    throw new OperationalError(
      'That start time is in the past.',
      'Times are interpreted as UTC. Use `YYYY-MM-DD` and `HH:mm`.',
    );
  }

  const venue = findSessionChannel(guild, preset.venueChannelKey);
  if (!venue) {
    throw new OperationalError(
      'The voice or stage channel for this session does not exist.',
      'Run `/setup` to restore the missing channel, then try again.',
    );
  }

  // Discord models a stage session differently from a voice session, and
  // rejects the wrong entity type outright.
  const entityType =
    venue.type === ChannelType.GuildStageVoice
      ? GuildScheduledEventEntityType.StageInstance
      : GuildScheduledEventEntityType.Voice;

  const durationMinutes = input.durationMinutes ?? preset.durationMinutes;
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const title = truncate(input.title?.trim() || preset.title, NAME_LIMIT);

  const description = truncate(
    [preset.summary, '', ...preset.agenda.map((item) => `• ${item}`), input.notes ? `\n${input.notes}` : '']
      .filter((part) => part !== '')
      .join('\n'),
    DESCRIPTION_LIMIT,
  );

  const event = await guild.scheduledEvents.create({
    name: title,
    description,
    scheduledStartTime: start,
    scheduledEndTime: end,
    privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
    entityType,
    channel: venue.id,
    reason: `Scheduled by ${host.tag}`,
  });

  logger.info('EVENT', `Created scheduled event: ${title} at ${start.toISOString()}`);

  const announcementUrl = await announce(guild, {
    event,
    preset,
    title,
    start,
    end,
    host,
    voiceName: venue.name,
    notes: input.notes,
  });

  return { event, announcementUrl };
}

interface AnnounceInput {
  event: GuildScheduledEvent;
  preset: EventPreset;
  title: string;
  start: Date;
  end: Date;
  host: User;
  voiceName: string;
  notes?: string;
}

async function announce(guild: Guild, input: AnnounceInput): Promise<string | null> {
  const channel = findTextChannel(guild, SERVER.eventsChannelKey);
  if (!channel) {
    logger.warn('EVENT', 'No events channel — the scheduled event was created without an announcement.');
    return null;
  }

  const embed = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(input.title.toUpperCase())
    .setDescription(input.preset.summary)
    .addFields(
      { name: 'WHEN', value: `${timestamp(input.start, 'F')}\n${timestamp(input.start, 'R')}`, inline: true },
      {
        name: 'DURATION',
        value: `${Math.round((input.end.getTime() - input.start.getTime()) / 60_000)} minutes`,
        inline: true,
      },
      { name: 'WHERE', value: input.voiceName, inline: true },
      { name: 'HOST', value: `<@${input.host.id}>`, inline: true },
      { name: 'AGENDA', value: input.preset.agenda.map((item) => `• ${item}`).join('\n') },
    )
    .setFooter({ text: `${BRAND.footer} · RSVP through the event above the channel list` })
    .setTimestamp(input.start);

  if (input.notes) embed.addFields({ name: 'NOTES', value: truncate(input.notes, 1024) });

  const message = await channel.send({
    content: input.event.url,
    embeds: [embed],
  });

  state.rememberMessage(announcementKey(input.event.id), channel.id, message.id);

  // A thread per session: questions in advance, notes afterwards.
  try {
    await message.startThread({
      name: truncate(input.title, NAME_LIMIT),
      autoArchiveDuration: 10080,
      reason: 'Discussion thread for a scheduled session',
    });
  } catch {
    logger.debug('EVENT', 'Could not open a discussion thread for the announcement.');
  }

  return message.url;
}

/** Upcoming and in-progress events, soonest first. */
export async function listEvents(guild: Guild): Promise<GuildScheduledEvent[]> {
  const events = await guild.scheduledEvents.fetch();
  return [...events.values()]
    .filter(
      (event) =>
        event.status === GuildScheduledEventStatus.Scheduled ||
        event.status === GuildScheduledEventStatus.Active,
    )
    .sort((a, b) => (a.scheduledStartTimestamp ?? 0) - (b.scheduledStartTimestamp ?? 0));
}

export async function cancelEvent(
  guild: Guild,
  eventId: string,
  actor: User,
  reason?: string,
): Promise<GuildScheduledEvent> {
  const event = await guild.scheduledEvents.fetch(eventId).catch(() => null);
  if (!event) throw new OperationalError('No scheduled event with that ID exists in this server.');

  if (event.status === GuildScheduledEventStatus.Completed)
    throw new OperationalError('That session has already finished.');
  if (event.status === GuildScheduledEventStatus.Canceled)
    throw new OperationalError('That session is already cancelled.');

  // Discord only allows Scheduled → Canceled. An event already running has to
  // be completed instead, which is the honest outcome anyway.
  const target =
    event.status === GuildScheduledEventStatus.Active
      ? GuildScheduledEventStatus.Completed
      : GuildScheduledEventStatus.Canceled;

  const updated = await event.setStatus(target, `Cancelled by ${actor.tag}`);
  logger.info('EVENT', `Cancelled scheduled event: ${event.name} (by ${actor.tag})`);

  await postCancellation(guild, event.name, actor, reason);
  return updated;
}

async function postCancellation(
  guild: Guild,
  name: string,
  actor: User,
  reason?: string,
): Promise<void> {
  const channel = findTextChannel(guild, SERVER.eventsChannelKey);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(COLORS.danger)
    .setTitle(`CANCELLED — ${name.toUpperCase()}`)
    .setDescription(reason?.trim() || 'This session will not take place.')
    .setFooter({ text: `${BRAND.footer} · cancelled by ${actor.tag}` })
    .setTimestamp(new Date());

  await channel.send({ embeds: [embed] }).catch(() => {
    logger.warn('EVENT', 'Could not post the cancellation notice.');
  });
}

function announcementKey(eventId: string): string {
  return `event:${eventId}`;
}
