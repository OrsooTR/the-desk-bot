import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  Guild,
  GuildMember,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import type { AccessLevel } from '../permissions/guards';

/**
 * Structural type satisfied by every discord.js slash command builder,
 * including the subcommand-only variants. Avoids threading a dozen builder
 * union types through the registry.
 */
export interface CommandData {
  readonly name: string;
  toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody;
}

/** Everything a command handler needs, already narrowed to the guild case. */
export interface CommandContext {
  interaction: ChatInputCommandInteraction;
  guild: Guild;
  member: GuildMember;
}

export interface Command {
  data: CommandData;
  /** Minimum role standing required. Enforced centrally before `execute`. */
  access: AccessLevel;
  /**
   * Commands that take a long time (setup, provisioning) should defer.
   * The dispatcher handles it so no handler has to remember.
   */
  defer?: 'none' | 'public' | 'ephemeral';
  execute(context: CommandContext): Promise<void>;
  autocomplete?(interaction: AutocompleteInteraction): Promise<void>;
}

export class CommandRegistry {
  private readonly commands = new Map<string, Command>();

  constructor(commands: Command[]) {
    for (const command of commands) {
      if (this.commands.has(command.data.name)) {
        throw new Error(`Duplicate command name registered: ${command.data.name}`);
      }
      this.commands.set(command.data.name, command);
    }
  }

  get(name: string): Command | undefined {
    return this.commands.get(name);
  }

  all(): Command[] {
    return [...this.commands.values()];
  }

  /** Payload for Discord's bulk command registration endpoint. */
  toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
    return this.all().map((command) => command.data.toJSON());
  }
}
