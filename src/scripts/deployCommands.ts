import { env } from '../config/env';
import { registry } from '../commands';
import { deployCommands } from '../core/deploy';
import { describeError } from '../utils/errors';

/**
 * Standalone command registration: `npm run deploy`.
 *
 * The bot also registers on startup (AUTO_DEPLOY_COMMANDS). This script exists
 * for deployments where you want to push the command set without restarting
 * the running process.
 */
async function main(): Promise<void> {
  const { token, clientId, guildId } = env();

  console.log(`Registering ${registry.all().length} commands to guild ${guildId}…`);
  for (const command of registry.all()) {
    console.log(`  /${command.data.name}  (${command.access}+)`);
  }

  const count = await deployCommands(token, clientId, guildId);
  console.log(`Done. ${count} commands registered.`);
}

main().catch((error: unknown) => {
  console.error('Command registration failed:');
  console.error(describeError(error));
  process.exit(1);
});
