import { CommandRegistry, type Command } from '../core/command';
import { serverStatusCommand } from './admin/serverStatus';
import { setupCommand } from './admin/setup';
import { setupDryRunCommand } from './admin/setupDryRun';
import { eventCommand } from './community/event';
import { faqCommand } from './community/faq';
import { resourcesCommand } from './community/resources';
import { reviewCommand } from './community/review';
import { newsCommand } from './community/news';
import { ticketCommand } from './community/ticket';
import { banCommand } from './moderation/ban';
import { clearCommand } from './moderation/clear';
import { fundedCommand } from './moderation/funded';
import { kickCommand } from './moderation/kick';
import { timeoutCommand } from './moderation/timeout';
import { warnCommand } from './moderation/warn';
import { warningsCommand } from './moderation/warnings';

/**
 * Every command the bot exposes.
 *
 * Adding one is a two-line change: implement it, then list it here. The
 * registry validates for duplicate names at construction, and both the
 * dispatcher and the deploy script read from this single list — they cannot
 * drift apart.
 */
export const COMMANDS: Command[] = [
  // Administration
  setupCommand,
  setupDryRunCommand,
  serverStatusCommand,

  // Moderation
  warnCommand,
  warningsCommand,
  fundedCommand,
  clearCommand,
  kickCommand,
  banCommand,
  timeoutCommand,

  // Community
  eventCommand,
  reviewCommand,
  resourcesCommand,
  faqCommand,
  ticketCommand,
  newsCommand,
];

export const registry = new CommandRegistry(COMMANDS);
