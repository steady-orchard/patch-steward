import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ProcessRunner } from '../process/run-process.js';
import type { StreamProcessRunner } from '../process/stream-process.js';
import type { ResolvedPolicy } from '../policy/schema.js';
import { ok, type Result } from '../result.js';
import { buildCheckoutArchive, type CheckoutFacts, type CheckoutFailureCode } from './checkout.js';
import { fetchCommit, type FetchFailureCode, type FetchSource } from './fetch.js';
import type { OverlayEntry } from './paths.js';

export interface MaterializeLimits {
  readonly checkoutFiles: number;
  readonly checkoutBytes: number;
  readonly overlayFiles: number;
  readonly overlayBytes: number;
  readonly materializeSeconds: number;
}

export function materializeLimitsFromPolicy(policy: ResolvedPolicy): MaterializeLimits {
  const execution = policy.limits.execution;
  return {
    checkoutFiles: execution.checkout_files,
    checkoutBytes: execution.checkout_bytes,
    overlayFiles: execution.overlay_files,
    overlayBytes: execution.overlay_bytes,
    materializeSeconds: execution.materialize_seconds,
  };
}

export interface MaterializeInput {
  readonly source: FetchSource;
  readonly commit: string;
  readonly token: string | null;
  readonly overlay: readonly OverlayEntry[];
  readonly limits: MaterializeLimits;
  readonly hostEnv: Readonly<Record<string, string | undefined>>;
  readonly control?: ProcessRunner;
  readonly stream?: StreamProcessRunner;
  readonly gitBinary?: string;
}

export interface MaterializedCheckout {
  readonly archivePath: string;
  readonly checkout: CheckoutFacts;
  dispose(): Promise<void>;
}

export type MaterializeFailureCode = FetchFailureCode | CheckoutFailureCode;

export async function materializeCommit(input: MaterializeInput): Promise<Result<MaterializedCheckout, MaterializeFailureCode>> {
  const { limits } = input;
  const deadline = Date.now() + limits.materializeSeconds * 1000;
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-steward-materialize-'));
  const remove = async (): Promise<void> => fs.rmSync(outDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  const fetched = await fetchCommit({
    source: input.source,
    commit: input.commit,
    token: input.token,
    hostEnv: input.hostEnv,
    timeoutMs: Math.max(1, deadline - Date.now()),
    ...(input.control !== undefined ? { runner: input.control } : {}),
    ...(input.gitBinary !== undefined ? { gitBinary: input.gitBinary } : {}),
  });
  if (!fetched.ok) {
    await remove();
    return fetched;
  }
  try {
    const built = await buildCheckoutArchive({
      repo: fetched.value,
      commit: input.commit,
      overlay: input.overlay,
      limits,
      timeoutMs: Math.max(1, deadline - Date.now()),
      outputDir: outDir,
      ...(input.stream !== undefined ? { stream: input.stream } : {}),
      ...(input.control !== undefined ? { control: input.control } : {}),
      ...(input.gitBinary !== undefined ? { gitBinary: input.gitBinary } : {}),
    });
    if (!built.ok) {
      await remove();
      return built;
    }
    return ok({ archivePath: built.value.archivePath, checkout: built.value.facts, dispose: remove });
  } finally {
    await fetched.value.dispose();
  }
}
