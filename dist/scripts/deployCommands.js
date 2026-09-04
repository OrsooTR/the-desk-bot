"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("../config/env");
const commands_1 = require("../commands");
const deploy_1 = require("../core/deploy");
const errors_1 = require("../utils/errors");
/**
 * Standalone command registration: `npm run deploy`.
 *
 * The bot also registers on startup (AUTO_DEPLOY_COMMANDS). This script exists
 * for deployments where you want to push the command set without restarting
 * the running process.
 */
async function main() {
    const { token, clientId, guildId } = (0, env_1.env)();
    console.log(`Registering ${commands_1.registry.all().length} commands to guild ${guildId}…`);
    for (const command of commands_1.registry.all()) {
        console.log(`  /${command.data.name}  (${command.access}+)`);
    }
    const count = await (0, deploy_1.deployCommands)(token, clientId, guildId);
    console.log(`Done. ${count} commands registered.`);
}
main().catch((error) => {
    console.error('Command registration failed:');
    console.error((0, errors_1.describeError)(error));
    process.exit(1);
});
//# sourceMappingURL=deployCommands.js.map