"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEvent = createEvent;
exports.listEvents = listEvents;
exports.cancelEvent = cancelEvent;
const discord_js_1 = require("discord.js");
const branding_1 = require("../config/branding");
const server_1 = require("../config/server");
const errors_1 = require("../utils/errors");
const format_1 = require("../utils/format");
const logger_1 = require("./logger");
const resolve_1 = require("./resolve");
const state_1 = require("./state");
/** Discord's own limits, enforced before the API rejects us. */
const NAME_LIMIT = 100;
const DESCRIPTION_LIMIT = 1000;
async function createEvent(guild, input) {
    const { preset, start, host } = input;
    if (start.getTime() <= Date.now()) {
        throw new errors_1.OperationalError('That start time is in the past.', 'Times are interpreted as UTC. Use `YYYY-MM-DD` and `HH:mm`.');
    }
    const venue = (0, resolve_1.findSessionChannel)(guild, preset.venueChannelKey);
    if (!venue) {
        throw new errors_1.OperationalError('The voice or stage channel for this session does not exist.', 'Run `/setup` to restore the missing channel, then try again.');
    }
    // Discord models a stage session differently from a voice session, and
    // rejects the wrong entity type outright.
    const entityType = venue.type === discord_js_1.ChannelType.GuildStageVoice
        ? discord_js_1.GuildScheduledEventEntityType.StageInstance
        : discord_js_1.GuildScheduledEventEntityType.Voice;
    const durationMinutes = input.durationMinutes ?? preset.durationMinutes;
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    const title = (0, format_1.truncate)(input.title?.trim() || preset.title, NAME_LIMIT);
    const description = (0, format_1.truncate)([preset.summary, '', ...preset.agenda.map((item) => `• ${item}`), input.notes ? `\n${input.notes}` : '']
        .filter((part) => part !== '')
        .join('\n'), DESCRIPTION_LIMIT);
    const event = await guild.scheduledEvents.create({
        name: title,
        description,
        scheduledStartTime: start,
        scheduledEndTime: end,
        privacyLevel: discord_js_1.GuildScheduledEventPrivacyLevel.GuildOnly,
        entityType,
        channel: venue.id,
        reason: `Scheduled by ${host.tag}`,
    });
    logger_1.logger.info('EVENT', `Created scheduled event: ${title} at ${start.toISOString()}`);
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
async function announce(guild, input) {
    const channel = (0, resolve_1.findTextChannel)(guild, server_1.SERVER.eventsChannelKey);
    if (!channel) {
        logger_1.logger.warn('EVENT', 'No events channel — the scheduled event was created without an announcement.');
        return null;
    }
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(branding_1.COLORS.primary)
        .setTitle(input.title.toUpperCase())
        .setDescription(input.preset.summary)
        .addFields({ name: 'WHEN', value: `${(0, format_1.timestamp)(input.start, 'F')}\n${(0, format_1.timestamp)(input.start, 'R')}`, inline: true }, {
        name: 'DURATION',
        value: `${Math.round((input.end.getTime() - input.start.getTime()) / 60_000)} minutes`,
        inline: true,
    }, { name: 'WHERE', value: input.voiceName, inline: true }, { name: 'HOST', value: `<@${input.host.id}>`, inline: true }, { name: 'AGENDA', value: input.preset.agenda.map((item) => `• ${item}`).join('\n') })
        .setFooter({ text: `${branding_1.BRAND.footer} · RSVP through the event above the channel list` })
        .setTimestamp(input.start);
    if (input.notes)
        embed.addFields({ name: 'NOTES', value: (0, format_1.truncate)(input.notes, 1024) });
    const message = await channel.send({
        content: input.event.url,
        embeds: [embed],
    });
    state_1.state.rememberMessage(announcementKey(input.event.id), channel.id, message.id);
    // A thread per session: questions in advance, notes afterwards.
    try {
        await message.startThread({
            name: (0, format_1.truncate)(input.title, NAME_LIMIT),
            autoArchiveDuration: 10080,
            reason: 'Discussion thread for a scheduled session',
        });
    }
    catch {
        logger_1.logger.debug('EVENT', 'Could not open a discussion thread for the announcement.');
    }
    return message.url;
}
/** Upcoming and in-progress events, soonest first. */
async function listEvents(guild) {
    const events = await guild.scheduledEvents.fetch();
    return [...events.values()]
        .filter((event) => event.status === discord_js_1.GuildScheduledEventStatus.Scheduled ||
        event.status === discord_js_1.GuildScheduledEventStatus.Active)
        .sort((a, b) => (a.scheduledStartTimestamp ?? 0) - (b.scheduledStartTimestamp ?? 0));
}
async function cancelEvent(guild, eventId, actor, reason) {
    const event = await guild.scheduledEvents.fetch(eventId).catch(() => null);
    if (!event)
        throw new errors_1.OperationalError('No scheduled event with that ID exists in this server.');
    if (event.status === discord_js_1.GuildScheduledEventStatus.Completed)
        throw new errors_1.OperationalError('That session has already finished.');
    if (event.status === discord_js_1.GuildScheduledEventStatus.Canceled)
        throw new errors_1.OperationalError('That session is already cancelled.');
    // Discord only allows Scheduled → Canceled. An event already running has to
    // be completed instead, which is the honest outcome anyway.
    const target = event.status === discord_js_1.GuildScheduledEventStatus.Active
        ? discord_js_1.GuildScheduledEventStatus.Completed
        : discord_js_1.GuildScheduledEventStatus.Canceled;
    const updated = await event.setStatus(target, `Cancelled by ${actor.tag}`);
    logger_1.logger.info('EVENT', `Cancelled scheduled event: ${event.name} (by ${actor.tag})`);
    await postCancellation(guild, event.name, actor, reason);
    return updated;
}
async function postCancellation(guild, name, actor, reason) {
    const channel = (0, resolve_1.findTextChannel)(guild, server_1.SERVER.eventsChannelKey);
    if (!channel)
        return;
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(branding_1.COLORS.danger)
        .setTitle(`CANCELLED — ${name.toUpperCase()}`)
        .setDescription(reason?.trim() || 'This session will not take place.')
        .setFooter({ text: `${branding_1.BRAND.footer} · cancelled by ${actor.tag}` })
        .setTimestamp(new Date());
    await channel.send({ embeds: [embed] }).catch(() => {
        logger_1.logger.warn('EVENT', 'Could not post the cancellation notice.');
    });
}
function announcementKey(eventId) {
    return `event:${eventId}`;
}
//# sourceMappingURL=eventService.js.map