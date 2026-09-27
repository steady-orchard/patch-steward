import type { Clock } from '../clock.js';
import { recordCauseSchema } from '../records/decision.js';
import type { RecordCause } from '../records/decision.js';
import type { RunPhaseLatency } from '../evidence/metrics.js';
import type { FailureCause } from '../vocabulary.js';
import type { ResolvedPolicy } from '../policy/schema.js';
import { err } from '../result.js';
import type { Result } from '../result.js';
import { runWithPhaseTimeout } from './phases.js';
import type { PhaseImplementations, SequencePhase } from './phases.js';
import { expectedNextHandoff, validateHandoff } from './handoff.js';
import type { HandoffFailureCode, HandoffRecord } from './handoff.js';

export const PIPELINE_FAILURE_CODES = [
  'pipeline.handoff-invalid',
  'pipeline.handoff-binding',
  'pipeline.phase-failed',
  'pipeline.phase-timeout',
  'pipeline.rounds-exhausted',
  'pipeline.stage-incomplete',
] as const;

export type PipelineFailureCode = (typeof PIPELINE_FAILURE_CODES)[number];

export const PIPELINE_FAILURE_CAUSES: { readonly [K in PipelineFailureCode]: FailureCause } = Object.freeze({
  'pipeline.handoff-invalid': 'steward-defect',
  'pipeline.handoff-binding': 'steward-defect',
  'pipeline.phase-failed': 'steward-defect',
  'pipeline.phase-timeout': 'budget-exhausted',
  'pipeline.rounds-exhausted': 'budget-exhausted',
  'pipeline.stage-incomplete': 'stage-incomplete',
});

export const PIPELINE_FAILURE_MESSAGES: { readonly [K in PipelineFailureCode]: string } = Object.freeze({
  'pipeline.handoff-invalid': 'The handoff record failed validation.',
  'pipeline.handoff-binding': 'The handoff record is not bound to this run.',
  'pipeline.phase-failed': 'A pipeline phase failed unexpectedly.',
  'pipeline.phase-timeout': 'A pipeline phase exceeded limits.stage_seconds.',
  'pipeline.rounds-exhausted': 'A round was requested beyond stages.challenge_rounds.',
  'pipeline.stage-incomplete': 'Required stages produced no result.',
});

export function pipelineCause(code: PipelineFailureCode, subjects: readonly string[]): RecordCause {
  return {
    cause: PIPELINE_FAILURE_CAUSES[code],
    code,
    message: PIPELINE_FAILURE_MESSAGES[code],
    subjects: [...subjects],
  };
}

export interface RunBinding {
  readonly run_id: string | number;
  readonly run_attempt: number;
  readonly snapshot_hash: string;
  readonly policy_revision: string;
}

export function acceptGateHandoff(
  candidate: unknown,
  binding: RunBinding,
  maxRounds: number,
): Result<HandoffRecord, HandoffFailureCode> {
  const result = validateHandoff(candidate, { previous: null, gate: null, maxRounds });
  if (!result.ok) {
    return result;
  }
  const { value } = result;
  if (
    value.run.run_id !== binding.run_id ||
    value.run.run_attempt !== binding.run_attempt ||
    value.snapshot_hash !== binding.snapshot_hash ||
    value.policy_revision !== binding.policy_revision
  ) {
    return err('pipeline.handoff-binding', 'steward-defect', 'The handoff record is not bound to this run.');
  }
  return result;
}

export function phaseLabel(phase: SequencePhase, round: number): string {
  return round === 0 ? phase : `${phase}-${round}`;
}

export interface SequenceInput {
  readonly gate: HandoffRecord;
  readonly maxRounds: number;
  readonly timeoutMs: number;
  readonly policy: ResolvedPolicy;
  readonly phases: PhaseImplementations;
  readonly clock: Clock;
}

export interface SequenceResult {
  readonly last: HandoffRecord;
  readonly causes: readonly RecordCause[];
  readonly phases: readonly RunPhaseLatency[];
  readonly logLines: readonly string[];
}

export async function runPhaseSequence(input: SequenceInput): Promise<SequenceResult> {
  let last: HandoffRecord = input.gate;
  const causes: RecordCause[] = [];
  const phaseLatencies: RunPhaseLatency[] = [];
  const logLines: string[] = [];

  if (last.early_exit !== null) {
    return { last, causes, phases: phaseLatencies, logLines };
  }

  let next = expectedNextHandoff(last, input.maxRounds);

  while (next !== null) {
    const currentNext = next;
    let label = 'unknown';
    try {
      label = phaseLabel(currentNext.phase as SequencePhase, currentNext.round);
      const started = input.clock.now();
      const outcome = await runWithPhaseTimeout(
        (signal) => input.phases[currentNext.phase as SequencePhase](last, { policy: input.policy, signal }),
        input.timeoutMs,
      );
      const ended = input.clock.now();
      phaseLatencies.push({
        phase: label,
        seconds: Math.max(0, (ended.getTime() - started.getTime()) / 1000),
        recordedAt: ended.toISOString(),
      });

      let cause: RecordCause | null = null;

      if (outcome.kind === 'timeout') {
        cause = pipelineCause('pipeline.phase-timeout', [label]);
      } else if (outcome.kind === 'threw') {
        cause = pipelineCause('pipeline.phase-failed', [label]);
      } else if (!outcome.value.ok) {
        const { failure } = outcome.value;
        const candidateCause: RecordCause = {
          cause: failure.cause,
          code: failure.code,
          message: failure.message,
          subjects: [],
        };
        const parsed = recordCauseSchema.safeParse(candidateCause);
        cause = parsed.success ? candidateCause : pipelineCause('pipeline.phase-failed', [label]);
      } else {
        const validated = validateHandoff(outcome.value.value, { previous: last, gate: input.gate, maxRounds: input.maxRounds });
        if (!validated.ok) {
          cause = pipelineCause(validated.failure.code, [label]);
        } else {
          last = validated.value;
          logLines.push(`phase ${label} complete`);
          if (last.phase === 'assess' && last.next_round_plan !== null && last.round + 1 > Math.min(input.maxRounds, 3)) {
            cause = pipelineCause('pipeline.rounds-exhausted', [label]);
          } else {
            next = expectedNextHandoff(last, input.maxRounds);
          }
        }
      }

      if (cause !== null) {
        causes.push(cause);
        logLines.push(`cause ${cause.cause} ${cause.code} at ${label}`);
        break;
      }
    } catch {
      const cause = pipelineCause('pipeline.phase-failed', [label]);
      causes.push(cause);
      logLines.push(`cause ${cause.cause} ${cause.code} at ${label}`);
      break;
    }
  }

  return { last, causes, phases: phaseLatencies, logLines };
}
