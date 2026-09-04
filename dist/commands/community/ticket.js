"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ticketCommand = void 0;
const discord_js_1 = require("discord.js");
const tickets_1 = require("../../services/tickets");
const errors_1 = require("../../utils/errors");
/**
 * /ticket close — the command form of the Close button.
 *
 * Opening happens through the panel button in the support channel, not here:
 * a button in the right place is easier to find than a command you have to
 * know exists.
 */
exports.ticketCommand = {
    access: 'everyone',
    defer: 'ephemeral',
    data: new discord_js_1.SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Manage a support ticket.')
        .setDMPermission(false)
        .addSubcommand((sub) => sub
        .setName('close')
        .setDescription('Close the ticket you are currently in')
        .addStringOption((option) => option.setName('reason').setDescription('Optional note for the record'))),
    async execute({ interaction, guild, member }) {
        const thread = interaction.channel;
        if (!thread?.isThread()) {
            throw new errors_1.OperationalError('Run this inside the ticket you want to close.', 'Tickets are opened with the button in the support channel.');
        }
        const reason = interaction.options.getString('reason') ?? undefined;
        await (0, tickets_1.closeTicket)(guild, thread, member, reason);
        await interaction.editReply('Ticket closed and archived.');
    },
};
//# sourceMappingURL=ticket.js.map