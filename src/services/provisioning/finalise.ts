import type { Guild } from 'discord.js';
import { syncAutoMod } from '../automod';
import { publishCommunityContent } from '../content';
import { logger } from '../logger';
import {
  publishChannelGuides,
  publishFaq,
  publishGuildDescription,
  publishRolePanels,
} from '../publishing';
import type { SetupReport } from './types';

/**
 * Everything that happens after the structure exists.
 *
 * Kept out of the provisioner because it is a different kind of work: the
 * provisioner reconciles Discord *resources*, this fills them with content and
 * turns on the filters. Separating them means a content failure can never
 * leave the channel structure half-built.
 *
 * Every step is idempotent and every step is optional — a failure is recorded
 * as a warning and the rest continues.
 */
export async function finaliseSetup(
  guild: Guild,
  report: SetupReport,
  dryRun: boolean,
): Promise<void> {
  await step(report, 'welcome and rules', async () => {
    const results = await publishCommunityContent(guild, dryRun);
    return results.map((result) => ({
      key: result.key,
      status: result.status,
      ...(result.detail ? { detail: result.detail } : {}),
    }));
  });

  await step(report, 'channel guides', () => publishChannelGuides(guild, dryRun));
  await step(report, 'role panels', () => publishRolePanels(guild, dryRun));
  await step(report, 'FAQ', () => publishFaq(guild, dryRun));

  await step(report, 'server description', async () => [
    await publishGuildDescription(guild, dryRun),
  ]);

  await step(report, 'AutoMod rules', async () => {
    const outcomes = await syncAutoMod(guild, dryRun);
    return outcomes.map((outcome) => ({
      key: outcome.name,
      status: outcome.status,
      ...(outcome.detail ? { detail: outcome.detail } : {}),
    }));
  });
}

type StepResult = { key: string; status: string; detail?: string };

async function step(
  report: SetupReport,
  label: string,
  run: () => Promise<StepResult[]>,
): Promise<void> {
  try {
    const results = await run();

    const counts = new Map<string, number>();
    for (const result of results) counts.set(result.status, (counts.get(result.status) ?? 0) + 1);

    const summary = [...counts.entries()]
      .map(([status, count]) => `${count} ${status}`)
      .join(', ');
    report.notes.push(`${label}: ${summary || 'nothing to do'}`);

    // Anything skipped or failed needs a human to see the reason, not a count.
    for (const result of results) {
      if ((result.status === 'skipped' || result.status === 'failed') && result.detail) {
        report.warnings.push(`${label} — ${result.key}: ${result.detail}`);
      }
    }
  } catch (error) {
    report.warnings.push(`${label} could not be completed.`);
    logger.error('SETUP', `Finalisation step "${label}" failed`, error);
  }
}
