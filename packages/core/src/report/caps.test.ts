import { describe, expect, it } from 'vitest';
import { CHECK_SUMMARY_MAX_LENGTH, REPORT_MAX_LENGTH } from '../policy/bounds.js';
import {
  REPORT_SECTION_ITEM_LIMITS,
  REPORT_ITEM_MAX_LENGTHS,
  REPORT_HEADING_MAX_LENGTH,
  REPORT_HEADINGS_COUNT,
  REPORT_SEPARATOR_LINES_MAX,
  flaggedItemLimit,
  reportStaticBudget,
} from './caps.js';

describe('report caps', () => {
  it('static report budget fits the report maximum', () => {
    expect(reportStaticBudget()).toBe(57480);
    expect(reportStaticBudget()).toBeLessThanOrEqual(REPORT_MAX_LENGTH);
  });

  it('report cap tables hold the approved values', () => {
    expect(REPORT_SECTION_ITEM_LIMITS).toEqual({
      blockers: 20,
      uncertainties: 10,
      'executed-commands': 10,
      references: 20,
      flagged: 10,
      'what-would-change': 10,
      'classification-notes': 10,
    });
    expect(Object.isFrozen(REPORT_SECTION_ITEM_LIMITS)).toBe(true);

    expect(REPORT_ITEM_MAX_LENGTHS).toEqual({
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
    expect(Object.isFrozen(REPORT_ITEM_MAX_LENGTHS)).toBe(true);

    expect(REPORT_HEADING_MAX_LENGTH).toBe(60);
    expect(REPORT_HEADINGS_COUNT).toBe(9);
    expect(REPORT_SEPARATOR_LINES_MAX).toBe(40);
  });

  it('flagged items never exceed the hygiene maximum', () => {
    expect(flaggedItemLimit(0)).toBe(0);
    expect(flaggedItemLimit(5)).toBe(5);
    expect(flaggedItemLimit(10)).toBe(10);
    expect(flaggedItemLimit(50)).toBe(10);
  });

  it('check summary maximum stays below the report maximum', () => {
    expect(CHECK_SUMMARY_MAX_LENGTH).toBeLessThan(REPORT_MAX_LENGTH);
  });
});
