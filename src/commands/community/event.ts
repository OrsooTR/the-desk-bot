import {
  EmbedBuilder,
  GuildScheduledEventStatus,
  MessageFlags,
  SlashCommandBuilder,
  type AutocompleteInteraction,
} from 'discord.js';
import { BRAND, COLORS } from '../../config/branding';
import { EVENT_PRESETS, findPreset } from '../../config/events';
import type { Command, CommandContext } from '../../core/command';
import { assertAccess } from '../../permissions/guards';
import { cancelEvent, createEvent, listEvents } from '../../services/eventService';
import { OperationalError } from '../../utils/errors';
import { parseUtcDateTime, timestamp, truncate } from '../../utils/format';

/**
 * /event — create, list and cancel community sessions.
 *
 * Creation and cancellation require Mentor or above; listing is open to
 * everyone, because a member should never need permission to find out when
 * the next session is.
 */
export const eventCommand: Command = {
  access: 'everyone',
  // Deferred per subcommand: `list` answers publicly, the rest privately.
  defer: 'none',
  data: new SlashCommandBuilder()
    .setName('event')
    .setDescription('Community sessions: create, list, cancel.')
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Schedule a session and announce it. Mentor+.')
        .addStringOption((option) =>
          option
            .setName('type')
            .setDescription('Which recurring format this session is')
            .setRequired(true)
            .addChoices(
              ...EVENT_PRESETS.map((preset) => ({ name: preset.title, value: preset.key })),
            ),
        )
        .addStringOption((option) =>
          option.setName('date').setDescription('Start date, UTC — YYYY-MM-DD').setRequired(true),
        )
        .addStringOption((option) =>
          option.setName('time').setDescription('Start time, UTC — HH:mm').setRequired(true),
        )
        .addUserOption((option) =>
          option.setName('host').setDescription('Who is hosting (default: you)'),
        )
        .addStringOption((option) =>
          option.setName('title').setDescription('Override the default title'),
        )
        .addStringOption((option) =>
          option.setName('notes').setDescription('Extra context for the announcement'),
        )
        .addIntegerOption((option) =>
          option
            .setName('duration')
            .setDescription('Length in minutes (default: the format’s usual length)')
            .setMinValue(15)
            .setMaxValue(480),
        ),
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('Show upcoming sessions.'))
    .addSubcommand((sub) =>
      sub
        .setName('cancel')
        .setDescription('Cancel a scheduled session. Mentor+.')
        .addStringOption((option) =>
          option
            .setName('event')
            .setDescription('The session to cancel')
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addStringOption((option) =>
          option.setName('reason').setDescription('Shown in the cancellation notice'),
        ),
    ),

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) return void interaction.respond([]);

    const events = await listEvents(interaction.guild).catch(() => []);
    const query = interaction.options.getFocused().toLowerCase();

    await interaction.respond(
      events
        .filter((event) => event.name.toLowerCase().includes(query))
        .slice(0, 25)
        .map((event) => ({
          name: truncate(
            `${event.name} — ${event.scheduledStartAt?.toISOString().slice(0, 16).replace('T', ' ') ?? 'unscheduled'}`,
            100,
          ),
          value: event.id,
        })),
    );
  },

  async execute(context: CommandContext): Promise<void> {
    const subcommand = context.interaction.options.getSubcommand();

    switch (subcommand) {
      case 'create':
        return runCreate(context);
      case 'list':
        return runList(context);
      case 'cancel':
        return runCancel(context);
      default:
        throw new OperationalError(`Unknown subcommand: ${subcommand}`);
    }
  },
};

async function runCreate({ interaction, guild, member }: CommandContext): Promise<void> {
  assertAccess(member, 'mentor', 'event create');
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const presetKey = interaction.options.getString('type', true);
  const preset = findPreset(presetKey);
  if (!preset) throw new OperationalError('That session format no longer exists in the configuration.');

  const start = parseUtcDateTime(
    interaction.options.getString('date', true),
    interaction.options.getString('time', true),
  );
  if (!start) {
    throw new OperationalError(
      'I could not read that date and time.',
      'Use `YYYY-MM-DD` for the date and `HH:mm` for the time. Both are UTC.',
    );
  }

  const host = interaction.options.getUser('host') ?? member.user;
  const title = interaction.options.getString('title');
  const notes = interaction.options.getString('notes');
  const duration = interaction.options.getInteger('duration');

  const { event, announcementUrl } = await createEvent(guild, {
    preset,
    start,
    host,
    ...(title ? { title } : {}),
    ...(notes ? { notes } : {}),
    ...(duration ? { durationMinutes: duration } : {}),
  });

  await interaction.editReply(
    [
      `Scheduled **${event.name}** for ${timestamp(start, 'F')}.`,
      announcementUrl ? `Announcement: ${announcementUrl}` : 'No events channel — nothing was announced.',
      event.url,
    ].join('\n'),
  );
}

async function runList({ interaction, guild }: CommandContext): Promise<void> {
  // Public on purpose: the schedule is worth showing the whole channel.
  await interaction.deferReply();
  const events = await listEvents(guild);

  const embed = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(`${BRAND.name} — UPCOMING SESSIONS`)
    .setFooter({ text: BRAND.footer })
    .setTimestamp(new Date());

  if (events.length === 0) {
    embed.setDescription('Nothing scheduled. Ask a Mentor to put something on the calendar.');
  } else {
    embed.setDescription(
      events
        .slice(0, 10)
        .map((event) => {
          const when = event.scheduledStartAt ? timestamp(event.scheduledStartAt, 'F') : 'time TBC';
          const relative = event.scheduledStartAt ? ` (${timestamp(event.scheduledStartAt, 'R')})` : '';
          const live = event.status === GuildScheduledEventStatus.Active ? ' — **live now**' : '';
          return `**${event.name}**${live}\n${when}${relative}\n${event.url}`;
        })
        .join('\n\n'),
    );
  }

  await interaction.editReply({ embeds: [embed] });
}

async function runCancel({ interaction, guild, member }: CommandContext): Promise<void> {
  assertAccess(member, 'mentor', 'event cancel');
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const eventId = interaction.options.getString('event', true);
  const reason = interaction.options.getString('reason') ?? undefined;

  const event = await cancelEvent(guild, eventId, member.user, reason);
  await interaction.editReply({
    content: `Cancelled **${event.name}**. A notice was posted in the events channel.`,
    flags: MessageFlags.SuppressEmbeds,
  });
}
