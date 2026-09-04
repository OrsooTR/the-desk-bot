import { Client, GatewayIntentBits, Options, Partials } from 'discord.js';
import { PRESENCE } from '../config/branding';

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
export function createClient(): Client {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.AutoModerationExecution,
      GatewayIntentBits.GuildVoiceStates,
    ],
    partials: [Partials.GuildMember],
    // Sent with the gateway identify, so the member list shows the right
    // status from the first second rather than a plain "online".
    presence: {
      status: PRESENCE.status,
      activities: [{ name: PRESENCE.activity.name, type: PRESENCE.activity.type }],
    },
    // Message history is fetched on demand by /clear; caching it would hold
    // megabytes of content the bot has no other use for.
    makeCache: Options.cacheWithLimits({
      ...Options.DefaultMakeCacheSettings,
      MessageManager: 0,
      PresenceManager: 0,
    }),
  });
}
