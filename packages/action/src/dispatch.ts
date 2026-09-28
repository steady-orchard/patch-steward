import {
  runHostedGate,
  runHostedPublish,
  readGateEnvironment,
  readPublishEnvironment,
  EVENT_PAYLOAD_MAX_BYTES,
  HANDOFF_MAX_BYTES,
  JOB_SUMMARY_MAX_LENGTH,
} from '@patch-steward/core';
import type {
  HostedGateDeps,
  HostedGateInput,
  HostedGateResult,
  HostedPublishDeps,
  HostedPublishInput,
  HostedPublishResult,
} from '@patch-steward/core';
import { appendTextFile, readBoundedFile, stagingPath, writeStagingFile } from './files.js';
import type { StagingFileName } from './files.js';
import { boundedSummaryText, formatOutputs, maskCommands } from './outputs.js';

export interface ActionDeps {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly stdout: (text: string) => void;
  readonly runGate?: (input: HostedGateInput, deps: HostedGateDeps) => Promise<HostedGateResult>;
  readonly runPublish?: (input: HostedPublishInput, deps: HostedPublishDeps) => Promise<HostedPublishResult>;
}

export async function runAction(argv: readonly string[], deps: ActionDeps): Promise<number> {
  try {
    const key = deps.env.PATCH_STEWARD_APP_PRIVATE_KEY;
    if (typeof key === 'string' && key.length > 0) {
      deps.stdout(maskCommands(key));
    }

    if (argv.length !== 1 || (argv[0] !== 'gate' && argv[0] !== 'publish')) {
      deps.stdout('usage: main.js gate|publish\n');
      return 2;
    }
    const job = argv[0];

    const runGate = deps.runGate ?? runHostedGate;
    const runPublish = deps.runPublish ?? runHostedPublish;

    const mask = (secret: string): void => {
      deps.stdout(maskCommands(secret));
    };

    if (job === 'gate') {
      const environmentResult = readGateEnvironment(deps.env);
      if (!environmentResult.ok) {
        const failure = environmentResult.failure;
        deps.stdout('::error::' + failure.code + ' ' + (failure.details[0]?.path ?? '') + '\n');
        return 1;
      }
      const environment = environmentResult.value;
      const writeSummary = async (text: string): Promise<void> => {
        await appendTextFile(environment.summaryPath, boundedSummaryText(text, JOB_SUMMARY_MAX_LENGTH));
      };

      const payloadRead = await readBoundedFile(environment.eventPath, EVENT_PAYLOAD_MAX_BYTES + 1);
      let payload: Uint8Array;
      if (payloadRead.kind === 'ok') {
        payload = payloadRead.bytes;
      } else if (payloadRead.kind === 'too-large') {
        payload = new Uint8Array(EVENT_PAYLOAD_MAX_BYTES + 1);
      } else {
        deps.stdout('::error::action.environment-invalid GITHUB_EVENT_PATH\n');
        return 1;
      }

      const result = await runGate({ environment, payload }, { mask, writeSummary });
      if (result.ok) {
        for (const file of result.files) {
          try {
            await writeStagingFile(environment.runnerTemp, file.name as StagingFileName, file.bytes);
          } catch {
            deps.stdout('::error::steward files could not be staged\n');
            return 1;
          }
        }
        const text = formatOutputs(result.outputs);
        if (text === null) {
          deps.stdout('::error::steward outputs are invalid\n');
          return 1;
        }
        await appendTextFile(environment.outputPath, text);
        for (const line of result.logLines) {
          deps.stdout(line + '\n');
        }
        return 0;
      }
      for (const line of result.logLines) {
        deps.stdout(line + '\n');
      }
      deps.stdout('::error::gate failed ' + result.failure.code + '\n');
      return 1;
    }

    const environmentResult = readPublishEnvironment(deps.env);
    if (!environmentResult.ok) {
      const failure = environmentResult.failure;
      deps.stdout('::error::' + failure.code + ' ' + (failure.details[0]?.path ?? '') + '\n');
      return 1;
    }
    const environment = environmentResult.value;
    const writeSummary = async (text: string): Promise<void> => {
      await appendTextFile(environment.summaryPath, boundedSummaryText(text, JOB_SUMMARY_MAX_LENGTH));
    };

    const handoffRead = await readBoundedFile(stagingPath(environment.runnerTemp, 'handoff'), HANDOFF_MAX_BYTES);
    const gateContextRead = await readBoundedFile(stagingPath(environment.runnerTemp, 'gate-context'), HANDOFF_MAX_BYTES);
    const closureRead = await readBoundedFile(stagingPath(environment.runnerTemp, 'closure'), HANDOFF_MAX_BYTES);

    const files = {
      handoff: handoffRead.kind === 'ok' ? handoffRead.bytes : null,
      gateContext: gateContextRead.kind === 'ok' ? gateContextRead.bytes : null,
      closure: closureRead.kind === 'ok' ? closureRead.bytes : null,
    };

    const result = await runPublish({ environment, files }, { mask, writeSummary });
    if (result.ok) {
      const text = formatOutputs(result.outputs);
      if (text === null) {
        deps.stdout('::error::steward outputs are invalid\n');
        return 1;
      }
      await appendTextFile(environment.outputPath, text);
      for (const line of result.logLines) {
        deps.stdout(line + '\n');
      }
      return 0;
    }
    for (const line of result.logLines) {
      deps.stdout(line + '\n');
    }
    deps.stdout('::error::publish failed ' + result.failure.code + '\n');
    return 1;
  } catch {
    deps.stdout('::error::steward action failed\n');
    return 1;
  }
}
