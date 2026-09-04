"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onInteractionCreate = onInteractionCreate;
const discord_js_1 = require("discord.js");
const branding_1 = require("../config/branding");
const content_1 = require("../config/content");
const commands_1 = require("../commands");
const guards_1 = require("../permissions/guards");
const logger_1 = require("../services/logger");
const selfRoles_1 = require("../config/selfRoles");
const membership_1 = require("../services/membership");
const selfRoleService_1 = require("../services/selfRoleService");
const tickets_1 = require("../services/tickets");
const errors_1 = require("../utils/errors");
/**
 * The single entry point for every interaction.
 *
 * Cross-cutting concerns live here, not in the commands: guild narrowing,
 * authorisation, deferral, error translation and logging. A command handler
 * can therefore be written as if nothing goes wrong, and throw an
 * OperationalError when something does.
 */
async function onInteractionCreate(interaction) {
    try {
        if (interaction.isAutocomplete()) {
            const command = commands_1.registry.get(interaction.commandName);
            await command?.autocomplete?.(interaction);
            return;
        }
        if (interaction.isStringSelectMenu()) {
            if ((0, selfRoles_1.groupFor)(interaction.customId))
                await (0, selfRoleService_1.handleSelfRoleSelect)(interaction);
            return;
        }
        if (interaction.isButton()) {
            switch (interaction.customId) {
                case content_1.VERIFICATION.customId:
                    await (0, membership_1.handleVerification)(interaction);
                    return;
                case tickets_1.TICKET_OPEN_BUTTON:
                    await (0, tickets_1.openTicket)(interaction);
                    return;
                case tickets_1.TICKET_CLOSE_BUTTON:
                    await (0, tickets_1.handleCloseButton)(interaction);
                    return;
                case selfRoles_1.FUNDED_REQUEST_BUTTON:
                    await (0, selfRoleService_1.handleFundedRequest)(interaction);
                    return;
                default:
                    return;
            }
        }
        if (interaction.isChatInputCommand()) {
            await runCommand(interaction);
        }
    }
    catch (error) {
        logger_1.logger.error('ERROR', `Unhandled interaction failure: ${interaction.type}`, error);
    }
}
async function runCommand(interaction) {
    const command = commands_1.registry.get(interaction.commandName);
    if (!command) {
        // Usually a stale command left over from a previous deploy.
        logger_1.logger.warn('COMMAND', `Received an unknown command: /${interaction.commandName}`);
        await safeReply(interaction, 'That command is no longer available.');
        return;
    }
    if (!interaction.inCachedGuild()) {
        await safeReply(interaction, 'This command only works inside the server.');
        return;
    }
    const started = Date.now();
    try {
        (0, guards_1.assertAccess)(interaction.member, command.access, interaction.commandName);
        if (command.defer === 'public')
            await interaction.deferReply();
        else if (command.defer !== 'none')
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        await command.execute({
            interaction,
            guild: interaction.guild,
            member: interaction.member,
        });
        logger_1.logger.debug('COMMAND', `/${interaction.commandName} by ${interaction.user.tag} — ${Date.now() - started}ms`, { discord: false });
    }
    catch (error) {
        await reportFailure(interaction, error);
    }
}
async function reportFailure(interaction, error) {
    const { message, hint } = (0, errors_1.toUserMessage)(error);
    // Expected refusals are noise at error level; genuine faults are not.
    if (error instanceof errors_1.OperationalError) {
        logger_1.logger.debug('COMMAND', `/${interaction.commandName} refused: ${message}`, { discord: false });
    }
    else {
        logger_1.logger.error('COMMAND', `/${interaction.commandName} failed for ${interaction.user.tag}`, error);
    }
    const embed = new discord_js_1.EmbedBuilder().setColor(branding_1.COLORS.danger).setDescription(message);
    if (hint)
        embed.setFooter({ text: hint });
    await safeReply(interaction, { embeds: [embed] });
}
/**
 * Reply through whichever channel is still open.
 *
 * An interaction can be un-answered, deferred or already replied to, and each
 * needs a different call. Getting this wrong is the classic cause of a bot
 * that silently swallows its own errors.
 */
async function safeReply(interaction, payload) {
    const body = typeof payload === 'string' ? { content: payload } : payload;
    try {
        if (interaction.deferred) {
            await interaction.editReply(body);
        }
        else if (interaction.replied) {
            await interaction.followUp({ ...body, flags: discord_js_1.MessageFlags.Ephemeral });
        }
        else {
            await interaction.reply({ ...body, flags: discord_js_1.MessageFlags.Ephemeral });
        }
    }
    catch (error) {
        logger_1.logger.error('ERROR', 'Could not deliver a response to the interaction', error);
    }
}
//# sourceMappingURL=interactionCreate.js.map