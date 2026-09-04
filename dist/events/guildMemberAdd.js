"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onGuildMemberAdd = onGuildMemberAdd;
const env_1 = require("../config/env");
const membership_1 = require("../services/membership");
const logger_1 = require("../services/logger");
/**
 * Assign the join role. Requires the Server Members privileged intent —
 * without it this event never fires and new members land with no roles at all,
 * which is why the README makes it a hard requirement rather than a suggestion.
 */
async function onGuildMemberAdd(member) {
    if (member.guild.id !== (0, env_1.env)().guildId)
        return;
    try {
        await (0, membership_1.assignJoinRole)(member);
    }
    catch (error) {
        logger_1.logger.error('MEMBER', `Failed to process the join of ${member.user.tag}`, error);
    }
}
//# sourceMappingURL=guildMemberAdd.js.map