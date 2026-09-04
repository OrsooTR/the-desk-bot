"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onReady = onReady;
const env_1 = require("../config/env");
const server_1 = require("../config/server");
const deploy_1 = require("../core/deploy");
const logger_1 = require("../services/logger");
const resolve_1 = require("../services/resolve");
const scheduler_1 = require("../services/scheduler");
const voiceRooms_1 = require("../services/voiceRooms");
/**
 * Startup. Anything that must be true before the bot is useful is checked
 * here, and reported clearly rather than failing later inside a command.
 */
async function onReady(client) {
    const { guildId, clientId, token, autoDeployCommands } = (0, env_1.env)();
    logger_1.logger.attach(client, guildId);
    logger_1.logger.info('BOOT', `Logged in as ${client.user.tag}`, { discord: false });
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
        logger_1.logger.error('BOOT', `I am not a member of guild ${guildId}. Check GUILD_ID, or invite the bot.`);
        return;
    }
    if (autoDeployCommands) {
        try {
            await (0, deploy_1.deployCommands)(token, clientId, guildId);
        }
        catch (error) {
            logger_1.logger.error('BOOT', 'Slash command registration failed', error);
        }
    }
    const fullGuild = await guild.fetch();
    await fullGuild.channels.fetch();
    await (0, voiceRooms_1.sweepOrphanedRooms)(fullGuild);
    (0, scheduler_1.startScheduler)(client);
    const hasStructure = (0, resolve_1.findLogChannel)(fullGuild) !== null;
    logger_1.logger.info('BOOT', hasStructure
        ? `Connected to ${fullGuild.name}. Structure detected.`
        : `Connected to ${fullGuild.name}. No #${server_1.SERVER.logChannelKey} yet — run /setup to provision the server.`);
}
//# sourceMappingURL=ready.js.map