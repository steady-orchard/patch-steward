export function greet(name: string): string {
  return `Hello, ${name}!`;
}

export * from './vocabulary.js';
export * from './result.js';
export * from './labels.js';
export * from './canonical-json.js';
export * from './hash.js';
export * from './strict-yaml.js';
export * from './process/run-process.js';
export * from './git/reader.js';
export * from './submission-fields.js';
export * from './policy/bounds.js';
export * from './policy/catalog.js';
export * from './policy/schema.js';
export * from './policy/messages.js';
export * from './policy/rules.js';
export * from './policy/validate.js';
export * from './policy/resolve.js';
export * from './policy/warnings.js';
export * from './policy/public-subset.js';
export * from './policy/loader.js';
export * from './policy/revision-record.js';
export * from './redaction/detectors.js';
export * from './redaction/safe-pattern.js';
export * from './redaction/redact.js';
export * from './records/common.js';
export * from './records/submission.js';
export * from './records/run.js';
export * from './records/execution-record.js';
export * from './records/finding.js';
export * from './records/decision.js';
export * from './records/report.js';
export * from './records/maintainer-action.js';
export * from './records/metrics-event.js';
