"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createClient = createClient;
const discord_js_1 = require("discord.js");
const branding_1 = require("../config/branding");
/**
 * The gateway client.
 *
 * Intents are the minimum the features actually need:
 *  - Guilds                    — channels, roles, scheduled events, and the
 *                                channel/role delete events the anti-nuke
 *                                watcher counts
 *  - GuildMembers              — join event and role assignment (PRIVILEGED)
 *  - GuildModeration           — ban events, also fed to the anti-nuke watcher
 *  - AutoModerationExecution   — so blocked messages land in #moderation
 *
 * Notably absent: MessageContent. The bot never reads message text, so it does
 * not ask for the permission to. /clear works through the REST API, and
 * AutoMod evaluates content on Discord's side, not ours.
 */
function createClient() {
    return new discord_js_1.Client({
        intents: [
            discord_js_1.GatewayIntentBits.Guilds,
            discord_js_1.GatewayIntentBits.GuildMembers,
            discord_js_1.GatewayIntentBits.GuildModeration,
            discord_js_1.GatewayIntentBits.AutoModerationExecution,
            discord_js_1.GatewayIntentBits.GuildVoiceStates,
        ],
        partials: [discord_js_1.Partials.GuildMember],
        // Sent with the gateway identify, so the member list shows the right
        // status from the first second rather than a plain "online".
        presence: {
            status: branding_1.PRESENCE.status,
            activities: [{ name: branding_1.PRESENCE.activity.name, type: branding_1.PRESENCE.activity.type }],
        },
        // Message history is fetched on demand by /clear; caching it would hold
        // megabytes of content the bot has no other use for.
        makeCache: discord_js_1.Options.cacheWithLimits({
            ...discord_js_1.Options.DefaultMakeCacheSettings,
            MessageManager: 0,
            PresenceManager: 0,
        }),
    });
}
//# sourceMappingURL=client.js.map