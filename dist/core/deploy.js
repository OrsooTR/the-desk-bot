"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deployCommands = deployCommands;
const discord_js_1 = require("discord.js");
const commands_1 = require("../commands");
const logger_1 = require("../services/logger");
/**
 * Registers the command set to a single guild.
 *
 * Guild-scoped rather than global: guild commands propagate instantly, which
 * matters when you are iterating, and this bot is built for one server. Moving
 * to global registration is a one-line change to the route below.
 */
async function deployCommands(token, clientId, guildId) {
    const rest = new discord_js_1.REST({ version: '10' }).setToken(token);
    const body = commands_1.registry.toJSON();
    await rest.put(discord_js_1.Routes.applicationGuildCommands(clientId, guildId), { body });
    logger_1.logger.info('BOOT', `Registered ${body.length} slash commands to guild ${guildId}`, {
        discord: false,
    });
    return body.length;
}
//# sourceMappingURL=deploy.js.map