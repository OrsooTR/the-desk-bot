import { EmbedBuilder } from 'discord.js';
import { BRAND, COLORS } from '../../config/branding';
import { plural, truncate, EMBED_FIELD_LIMIT } from '../../utils/format';
import { countAll, countByKind, type ResourceKind, type SetupReport } from './types';

/**
 * Renders a SetupReport as Discord embeds.
 *
 * The headline is deliberately blunt — on a second run it should read
 * "0 created, 0 updated, everything already exists", because that is the whole
 * promise of an idempotent setup and the operator should be able to see it at
 * a glance without reading a list.
 */
export function renderReport(report: SetupReport): EmbedBuilder[] {
  const totals = countAll(report);
  const title = report.dryRun ? 'SETUP — DRY RUN' : 'SETUP';

  const embed = new EmbedBuilder()
    .setColor(colorFor(report))
    .setTitle(`${BRAND.name} — ${title}`)
    .setDescription(headline(report))
    .addFields(
      { name: 'Roles', value: line(report, 'role'), inline: true },
      { name: 'Categories', value: line(report, 'category'), inline: true },
      { name: 'Channels', value: line(report, 'channel'), inline: true },
    )
    .setFooter({ text: `${BRAND.footer} · ${report.guildName} · ${report.durationMs}ms` })
    .setTimestamp(new Date());

  const verb = report.dryRun ? 'Would create' : 'Created';
  const updatedVerb = report.dryRun ? 'Would update' : 'Updated';

  addListField(embed, verb, report, 'created');
  addListField(embed, updatedVerb, report, 'updated');
  addListField(embed, 'Failed', report, 'failed');

  if (report.notes.length > 0) {
    embed.addFields({ name: 'Notes', value: bullets(report.notes) });
  }
  if (report.warnings.length > 0) {
    embed.addFields({ name: 'Warnings', value: bullets(report.warnings) });
  }
  if (report.unmanagedChannels.length > 0) {
    embed.addFields({
      name: 'Not managed by the blueprint',
      value: truncate(
        `${report.unmanagedChannels.map((name) => `#${name}`).join(', ')}\n_Left untouched. Setup never deletes anything._`,
        EMBED_FIELD_LIMIT,
      ),
    });
  }

  if (totals.failed === 0 && totals.created === 0 && totals.updated === 0 && !report.dryRun) {
    embed.addFields({
      name: 'Result',
      value: 'All required resources already exist. Nothing was changed.',
    });
  }

  return [embed];
}

function headline(report: SetupReport): string {
  const totals = countAll(report);
  const prefix = report.dryRun
    ? 'No changes were made. This is what a real run would do.'
    : 'Synchronisation complete.';

  return [
    prefix,
    '',
    `**${plural(totals.created, report.dryRun ? 'resource to create' : 'resource created', report.dryRun ? 'resources to create' : 'resources created')}**`,
    `**${plural(totals.updated, report.dryRun ? 'resource to update' : 'resource updated', report.dryRun ? 'resources to update' : 'resources updated')}**`,
    `${plural(totals.unchanged, 'resource already correct', 'resources already correct')}`,
    totals.failed > 0 ? `**${plural(totals.failed, 'failure')}** — see below` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function line(report: SetupReport, kind: ResourceKind): string {
  const counts = countByKind(report, kind);
  const parts = [
    `${counts.created} created`,
    `${counts.updated} updated`,
    `${counts.unchanged} ok`,
  ];
  if (counts.failed > 0) parts.push(`${counts.failed} failed`);
  return parts.join('\n');
}

function addListField(
  embed: EmbedBuilder,
  name: string,
  report: SetupReport,
  status: 'created' | 'updated' | 'failed',
): void {
  const entries = report.outcomes.filter((outcome) => outcome.status === status);
  if (entries.length === 0) return;

  const lines = entries.map((outcome) => {
    const detail =
      status === 'failed'
        ? outcome.error ?? 'unknown error'
        : outcome.reasons.length > 0
          ? outcome.reasons.join(', ')
          : '';
    return detail ? `• ${outcome.label} — ${detail}` : `• ${outcome.label}`;
  });

  embed.addFields({ name: `${name} (${entries.length})`, value: fitLines(lines) });
}

function bullets(values: string[]): string {
  return fitLines(values.map((value) => `• ${value}`));
}

/** Pack as many lines as fit an embed field, then say how many were dropped. */
function fitLines(lines: string[]): string {
  const out: string[] = [];
  let length = 0;

  for (const [index, line] of lines.entries()) {
    const remaining = lines.length - index;
    const suffix = `\n… and ${remaining} more`;
    if (length + line.length + 1 > EMBED_FIELD_LIMIT - suffix.length) {
      out.push(`… and ${remaining} more`);
      break;
    }
    out.push(line);
    length += line.length + 1;
  }

  return out.join('\n') || '—';
}

function colorFor(report: SetupReport): number {
  const totals = countAll(report);
  if (totals.failed > 0) return COLORS.danger;
  if (report.dryRun) return COLORS.neutral;
  if (report.warnings.length > 0) return COLORS.warning;
  return COLORS.success;
}
