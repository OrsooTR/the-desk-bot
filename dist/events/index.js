"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerEventHandlers = registerEventHandlers;
const discord_js_1 = require("discord.js");
const logger_1 = require("../services/logger");
const autoModExecution_1 = require("./autoModExecution");
const guildMemberAdd_1 = require("./guildMemberAdd");
const interactionCreate_1 = require("./interactionCreate");
const voiceRooms_1 = require("../services/voiceRooms");
const protection_1 = require("./protection");
const ready_1 = require("./ready");
/**
 * Wires every gateway listener.
 *
 * Each handler is wrapped so a thrown error is logged instead of surfacing as
 * an unhandled rejection: one bad interaction must never take the process down.
 */
function registerEventHandlers(client) {
    client.once(discord_js_1.Events.ClientReady, (ready) => {
        void guard('ready', () => (0, ready_1.onReady)(ready));
    });
    client.on(discord_js_1.Events.InteractionCreate, (interaction) => {
        void guard('interactionCreate', () => (0, interactionCreate_1.onInteractionCreate)(interaction));
    });
    client.on(discord_js_1.Events.GuildMemberAdd, (member) => {
        void guard('guildMemberAdd', () => (0, guildMemberAdd_1.onGuildMemberAdd)(member));
    });
    client.on(discord_js_1.Events.VoiceStateUpdate, (before, after) => {
        void guard('voiceStateUpdate', () => (0, voiceRooms_1.onVoiceStateUpdate)(before, after));
    });
    client.on(discord_js_1.Events.AutoModerationActionExecution, (execution) => {
        void guard('autoModerationActionExecution', () => (0, autoModExecution_1.onAutoModerationActionExecution)(execution));
    });
    client.on(discord_js_1.Events.Error, (error) => {
        logger_1.logger.error('ERROR', 'Discord client error', error);
    });
    client.on(discord_js_1.Events.Warn, (message) => {
        logger_1.logger.warn('BOOT', `Discord client warning: ${message}`, { discord: false });
    });
    (0, protection_1.registerProtectionHandlers)(client);
}
async function guard(name, run) {
    try {
        await run();
    }
    catch (error) {
        logger_1.logger.error('ERROR', `Handler "${name}" threw`, error);
    }
}
//# sourceMappingURL=index.js.map