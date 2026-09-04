import {
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
  type Interaction,
} from 'discord.js';
import { COLORS } from '../config/branding';
import { VERIFICATION } from '../config/content';
import { registry } from '../commands';
import { assertAccess } from '../permissions/guards';
import { logger } from '../services/logger';
import { FUNDED_REQUEST_BUTTON, groupFor } from '../config/selfRoles';
import { handleVerification } from '../services/membership';
import { handleFundedRequest, handleSelfRoleSelect } from '../services/selfRoleService';
import {
  TICKET_CLOSE_BUTTON,
  TICKET_OPEN_BUTTON,
  handleCloseButton,
  openTicket,
} from '../services/tickets';
import { OperationalError, toUserMessage } from '../utils/errors';

/**
 * The single entry point for every interaction.
 *
 * Cross-cutting concerns live here, not in the commands: guild narrowing,
 * authorisation, deferral, error translation and logging. A command handler
 * can therefore be written as if nothing goes wrong, and throw an
 * OperationalError when something does.
 */
export async function onInteractionCreate(interaction: Interaction): Promise<void> {
  try {
    if (interaction.isAutocomplete()) {
      const command = registry.get(interaction.commandName);
      await command?.autocomplete?.(interaction);
      return;
    }

    if (interaction.isStringSelectMenu()) {
      if (groupFor(interaction.customId)) await handleSelfRoleSelect(interaction);
      return;
    }

    if (interaction.isButton()) {
      switch (interaction.customId) {
        case VERIFICATION.customId:
          await handleVerification(interaction);
          return;
        case TICKET_OPEN_BUTTON:
          await openTicket(interaction);
          return;
        case TICKET_CLOSE_BUTTON:
          await handleCloseButton(interaction);
          return;
        case FUNDED_REQUEST_BUTTON:
          await handleFundedRequest(interaction);
          return;
        default:
          return;
      }
    }

    if (interaction.isChatInputCommand()) {
      await runCommand(interaction);
    }
  } catch (error) {
    logger.error('ERROR', `Unhandled interaction failure: ${interaction.type}`, error);
  }
}

async function runCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const command = registry.get(interaction.commandName);

  if (!command) {
    // Usually a stale command left over from a previous deploy.
    logger.warn('COMMAND', `Received an unknown command: /${interaction.commandName}`);
    await safeReply(interaction, 'That command is no longer available.');
    return;
  }

  if (!interaction.inCachedGuild()) {
    await safeReply(interaction, 'This command only works inside the server.');
    return;
  }

  const started = Date.now();

  try {
    assertAccess(interaction.member, command.access, interaction.commandName);

    if (command.defer === 'public') await interaction.deferReply();
    else if (command.defer !== 'none')
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    await command.execute({
      interaction,
      guild: interaction.guild,
      member: interaction.member,
    });

    logger.debug(
      'COMMAND',
      `/${interaction.commandName} by ${interaction.user.tag} — ${Date.now() - started}ms`,
      { discord: false },
    );
  } catch (error) {
    await reportFailure(interaction, error);
  }
}

async function reportFailure(
  interaction: ChatInputCommandInteraction,
  error: unknown,
): Promise<void> {
  const { message, hint } = toUserMessage(error);

  // Expected refusals are noise at error level; genuine faults are not.
  if (error instanceof OperationalError) {
    logger.debug('COMMAND', `/${interaction.commandName} refused: ${message}`, { discord: false });
  } else {
    logger.error('COMMAND', `/${interaction.commandName} failed for ${interaction.user.tag}`, error);
  }

  const embed = new EmbedBuilder().setColor(COLORS.danger).setDescription(message);
  if (hint) embed.setFooter({ text: hint });

  await safeReply(interaction, { embeds: [embed] });
}

type ReplyPayload = string | { embeds: EmbedBuilder[] };

/**
 * Reply through whichever channel is still open.
 *
 * An interaction can be un-answered, deferred or already replied to, and each
 * needs a different call. Getting this wrong is the classic cause of a bot
 * that silently swallows its own errors.
 */
async function safeReply(
  interaction: ChatInputCommandInteraction,
  payload: ReplyPayload,
): Promise<void> {
  const body = typeof payload === 'string' ? { content: payload } : payload;

  try {
    if (interaction.deferred) {
      await interaction.editReply(body);
    } else if (interaction.replied) {
      await interaction.followUp({ ...body, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ ...body, flags: MessageFlags.Ephemeral });
    }
  } catch (error) {
    logger.error('ERROR', 'Could not deliver a response to the interaction', error);
  }
}
