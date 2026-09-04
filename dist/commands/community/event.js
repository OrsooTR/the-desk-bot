"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventCommand = void 0;
const discord_js_1 = require("discord.js");
const branding_1 = require("../../config/branding");
const events_1 = require("../../config/events");
const guards_1 = require("../../permissions/guards");
const eventService_1 = require("../../services/eventService");
const errors_1 = require("../../utils/errors");
const format_1 = require("../../utils/format");
/**
 * /event — create, list and cancel community sessions.
 *
 * Creation and cancellation require Mentor or above; listing is open to
 * everyone, because a member should never need permission to find out when
 * the next session is.
 */
exports.eventCommand = {
    access: 'everyone',
    // Deferred per subcommand: `list` answers publicly, the rest privately.
    defer: 'none',
    data: new discord_js_1.SlashCommandBuilder()
        .setName('event')
        .setDescription('Community sessions: create, list, cancel.')
        .setDMPermission(false)
        .addSubcommand((sub) => sub
        .setName('create')
        .setDescription('Schedule a session and announce it. Mentor+.')
        .addStringOption((option) => option
        .setName('type')
        .setDescription('Which recurring format this session is')
        .setRequired(true)
        .addChoices(...events_1.EVENT_PRESETS.map((preset) => ({ name: preset.title, value: preset.key }))))
        .addStringOption((option) => option.setName('date').setDescription('Start date, UTC — YYYY-MM-DD').setRequired(true))
        .addStringOption((option) => option.setName('time').setDescription('Start time, UTC — HH:mm').setRequired(true))
        .addUserOption((option) => option.setName('host').setDescription('Who is hosting (default: you)'))
        .addStringOption((option) => option.setName('title').setDescription('Override the default title'))
        .addStringOption((option) => option.setName('notes').setDescription('Extra context for the announcement'))
        .addIntegerOption((option) => option
        .setName('duration')
        .setDescription('Length in minutes (default: the format’s usual length)')
        .setMinValue(15)
        .setMaxValue(480)))
        .addSubcommand((sub) => sub.setName('list').setDescription('Show upcoming sessions.'))
        .addSubcommand((sub) => sub
        .setName('cancel')
        .setDescription('Cancel a scheduled session. Mentor+.')
        .addStringOption((option) => option
        .setName('event')
        .setDescription('The session to cancel')
        .setRequired(true)
        .setAutocomplete(true))
        .addStringOption((option) => option.setName('reason').setDescription('Shown in the cancellation notice'))),
    async autocomplete(interaction) {
        if (!interaction.inCachedGuild())
            return void interaction.respond([]);
        const events = await (0, eventService_1.listEvents)(interaction.guild).catch(() => []);
        const query = interaction.options.getFocused().toLowerCase();
        await interaction.respond(events
            .filter((event) => event.name.toLowerCase().includes(query))
            .slice(0, 25)
            .map((event) => ({
            name: (0, format_1.truncate)(`${event.name} — ${event.scheduledStartAt?.toISOString().slice(0, 16).replace('T', ' ') ?? 'unscheduled'}`, 100),
            value: event.id,
        })));
    },
    async execute(context) {
        const subcommand = context.interaction.options.getSubcommand();
        switch (subcommand) {
            case 'create':
                return runCreate(context);
            case 'list':
                return runList(context);
            case 'cancel':
                return runCancel(context);
            default:
                throw new errors_1.OperationalError(`Unknown subcommand: ${subcommand}`);
        }
    },
};
async function runCreate({ interaction, guild, member }) {
    (0, guards_1.assertAccess)(member, 'mentor', 'event create');
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const presetKey = interaction.options.getString('type', true);
    const preset = (0, events_1.findPreset)(presetKey);
    if (!preset)
        throw new errors_1.OperationalError('That session format no longer exists in the configuration.');
    const start = (0, format_1.parseUtcDateTime)(interaction.options.getString('date', true), interaction.options.getString('time', true));
    if (!start) {
        throw new errors_1.OperationalError('I could not read that date and time.', 'Use `YYYY-MM-DD` for the date and `HH:mm` for the time. Both are UTC.');
    }
    const host = interaction.options.getUser('host') ?? member.user;
    const title = interaction.options.getString('title');
    const notes = interaction.options.getString('notes');
    const duration = interaction.options.getInteger('duration');
    const { event, announcementUrl } = await (0, eventService_1.createEvent)(guild, {
        preset,
        start,
        host,
        ...(title ? { title } : {}),
        ...(notes ? { notes } : {}),
        ...(duration ? { durationMinutes: duration } : {}),
    });
    await interaction.editReply([
        `Scheduled **${event.name}** for ${(0, format_1.timestamp)(start, 'F')}.`,
        announcementUrl ? `Announcement: ${announcementUrl}` : 'No events channel — nothing was announced.',
        event.url,
    ].join('\n'));
}
async function runList({ interaction, guild }) {
    // Public on purpose: the schedule is worth showing the whole channel.
    await interaction.deferReply();
    const events = await (0, eventService_1.listEvents)(guild);
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(branding_1.COLORS.primary)
        .setTitle(`${branding_1.BRAND.name} — UPCOMING SESSIONS`)
        .setFooter({ text: branding_1.BRAND.footer })
        .setTimestamp(new Date());
    if (events.length === 0) {
        embed.setDescription('Nothing scheduled. Ask a Mentor to put something on the calendar.');
    }
    else {
        embed.setDescription(events
            .slice(0, 10)
            .map((event) => {
            const when = event.scheduledStartAt ? (0, format_1.timestamp)(event.scheduledStartAt, 'F') : 'time TBC';
            const relative = event.scheduledStartAt ? ` (${(0, format_1.timestamp)(event.scheduledStartAt, 'R')})` : '';
            const live = event.status === discord_js_1.GuildScheduledEventStatus.Active ? ' — **live now**' : '';
            return `**${event.name}**${live}\n${when}${relative}\n${event.url}`;
        })
            .join('\n\n'));
    }
    await interaction.editReply({ embeds: [embed] });
}
async function runCancel({ interaction, guild, member }) {
    (0, guards_1.assertAccess)(member, 'mentor', 'event cancel');
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const eventId = interaction.options.getString('event', true);
    const reason = interaction.options.getString('reason') ?? undefined;
    const event = await (0, eventService_1.cancelEvent)(guild, eventId, member.user, reason);
    await interaction.editReply({
        content: `Cancelled **${event.name}**. A notice was posted in the events channel.`,
        flags: discord_js_1.MessageFlags.SuppressEmbeds,
    });
}
//# sourceMappingURL=event.js.map