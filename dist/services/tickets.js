"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TICKET_CLOSE_BUTTON = exports.TICKET_OPEN_BUTTON = void 0;
exports.ticketPanel = ticketPanel;
exports.openTicket = openTicket;
exports.closeTicket = closeTicket;
exports.handleCloseButton = handleCloseButton;
const discord_js_1 = require("discord.js");
const branding_1 = require("../config/branding");
const server_1 = require("../config/server");
const errors_1 = require("../utils/errors");
const format_1 = require("../utils/format");
const logger_1 = require("./logger");
const moderationLog_1 = require("./moderationLog");
const resolve_1 = require("./resolve");
const state_1 = require("./state");
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
exports.TICKET_OPEN_BUTTON = 'desk:ticket:open';
exports.TICKET_CLOSE_BUTTON = 'desk:ticket:close';
/** The standing panel in #open-a-ticket. Republished idempotently by /setup. */
function ticketPanel() {
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(branding_1.COLORS.primary)
        .setTitle('OPEN A TICKET')
        .setDescription([
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
    ].join('\n'))
        .setFooter({ text: `${branding_1.BRAND.footer} · one ticket at a time, please` });
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(exports.TICKET_OPEN_BUTTON)
        .setLabel('Open a ticket')
        .setStyle(discord_js_1.ButtonStyle.Secondary));
    return { embeds: [embed], components: [row] };
}
/** Handles the panel button: creates the thread and brings staff in. */
async function openTicket(interaction) {
    if (!interaction.inCachedGuild())
        return;
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const guild = interaction.guild;
    const member = await guild.members.fetch(interaction.user.id);
    const existing = openTicketFor(member.id);
    if (existing) {
        await interaction.editReply(`You already have a ticket open: <#${existing.threadId}>. Continue there, or close it before opening another.`);
        return;
    }
    const channel = (0, resolve_1.findTextChannel)(guild, server_1.SERVER.ticketChannelKey);
    if (!channel || channel.type !== discord_js_1.ChannelType.GuildText) {
        throw new errors_1.OperationalError('The ticket channel is missing.', 'An admin should run `/setup` to restore it.');
    }
    const number = nextTicketNumber();
    const name = (0, format_1.truncate)(`ticket-${String(number).padStart(4, '0')} · ${member.displayName}`, 100);
    let thread;
    try {
        thread = await channel.threads.create({
            name,
            type: discord_js_1.ChannelType.PrivateThread,
            invitable: false,
            autoArchiveDuration: discord_js_1.ThreadAutoArchiveDuration.OneWeek,
            reason: `Ticket opened by ${member.user.tag}`,
        });
    }
    catch (error) {
        logger_1.logger.error('MODERATION', `Could not open a ticket for ${member.user.tag}`, error);
        const { message } = (0, errors_1.toUserMessage)(error);
        await interaction.editReply(`${message} Ask a moderator directly in #general for now.`);
        return;
    }
    await thread.members.add(member.id).catch(() => undefined);
    const moderator = (0, resolve_1.findRole)(guild, 'moderator');
    const intro = new discord_js_1.EmbedBuilder()
        .setColor(branding_1.COLORS.primary)
        .setTitle(`Ticket #${String(number).padStart(4, '0')}`)
        .setDescription([
        `Opened by <@${member.id}>.`,
        '',
        'Describe the problem in one message: what happened, when, and a message link if there is one.',
        'A moderator will answer here. Press **Close ticket** when it is resolved.',
    ].join('\n'))
        .setFooter({ text: branding_1.BRAND.footer })
        .setTimestamp(new Date());
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(exports.TICKET_CLOSE_BUTTON)
        .setLabel('Close ticket')
        .setStyle(discord_js_1.ButtonStyle.Secondary));
    await thread.send({
        // Pinging the role is what actually pulls staff into a private thread.
        ...(moderator ? { content: `<@&${moderator.id}>` } : {}),
        embeds: [intro],
        components: [row],
        allowedMentions: moderator ? { roles: [moderator.id] } : { parse: [] },
    });
    state_1.state.update((current) => {
        current.tickets[thread.id] = {
            threadId: thread.id,
            openerId: member.id,
            subject: name,
            openedAt: new Date().toISOString(),
        };
    });
    logger_1.logger.info('MODERATION', `Ticket #${number} opened by ${member.user.tag}`);
    await interaction.editReply(`Ticket opened: <#${thread.id}>`);
}
/**
 * Closes a ticket: archived and locked, never deleted. The record is the
 * point — an appeal six weeks later needs the original conversation.
 */
async function closeTicket(guild, thread, closedBy, reason) {
    const ticket = state_1.state.read().tickets[thread.id];
    if (!ticket)
        throw new errors_1.OperationalError('This thread is not a ticket.');
    if (ticket.closedAt)
        throw new errors_1.OperationalError('This ticket is already closed.');
    const isOwner = ticket.openerId === closedBy.id;
    const isStaff = staffCanClose(closedBy);
    if (!isOwner && !isStaff) {
        throw new errors_1.OperationalError('Only the person who opened this ticket, or a moderator, can close it.');
    }
    await thread.send({
        embeds: [
            new discord_js_1.EmbedBuilder()
                .setColor(branding_1.COLORS.neutral)
                .setDescription(`Closed by <@${closedBy.id}>.${reason ? `\n\n**Reason:** ${(0, format_1.truncate)(reason, 500)}` : ''}`)
                .setFooter({ text: `${branding_1.BRAND.footer} · archived, not deleted` })
                .setTimestamp(new Date()),
        ],
    });
    state_1.state.update((current) => {
        const stored = current.tickets[thread.id];
        if (stored) {
            stored.closedAt = new Date().toISOString();
            stored.closedById = closedBy.id;
        }
    });
    await thread.setLocked(true, `Ticket closed by ${closedBy.user.tag}`).catch(() => undefined);
    await thread.setArchived(true, `Ticket closed by ${closedBy.user.tag}`).catch(() => undefined);
    logger_1.logger.info('MODERATION', `Ticket ${ticket.subject} closed by ${closedBy.user.tag}`);
    await (0, moderationLog_1.recordModeration)(guild, {
        action: 'TICKET',
        moderator: closedBy.user,
        detail: `closed ${ticket.subject}`,
        ...(reason ? { reason } : {}),
    });
}
async function handleCloseButton(interaction) {
    if (!interaction.inCachedGuild())
        return;
    const thread = interaction.channel;
    if (!thread?.isThread()) {
        await interaction.reply({
            content: 'That button only works inside a ticket.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const member = await interaction.guild.members.fetch(interaction.user.id);
    await closeTicket(interaction.guild, thread, member);
    await interaction.reply({ content: 'Ticket closed and archived.', flags: discord_js_1.MessageFlags.Ephemeral });
}
function staffCanClose(member) {
    for (const key of ['moderator', 'admin', 'founder']) {
        const role = (0, resolve_1.findRole)(member.guild, key);
        if (role && member.roles.cache.has(role.id))
            return true;
    }
    return member.id === member.guild.ownerId;
}
function openTicketFor(userId) {
    return Object.values(state_1.state.read().tickets).find((ticket) => ticket.openerId === userId && !ticket.closedAt);
}
function nextTicketNumber() {
    let next = 0;
    state_1.state.update((current) => {
        current.ticketCounter += 1;
        next = current.ticketCounter;
    });
    return next;
}
//# sourceMappingURL=tickets.js.map