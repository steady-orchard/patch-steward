export const REPORT_SECTION_ITEM_LIMITS = Object.freeze({
  blockers: 20,
  uncertainties: 10,
  'executed-commands': 10,
  references: 20,
  flagged: 10,
  'what-would-change': 10,
  'classification-notes': 10,
});

export const REPORT_ITEM_MAX_LENGTHS = Object.freeze({
  header: 3000,
  'classification-line': 300,
  'classification-note': 300,
  blocker: 1000,
  uncertainty: 800,
  'executed-command': 600,
  reference: 250,
  'flagged-item': 300,
  'what-would-change-item': 500,
  provenance: 1500,
  'overflow-line': 300,
});

export const REPORT_HEADING_MAX_LENGTH = 60;
export const REPORT_HEADINGS_COUNT = 9;
export const REPORT_SEPARATOR_LINES_MAX = 40;

export function flaggedItemLimit(maxFlagged: number): number {
  return Math.min(10, Math.max(0, Math.floor(maxFlagged)));
}

export function reportStaticBudget(): number {
  return (
    REPORT_ITEM_MAX_LENGTHS.header +
    REPORT_ITEM_MAX_LENGTHS['classification-line'] +
    REPORT_SECTION_ITEM_LIMITS['classification-notes'] * REPORT_ITEM_MAX_LENGTHS['classification-note'] +
    REPORT_SECTION_ITEM_LIMITS.blockers * REPORT_ITEM_MAX_LENGTHS.blocker +
    REPORT_SECTION_ITEM_LIMITS.uncertainties * REPORT_ITEM_MAX_LENGTHS.uncertainty +
    REPORT_SECTION_ITEM_LIMITS['executed-commands'] * REPORT_ITEM_MAX_LENGTHS['executed-command'] +
    REPORT_SECTION_ITEM_LIMITS.references * REPORT_ITEM_MAX_LENGTHS.reference +
    REPORT_SECTION_ITEM_LIMITS.flagged * REPORT_ITEM_MAX_LENGTHS['flagged-item'] +
    REPORT_SECTION_ITEM_LIMITS['what-would-change'] * REPORT_ITEM_MAX_LENGTHS['what-would-change-item'] +
    REPORT_ITEM_MAX_LENGTHS.provenance +
    7 * REPORT_ITEM_MAX_LENGTHS['overflow-line'] +
    REPORT_HEADINGS_COUNT * REPORT_HEADING_MAX_LENGTH +
    REPORT_SEPARATOR_LINES_MAX
  );
}
