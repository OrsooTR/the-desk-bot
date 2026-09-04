/**
 * The trade review template.
 *
 * The point is not documentation — it is forcing the sequence. Context before
 * thesis, thesis before entry, risk before management, and the post-mortem
 * separated from the result so a winning trade can still be judged badly.
 */

export interface ReviewSection {
  heading: string;
  /** Prompts rendered as fields to fill in. */
  prompts: string[];
}

export const REVIEW_SECTIONS: ReviewSection[] = [
  {
    heading: 'MARKET CONTEXT',
    prompts: [
      'What was the broader context? (regime, session, volatility, higher timeframe)',
      'What was the market doing before the setup appeared?',
    ],
  },
  {
    heading: 'SETUP',
    prompts: ['What was the setup?', 'What conditions had to be present for it to be valid?'],
  },
  {
    heading: 'THESIS',
    prompts: [
      'Why did you take this trade?',
      'What would have invalidated it?',
      'What was the alternative scenario?',
    ],
  },
  {
    heading: 'ENTRY',
    prompts: ['Entry price:', 'Entry trigger:', 'Time:'],
  },
  {
    heading: 'RISK',
    prompts: ['Stop:', 'Risk (in R or %):', 'Position size and why:'],
  },
  {
    heading: 'MANAGEMENT',
    prompts: [
      'What did you do after entry?',
      'Did you follow the plan? If not, what changed and why?',
    ],
  },
  {
    heading: 'EXIT',
    prompts: ['Exit price:', 'Reason for exit:'],
  },
  {
    heading: 'RESULT',
    prompts: ['PnL:', 'R multiple:', 'Was the outcome consistent with the process?'],
  },
  {
    heading: 'POST-TRADE ANALYSIS',
    prompts: [
      'What went right?',
      'What went wrong?',
      'What would you change — in the decision, not the outcome?',
      'Is this a repeatable observation, or a sample of one?',
    ],
  },
];

/** Header fields collected as command options and shown at the top. */
export const REVIEW_HEADER_FIELDS = ['Instrument', 'Session', 'Direction'] as const;

export const REVIEW_FOOTER =
  'Reviewed for learning, not for approval. A profitable trade taken badly is still a bad trade.';
