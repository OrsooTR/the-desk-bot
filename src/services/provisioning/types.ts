export type ResourceKind = 'guild' | 'role' | 'category' | 'channel';

export type OutcomeStatus = 'created' | 'updated' | 'unchanged' | 'failed';

export interface ResourceOutcome {
  kind: ResourceKind;
  /** Blueprint key, or a synthetic key for guild-level settings. */
  key: string;
  /** Display label, e.g. `#trading-floor` or `Trading Floor (voice)`. */
  label: string;
  status: OutcomeStatus;
  /** Why an update was needed. Empty when unchanged. */
  reasons: string[];
  /** User-safe failure description. Full detail goes to the logs. */
  error?: string;
}

export interface SetupReport {
  /** True when nothing was written — the report describes what *would* happen. */
  dryRun: boolean;
  guildName: string;
  outcomes: ResourceOutcome[];
  /** Informational: things that happened but need no action. */
  notes: string[];
  /** Things the operator should look at. */
  warnings: string[];
  /** Channels present in the server that the blueprint does not describe. */
  unmanagedChannels: string[];
  durationMs: number;
}

export interface SyncOptions {
  /** When true, every mutation is skipped and only reported. */
  dryRun: boolean;
  /** Who triggered the sync, for the audit log reason. */
  actorTag?: string;
}

export interface SetupCounts {
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
}

export function countByKind(report: SetupReport, kind: ResourceKind): SetupCounts {
  return tally(report.outcomes.filter((outcome) => outcome.kind === kind));
}

export function countAll(report: SetupReport): SetupCounts {
  return tally(report.outcomes);
}

function tally(outcomes: ResourceOutcome[]): SetupCounts {
  const counts: SetupCounts = { created: 0, updated: 0, unchanged: 0, failed: 0 };
  for (const outcome of outcomes) counts[outcome.status] += 1;
  return counts;
}
