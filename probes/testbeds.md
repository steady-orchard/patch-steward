# Test-beds

## Inventory

| Key         | Repository                                   | Owner type   | Visibility | Default branch | App installation id |
| ----------- | -------------------------------------------- | ------------ | ---------- | -------------- | ------------------- |
| org-public  | steady-orchard/patch-steward-testbed-public  | Organization | public     | master         | 162868612           |
| org-private | steady-orchard/patch-steward-testbed-private | Organization | private    | master         | 162868612           |
| personal    | jambolo/patch-steward-testbed-personal       | User         | public     | master         | 162875728           |
| fork        | jambolo/patch-steward-testbed-public         | User         | public     | master         | not installed       |

## Capability matrix

| Capability             | org-public | org-private    | personal       | Evidence   |
| ---------------------- | ---------- | -------------- | -------------- | ---------- |
| ssh-deploy             | available  | available      | available      | T12        |
| dispatch               | available  | available      | available      | T13        |
| app-token              | available  | available      | available      | T14        |
| app-check-run          | available  | available      | available      | T14        |
| artifact-list          | available  | available      | available      | T15        |
| environment            | available  | available      | available      | T1, T4, T7 |
| ruleset-required-check | available  | unavailable    | available      | T2, T5, T8 |
| ruleset-merge-queue    | available  | unavailable    | unavailable    | T3, T6, T9 |
| fork-pr                | available  | not-applicable | not-applicable | T10, T11   |

## Owner actions

No owner action is open. OA1 (personal, ruleset-merge-queue: enable an exact-ref merge-queue ruleset) was closed on 2026-09-24 without an owner action, by owner decision: the platform refuses a merge-queue rule on this user-owned repository (T6), while the byte-identical request was created on org-public (T3), so the capability matrix records the refusal itself. The id OA1 is not reused.

## Fixtures

| Test-bed    | Fixture                                                                 | Kind        | State             | Details                                                                                                                                                                                                   |
| ----------- | ----------------------------------------------------------------------- | ----------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| org-public  | probe-pa01-sequence.yml                                                 | workflow    | disabled_manually | canonical source probes/pa01-required-checks/workflows/probe-pa01-sequence.yml                                                                                                                            |
| org-public  | probe-pa02-list.yml                                                     | workflow    | disabled_manually | canonical source probes/pa02-ownership-artifacts/workflows/probe-pa02-list.yml                                                                                                                            |
| org-public  | probe-pa02-upload.yml                                                   | workflow    | disabled_manually | canonical source probes/pa02-ownership-artifacts/workflows/probe-pa02-upload.yml                                                                                                                          |
| org-public  | probe-pa03-events.yml                                                   | workflow    | disabled_manually | canonical source probes/pa03-trusted-triggers/workflows/probe-pa03-events.yml                                                                                                                             |
| org-public  | probe-pa03-schedule-env.yml                                             | workflow    | disabled_manually | canonical source probes/pa03-trusted-triggers/workflows/probe-pa03-schedule-env.yml                                                                                                                       |
| org-public  | probe-pa03-schedule.yml                                                 | workflow    | disabled_manually | canonical source probes/pa03-trusted-triggers/workflows/probe-pa03-schedule.yml                                                                                                                           |
| org-public  | probe-pa03-upstream.yml                                                 | workflow    | disabled_manually | canonical source probes/pa03-trusted-triggers/workflows/probe-pa03-upstream.yml                                                                                                                           |
| org-public  | probe-pa04-callee-perms.yml                                             | workflow    | disabled_manually | canonical source probes/pa04-privilege-separation/workflows/probe-pa04-callee-perms.yml                                                                                                                   |
| org-public  | probe-pa04-callee-secrets.yml                                           | workflow    | disabled_manually | canonical source probes/pa04-privilege-separation/workflows/probe-pa04-callee-secrets.yml                                                                                                                 |
| org-public  | probe-pa04-callee.yml                                                   | workflow    | disabled_manually | canonical source probes/pa04-privilege-separation/workflows/probe-pa04-callee.yml                                                                                                                         |
| org-public  | probe-pa04-ceiling-grant.yml                                            | workflow    | disabled_manually | canonical source probes/pa04-privilege-separation/workflows/probe-pa04-ceiling-grant.yml                                                                                                                  |
| org-public  | probe-pa04-ceiling-omit-copilot.yml                                     | workflow    | disabled_manually | canonical source probes/pa04-privilege-separation/workflows/probe-pa04-ceiling-omit-copilot.yml                                                                                                           |
| org-public  | probe-pa04-ceiling-omit-issues.yml                                      | workflow    | disabled_manually | canonical source probes/pa04-privilege-separation/workflows/probe-pa04-ceiling-omit-issues.yml                                                                                                            |
| org-public  | probe-pa04-envs.yml                                                     | workflow    | disabled_manually | canonical source probes/pa04-privilege-separation/workflows/probe-pa04-envs.yml                                                                                                                           |
| org-public  | probe-pa04-pipeline.yml                                                 | workflow    | disabled_manually | canonical source probes/pa04-privilege-separation/workflows/probe-pa04-pipeline.yml                                                                                                                       |
| org-public  | probe-pa04-publish.yml                                                  | workflow    | disabled_manually | canonical source probes/pa04-privilege-separation/workflows/probe-pa04-publish.yml                                                                                                                        |
| org-public  | probe-pa04-w1-host-personal.yml                                         | workflow    | disabled_manually | canonical source probes/pa04-privilege-separation/workflows/probe-pa04-w1-host-personal.yml                                                                                                               |
| org-public  | probe-pa04-w2-host-personal.yml                                         | workflow    | disabled_manually | canonical source probes/pa04-privilege-separation/workflows/probe-pa04-w2-host-personal.yml                                                                                                               |
| org-public  | probe-pa05-concurrency.yml                                              | workflow    | disabled_manually | canonical source probes/pa05-rounds-concurrency/workflows/probe-pa05-concurrency.yml                                                                                                                      |
| org-public  | probe-pa05-rounds.yml                                                   | workflow    | disabled_manually | canonical source probes/pa05-rounds-concurrency/workflows/probe-pa05-rounds.yml                                                                                                                           |
| org-public  | probe-pa05-run.yml                                                      | workflow    | disabled_manually | canonical source probes/pa05-rounds-concurrency/workflows/probe-pa05-run.yml                                                                                                                              |
| org-public  | probe-pa06-control.yml                                                  | workflow    | disabled_manually | canonical source probes/pa06-merge-queue-relay/workflows/probe-pa06-control.yml                                                                                                                           |
| org-public  | probe-pa06-relay.yml                                                    | workflow    | disabled_manually | canonical source probes/pa06-merge-queue-relay/workflows/probe-pa06-relay.yml                                                                                                                             |
| org-public  | probe-pa06-steward.yml                                                  | workflow    | disabled_manually | canonical source probes/pa06-merge-queue-relay/workflows/probe-pa06-steward.yml                                                                                                                           |
| org-public  | probe-pa07-listen.yml                                                   | workflow    | disabled_manually | canonical source probes/pa07-app-token-writes/workflows/probe-pa07-listen.yml                                                                                                                             |
| org-public  | probe-pa07-write.yml                                                    | workflow    | disabled_manually | canonical source probes/pa07-app-token-writes/workflows/probe-pa07-write.yml                                                                                                                              |
| org-public  | probe-pa08-infer.yml                                                    | workflow    | disabled_manually | canonical source probes/pa08-copilot-inference/workflows/probe-pa08-infer.yml                                                                                                                             |
| org-public  | probe-pa09-act.yml                                                      | workflow    | disabled_manually | canonical source probes/pa09-run-list-caps/workflows/probe-pa09-act.yml                                                                                                                                   |
| org-public  | probe-pa09-count.yml                                                    | workflow    | disabled_manually | canonical source probes/pa09-run-list-caps/workflows/probe-pa09-count.yml                                                                                                                                 |
| org-public  | probe-pa09-follow.yml                                                   | workflow    | disabled_manually | canonical source probes/pa09-run-list-caps/workflows/probe-pa09-follow.yml                                                                                                                                |
| org-public  | probe-pa09-listen.yml                                                   | workflow    | disabled_manually | canonical source probes/pa09-run-list-caps/workflows/probe-pa09-listen.yml                                                                                                                                |
| org-public  | probe-smoke-machinery.yml                                               | workflow    | disabled_manually | canonical source probes/smoke/workflows/probe-smoke-machinery.yml                                                                                                                                         |
| org-public  | probe-pa01-base                                                         | branch      | present           | PR base branch; kept                                                                                                                                                                                      |
| org-public  | probe-pa03-base                                                         | branch      | present           | PR base branch; kept                                                                                                                                                                                      |
| org-public  | probe-pa03-base-noguard                                                 | branch      | present           | PR base branch; kept                                                                                                                                                                                      |
| org-public  | probe-pa06-base                                                         | branch      | present           | PR base branch; kept                                                                                                                                                                                      |
| org-public  | probe-pa07-base                                                         | branch      | present           | PR base branch; kept                                                                                                                                                                                      |
| org-public  | probe-pa09-base                                                         | branch      | present           | PR base branch; kept                                                                                                                                                                                      |
| org-public  | probe-pa03-default-branch                                               | environment | present           | dummy secrets: PROBE_PA03_ENV_MARKER; deployment branch policies: master                                                                                                                                  |
| org-public  | probe-pa04-env                                                          | environment | present           | dummy secrets: PROBE_PA04_ENV_MARKER; deployment branch policies: master                                                                                                                                  |
| org-public  | probe-pa01-required                                                     | ruleset     | active            | id=23972100; include=refs/heads/probe-pa01-base; rules=required_status_checks                                                                                                                             |
| org-public  | probe-pa06-queue                                                        | ruleset     | active            | id=23972114; include=refs/heads/probe-pa06-base; rules=required_status_checks,merge_queue                                                                                                                 |
| org-public  | probe-pa07:x                                                            | label       | present           | kept                                                                                                                                                                                                      |
| org-public  | probe-canary-retention                                                  | artifact    | present           | id=10832604674; created_at=2026-09-24T20:57:38Z expires_at=2026-09-25T20:57:37Z; read at 2026-09-25T14:20:54Z: expired=false; expiry not yet observable: read before 2026-09-25T21:57:38Z (upload + 25 h) |
| org-public  | (run artifacts)                                                         | artifact    | expiring          | unexpired at 2026-09-25T14:20:54Z: 25; latest expires_at 2026-12-24T01:26:05Z; all expire by retention; the suite deletes none                                                                            |
| org-public  | (probe issues and PRs)                                                  | issues-prs  | closed            | open issues 0, open PRs 0; closed issues 7, closed PRs 23 (read at 2026-09-25T14:20:54Z); closed, never deleted                                                                                           |
| org-public  | allow_auto_merge                                                        | setting     | false             | changed to true on 2026-09-25 by a PA06 probe run outside its procedure; reverted to false by the owner; read false at 2026-09-25T14:20:54Z                                                               |
| org-public  | scheduled-trigger fixture (probe-pa03-schedule.yml)                     | fixture     | disabled          | captured run 36075348546; disabled                                                                                                                                                                        |
| org-public  | scheduled-trigger fixture (probe-pa03-schedule-env.yml)                 | fixture     | disabled          | captured run 36075339713; disabled                                                                                                                                                                        |
| org-public  | probe-canary-env, probe-canary-required-check, probe-canary-merge-queue | fixture-set | removed           | Environment and two rulesets created, read back, then deleted by the canary                                                                                                                               |
| org-private | probe-pa02-list.yml                                                     | workflow    | disabled_manually | canonical source probes/pa02-ownership-artifacts/workflows/probe-pa02-list.yml                                                                                                                            |
| org-private | probe-pa02-upload.yml                                                   | workflow    | disabled_manually | canonical source probes/pa02-ownership-artifacts/workflows/probe-pa02-upload.yml                                                                                                                          |
| org-private | probe-pa03-events.yml                                                   | workflow    | disabled_manually | canonical source probes/pa03-trusted-triggers/workflows/probe-pa03-events.yml                                                                                                                             |
| org-private | probe-pa03-schedule-env.yml                                             | workflow    | disabled_manually | canonical source probes/pa03-trusted-triggers/workflows/probe-pa03-schedule-env.yml                                                                                                                       |
| org-private | probe-pa03-schedule.yml                                                 | workflow    | disabled_manually | canonical source probes/pa03-trusted-triggers/workflows/probe-pa03-schedule.yml                                                                                                                           |
| org-private | probe-pa03-upstream.yml                                                 | workflow    | disabled_manually | canonical source probes/pa03-trusted-triggers/workflows/probe-pa03-upstream.yml                                                                                                                           |
| org-private | probe-pa04-callee-perms.yml                                             | workflow    | disabled_manually | canonical source probes/pa04-privilege-separation/workflows/probe-pa04-callee-perms.yml                                                                                                                   |
| org-private | probe-pa04-callee.yml                                                   | workflow    | disabled_manually | canonical source probes/pa04-privilege-separation/workflows/probe-pa04-callee.yml                                                                                                                         |
| org-private | probe-pa04-ceiling-grant.yml                                            | workflow    | disabled_manually | canonical source probes/pa04-privilege-separation/workflows/probe-pa04-ceiling-grant.yml                                                                                                                  |
| org-private | probe-pa04-ceiling-omit-copilot.yml                                     | workflow    | disabled_manually | canonical source probes/pa04-privilege-separation/workflows/probe-pa04-ceiling-omit-copilot.yml                                                                                                           |
| org-private | probe-pa04-ceiling-omit-issues.yml                                      | workflow    | disabled_manually | canonical source probes/pa04-privilege-separation/workflows/probe-pa04-ceiling-omit-issues.yml                                                                                                            |
| org-private | probe-pa04-envs.yml                                                     | workflow    | disabled_manually | canonical source probes/pa04-privilege-separation/workflows/probe-pa04-envs.yml                                                                                                                           |
| org-private | probe-pa04-w1-host-org-public.yml                                       | workflow    | disabled_manually | canonical source probes/pa04-privilege-separation/workflows/probe-pa04-w1-host-org-public.yml                                                                                                             |
| org-private | probe-pa04-w1-host-personal.yml                                         | workflow    | disabled_manually | canonical source probes/pa04-privilege-separation/workflows/probe-pa04-w1-host-personal.yml                                                                                                               |
| org-private | probe-pa04-w2-host-org-public.yml                                       | workflow    | disabled_manually | canonical source probes/pa04-privilege-separation/workflows/probe-pa04-w2-host-org-public.yml                                                                                                             |
| org-private | probe-pa04-w2-host-personal.yml                                         | workflow    | disabled_manually | canonical source probes/pa04-privilege-separation/workflows/probe-pa04-w2-host-personal.yml                                                                                                               |
| org-private | probe-pa07-listen.yml                                                   | workflow    | disabled_manually | canonical source probes/pa07-app-token-writes/workflows/probe-pa07-listen.yml                                                                                                                             |
| org-private | probe-pa07-write.yml                                                    | workflow    | disabled_manually | canonical source probes/pa07-app-token-writes/workflows/probe-pa07-write.yml                                                                                                                              |
| org-private | probe-pa08-infer.yml                                                    | workflow    | disabled_manually | canonical source probes/pa08-copilot-inference/workflows/probe-pa08-infer.yml                                                                                                                             |
| org-private | probe-smoke-machinery.yml                                               | workflow    | disabled_manually | canonical source probes/smoke/workflows/probe-smoke-machinery.yml                                                                                                                                         |
| org-private | probe-pa03-base                                                         | branch      | present           | PR base branch; kept                                                                                                                                                                                      |
| org-private | probe-pa03-base-noguard                                                 | branch      | present           | PR base branch; kept                                                                                                                                                                                      |
| org-private | probe-pa07-base                                                         | branch      | present           | PR base branch; kept                                                                                                                                                                                      |
| org-private | probe-pa03-default-branch                                               | environment | present           | dummy secrets: PROBE_PA03_ENV_MARKER; deployment branch policies: master                                                                                                                                  |
| org-private | probe-pa04-env                                                          | environment | present           | dummy secrets: PROBE_PA04_ENV_MARKER; deployment branch policies: master                                                                                                                                  |
| org-private | (none)                                                                  | ruleset     | refused           | rulesets API HTTP 403 "Upgrade to GitHub Pro or make this repository public to enable this feature." (T8)                                                                                                 |
| org-private | probe-pa07:x                                                            | label       | present           | kept                                                                                                                                                                                                      |
| org-private | probe-canary-retention                                                  | artifact    | present           | id=10833138561; created_at=2026-09-24T21:01:52Z expires_at=2026-09-25T21:01:51Z; read at 2026-09-25T14:20:54Z: expired=false; expiry not yet observable: read before 2026-09-25T22:01:52Z (upload + 25 h) |
| org-private | (run artifacts)                                                         | artifact    | expiring          | unexpired at 2026-09-25T14:20:54Z: 11; latest expires_at 2026-12-24T02:12:46Z; all expire by retention; the suite deletes none                                                                            |
| org-private | (probe issues and PRs)                                                  | issues-prs  | closed            | open issues 0, open PRs 0; closed issues 3, closed PRs 5 (read at 2026-09-25T14:20:54Z); closed, never deleted                                                                                            |
| org-private | scheduled-trigger fixture (probe-pa03-schedule.yml)                     | fixture     | disabled          | Q3 re-probe (enabled once, at most 6 h): captured run 36145289811; disabled                                                                                                                               |
| org-private | scheduled-trigger fixture (probe-pa03-schedule-env.yml)                 | fixture     | disabled          | Q3 re-probe (enabled once, at most 6 h): captured run 36144833081; disabled                                                                                                                               |
| org-private | probe-canary-env                                                        | fixture-set | removed           | Environment created, read back, then deleted by the canary; both rulesets were refused, nothing to remove                                                                                                 |
| personal    | probe-pa01-sequence.yml                                                 | workflow    | disabled_manually | canonical source probes/pa01-required-checks/workflows/probe-pa01-sequence.yml                                                                                                                            |
| personal    | probe-pa03-events.yml                                                   | workflow    | disabled_manually | canonical source probes/pa03-trusted-triggers/workflows/probe-pa03-events.yml                                                                                                                             |
| personal    | probe-pa03-schedule-env.yml                                             | workflow    | disabled_manually | canonical source probes/pa03-trusted-triggers/workflows/probe-pa03-schedule-env.yml                                                                                                                       |
| personal    | probe-pa03-schedule.yml                                                 | workflow    | disabled_manually | canonical source probes/pa03-trusted-triggers/workflows/probe-pa03-schedule.yml                                                                                                                           |
| personal    | probe-pa03-upstream.yml                                                 | workflow    | disabled_manually | canonical source probes/pa03-trusted-triggers/workflows/probe-pa03-upstream.yml                                                                                                                           |
| personal    | probe-pa04-callee-perms.yml                                             | workflow    | disabled_manually | canonical source probes/pa04-privilege-separation/workflows/probe-pa04-callee-perms.yml                                                                                                                   |
| personal    | probe-pa04-callee-secrets.yml                                           | workflow    | disabled_manually | canonical source probes/pa04-privilege-separation/workflows/probe-pa04-callee-secrets.yml                                                                                                                 |
| personal    | probe-pa04-callee.yml                                                   | workflow    | disabled_manually | canonical source probes/pa04-privilege-separation/workflows/probe-pa04-callee.yml                                                                                                                         |
| personal    | probe-pa04-ceiling-grant.yml                                            | workflow    | disabled_manually | canonical source probes/pa04-privilege-separation/workflows/probe-pa04-ceiling-grant.yml                                                                                                                  |
| personal    | probe-pa04-ceiling-omit-copilot.yml                                     | workflow    | disabled_manually | canonical source probes/pa04-privilege-separation/workflows/probe-pa04-ceiling-omit-copilot.yml                                                                                                           |
| personal    | probe-pa04-ceiling-omit-issues.yml                                      | workflow    | disabled_manually | canonical source probes/pa04-privilege-separation/workflows/probe-pa04-ceiling-omit-issues.yml                                                                                                            |
| personal    | probe-pa04-envs.yml                                                     | workflow    | disabled_manually | canonical source probes/pa04-privilege-separation/workflows/probe-pa04-envs.yml                                                                                                                           |
| personal    | probe-pa04-w1-host-org-public.yml                                       | workflow    | disabled_manually | canonical source probes/pa04-privilege-separation/workflows/probe-pa04-w1-host-org-public.yml                                                                                                             |
| personal    | probe-pa04-w2-host-org-public.yml                                       | workflow    | disabled_manually | canonical source probes/pa04-privilege-separation/workflows/probe-pa04-w2-host-org-public.yml                                                                                                             |
| personal    | probe-pa07-listen.yml                                                   | workflow    | disabled_manually | canonical source probes/pa07-app-token-writes/workflows/probe-pa07-listen.yml                                                                                                                             |
| personal    | probe-pa07-write.yml                                                    | workflow    | disabled_manually | canonical source probes/pa07-app-token-writes/workflows/probe-pa07-write.yml                                                                                                                              |
| personal    | probe-pa08-cap.yml                                                      | workflow    | disabled_manually | canonical source probes/pa08-copilot-inference/workflows/probe-pa08-cap.yml; never enabled by the routine drift re-run (owner approval required)                                                          |
| personal    | probe-pa08-infer.yml                                                    | workflow    | disabled_manually | canonical source probes/pa08-copilot-inference/workflows/probe-pa08-infer.yml                                                                                                                             |
| personal    | probe-smoke-machinery.yml                                               | workflow    | disabled_manually | canonical source probes/smoke/workflows/probe-smoke-machinery.yml                                                                                                                                         |
| personal    | probe-pa01-base                                                         | branch      | present           | PR base branch; kept                                                                                                                                                                                      |
| personal    | probe-pa03-base                                                         | branch      | present           | PR base branch; kept                                                                                                                                                                                      |
| personal    | probe-pa03-base-noguard                                                 | branch      | present           | PR base branch; kept                                                                                                                                                                                      |
| personal    | probe-pa07-base                                                         | branch      | present           | PR base branch; kept                                                                                                                                                                                      |
| personal    | probe-pa03-default-branch                                               | environment | present           | dummy secrets: PROBE_PA03_ENV_MARKER; deployment branch policies: master                                                                                                                                  |
| personal    | probe-pa04-env                                                          | environment | present           | dummy secrets: PROBE_PA04_ENV_MARKER; deployment branch policies: master                                                                                                                                  |
| personal    | probe-pa01-required                                                     | ruleset     | active            | id=23974157; include=refs/heads/probe-pa01-base; rules=required_status_checks                                                                                                                             |
| personal    | probe-pa07:x                                                            | label       | present           | kept                                                                                                                                                                                                      |
| personal    | (run artifacts)                                                         | artifact    | expiring          | unexpired at 2026-09-25T14:20:54Z: 2; latest expires_at 2026-10-01T21:06:33Z; all expire by retention; the suite deletes none                                                                             |
| personal    | (probe issues and PRs)                                                  | issues-prs  | closed            | open issues 0, open PRs 0; closed issues 3, closed PRs 5 (read at 2026-09-25T14:20:54Z); closed, never deleted                                                                                            |
| personal    | scheduled-trigger fixture (probe-pa03-schedule.yml)                     | fixture     | disabled          | captured run 36062978420; disabled                                                                                                                                                                        |
| personal    | scheduled-trigger fixture (probe-pa03-schedule-env.yml)                 | fixture     | disabled          | captured run 36063493816; disabled                                                                                                                                                                        |
| personal    | probe-canary-env, probe-canary-required-check                           | fixture-set | removed           | Environment and one ruleset created, read back, then deleted by the canary; merge-queue ruleset was refused, nothing to remove                                                                            |
| fork        | probe-pa03-head-fork-absent                                             | branch      | present           | PR-head branch on the fork; kept with the fork                                                                                                                                                            |
| fork        | probe-pa03-head-fork-modify                                             | branch      | present           | PR-head branch on the fork; kept with the fork                                                                                                                                                            |
| fork        | probe-pa09-head-fork-1                                                  | branch      | present           | PR-head branch on the fork; kept with the fork                                                                                                                                                            |
| fork        | jambolo/patch-steward-testbed-public                                    | fork        | kept              | fork of org-public; PR-head-only fixture created by an earlier step                                                                                                                                       |

## Evidence

### T1 — environment canary created on org-public

```text
bash probes/smoke/tools/capabilities.sh steady-orchard/patch-steward-testbed-public probe-canary
CANARY begin=environment
ENVIRONMENT repo=steady-orchard/patch-steward-testbed-public environment=probe-canary-env existed=no
ENVIRONMENT call=create
{"deployment_branch_policy":{"custom_branch_policies":true,"protected_branches":false},"name":"probe-canary-env"}
ENVIRONMENT call=create exit=0
ENVIRONMENT call=add-branch-policy
{"id":60953767,"name":"master","type":"branch"}
ENVIRONMENT call=add-branch-policy exit=0
ENVIRONMENT call=set-secret

ENVIRONMENT call=set-secret exit=0
ENVIRONMENT call=read-environment
{"deployment_branch_policy":{"custom_branch_policies":true,"protected_branches":false},"name":"probe-canary-env"}
ENVIRONMENT call=read-environment exit=0
ENVIRONMENT call=read-branch-policies
[{"name":"master","type":"branch"}]
ENVIRONMENT call=read-branch-policies exit=0
ENVIRONMENT call=read-secrets
["PROBE_CANARY_MARKER"]
ENVIRONMENT call=read-secrets exit=0
ENVIRONMENT result=ready repo=steady-orchard/patch-steward-testbed-public environment=probe-canary-env branch_policy=master secret=PROBE_CANARY_MARKER
CANARY cleanup=environment name=probe-canary-env result=removed
CANARY end=environment
CAPABILITY environment outcome=created
```

### T2 — ruleset-required-check canary created on org-public

```text
bash probes/smoke/tools/capabilities.sh steady-orchard/patch-steward-testbed-public probe-canary
CANARY begin=ruleset-required-check
CANARY call=create-ruleset name=probe-canary-required-check
{"enforcement":"active","id":23963953,"name":"probe-canary-required-check"}
CANARY call=create-ruleset exit=0
CANARY call=read-ruleset id=23963953
{"enforcement":"active","id":23963953,"include":["refs/heads/probe-canary-*"],"name":"probe-canary-required-check","rules":[{"parameters":{"do_not_enforce_on_create":false,"required_status_checks":[{"context":"probe-canary/check","integration_id":4993303}],"strict_required_status_checks_policy":false},"type":"required_status_checks"}],"target":"branch"}
CANARY call=read-ruleset exit=0
CANARY cleanup=ruleset name=probe-canary-required-check id=23963953 result=removed
CANARY end=ruleset-required-check
CAPABILITY ruleset-required-check outcome=created
```

### T3 — ruleset-merge-queue canary created on org-public (exact ref)

```text
bash probes/smoke/tools/capabilities.sh steady-orchard/patch-steward-testbed-public probe-canary
CANARY begin=ruleset-merge-queue
CANARY call=create-ruleset name=probe-canary-merge-queue
{"enforcement":"active","id":23963955,"name":"probe-canary-merge-queue"}
CANARY call=create-ruleset exit=0
CANARY call=read-ruleset id=23963955
{"enforcement":"active","id":23963955,"include":["refs/heads/probe-canary-merge-queue"],"name":"probe-canary-merge-queue","rules":[{"parameters":{"check_response_timeout_minutes":5,"grouping_strategy":"ALLGREEN","max_entries_to_build":5,"max_entries_to_merge":5,"merge_method":"MERGE","min_entries_to_merge":1,"min_entries_to_merge_wait_minutes":1},"type":"merge_queue"}],"target":"branch"}
CANARY call=read-ruleset exit=0
CANARY cleanup=ruleset name=probe-canary-merge-queue id=23963955 result=removed
CANARY end=ruleset-merge-queue
CAPABILITY ruleset-merge-queue outcome=created
```

### T4 — environment canary created on personal

```text
bash probes/smoke/tools/capabilities.sh jambolo/patch-steward-testbed-personal probe-canary
CANARY begin=environment
ENVIRONMENT repo=jambolo/patch-steward-testbed-personal environment=probe-canary-env existed=no
ENVIRONMENT call=create
{"deployment_branch_policy":{"custom_branch_policies":true,"protected_branches":false},"name":"probe-canary-env"}
ENVIRONMENT call=create exit=0
ENVIRONMENT call=add-branch-policy
{"id":60953785,"name":"master","type":"branch"}
ENVIRONMENT call=add-branch-policy exit=0
ENVIRONMENT call=set-secret

ENVIRONMENT call=set-secret exit=0
ENVIRONMENT call=read-environment
{"deployment_branch_policy":{"custom_branch_policies":true,"protected_branches":false},"name":"probe-canary-env"}
ENVIRONMENT call=read-environment exit=0
ENVIRONMENT call=read-branch-policies
[{"name":"master","type":"branch"}]
ENVIRONMENT call=read-branch-policies exit=0
ENVIRONMENT call=read-secrets
["PROBE_CANARY_MARKER"]
ENVIRONMENT call=read-secrets exit=0
ENVIRONMENT result=ready repo=jambolo/patch-steward-testbed-personal environment=probe-canary-env branch_policy=master secret=PROBE_CANARY_MARKER
CANARY cleanup=environment name=probe-canary-env result=removed
CANARY end=environment
CAPABILITY environment outcome=created
```

### T5 — ruleset-required-check canary created on personal

```text
bash probes/smoke/tools/capabilities.sh jambolo/patch-steward-testbed-personal probe-canary
CANARY begin=ruleset-required-check
CANARY call=create-ruleset name=probe-canary-required-check
{"enforcement":"active","id":23963960,"name":"probe-canary-required-check"}
CANARY call=create-ruleset exit=0
CANARY call=read-ruleset id=23963960
{"enforcement":"active","id":23963960,"include":["refs/heads/probe-canary-*"],"name":"probe-canary-required-check","rules":[{"parameters":{"do_not_enforce_on_create":false,"required_status_checks":[{"context":"probe-canary/check","integration_id":4993303}],"strict_required_status_checks_policy":false},"type":"required_status_checks"}],"target":"branch"}
CANARY call=read-ruleset exit=0
CANARY cleanup=ruleset name=probe-canary-required-check id=23963960 result=removed
CANARY end=ruleset-required-check
CAPABILITY ruleset-required-check outcome=created
```

### T6 — ruleset-merge-queue canary refused on personal (exact ref)

```text
bash probes/smoke/tools/capabilities.sh jambolo/patch-steward-testbed-personal probe-canary
CANARY begin=ruleset-merge-queue
CANARY call=create-ruleset name=probe-canary-merge-queue
{"message":"Validation Failed","errors":["Invalid rule 'merge_queue': "],"documentation_url":"https://docs.github.com/rest/repos/rules#create-a-repository-ruleset","status":"422"}gh: Validation Failed (HTTP 422)
CANARY call=create-ruleset exit=1
CANARY end=ruleset-merge-queue
CAPABILITY ruleset-merge-queue outcome=refused
```

### T7 — environment canary created on org-private

```text
bash probes/smoke/tools/capabilities.sh steady-orchard/patch-steward-testbed-private probe-canary
CANARY begin=environment
ENVIRONMENT repo=steady-orchard/patch-steward-testbed-private environment=probe-canary-env existed=no
ENVIRONMENT call=create
{"deployment_branch_policy":{"custom_branch_policies":true,"protected_branches":false},"name":"probe-canary-env"}
ENVIRONMENT call=create exit=0
ENVIRONMENT call=add-branch-policy
{"id":60953831,"name":"master","type":"branch"}
ENVIRONMENT call=add-branch-policy exit=0
ENVIRONMENT call=set-secret

ENVIRONMENT call=set-secret exit=0
ENVIRONMENT call=read-environment
{"deployment_branch_policy":{"custom_branch_policies":true,"protected_branches":false},"name":"probe-canary-env"}
ENVIRONMENT call=read-environment exit=0
ENVIRONMENT call=read-branch-policies
[{"name":"master","type":"branch"}]
ENVIRONMENT call=read-branch-policies exit=0
ENVIRONMENT call=read-secrets
["PROBE_CANARY_MARKER"]
ENVIRONMENT call=read-secrets exit=0
ENVIRONMENT result=ready repo=steady-orchard/patch-steward-testbed-private environment=probe-canary-env branch_policy=master secret=PROBE_CANARY_MARKER
CANARY cleanup=environment name=probe-canary-env result=removed
CANARY end=environment
CAPABILITY environment outcome=created
```

### T8 — ruleset-required-check canary refused on org-private

```text
bash probes/smoke/tools/capabilities.sh steady-orchard/patch-steward-testbed-private probe-canary
CANARY begin=ruleset-required-check
CANARY call=create-ruleset name=probe-canary-required-check
{"message":"Upgrade to GitHub Pro or make this repository public to enable this feature.","documentation_url":"https://docs.github.com/rest/repos/rules#create-a-repository-ruleset","status":"403"}gh: Upgrade to GitHub Pro or make this repository public to enable this feature. (HTTP 403)
CANARY call=create-ruleset exit=1
CANARY end=ruleset-required-check
CAPABILITY ruleset-required-check outcome=refused
```

### T9 — ruleset-merge-queue canary refused on org-private

```text
bash probes/smoke/tools/capabilities.sh steady-orchard/patch-steward-testbed-private probe-canary
CANARY begin=ruleset-merge-queue
CANARY call=create-ruleset name=probe-canary-merge-queue
{"message":"Upgrade to GitHub Pro or make this repository public to enable this feature.","documentation_url":"https://docs.github.com/rest/repos/rules#create-a-repository-ruleset","status":"403"}gh: Upgrade to GitHub Pro or make this repository public to enable this feature. (HTTP 403)
CANARY call=create-ruleset exit=1
CANARY end=ruleset-merge-queue
CAPABILITY ruleset-merge-queue outcome=refused
```

### T10 — fork facts

```text
gh api repos/jambolo/patch-steward-testbed-public --jq '{full_name, fork, visibility, parent: .parent.full_name}'
{"fork":true,"full_name":"jambolo/patch-steward-testbed-public","parent":"steady-orchard/patch-steward-testbed-public","visibility":"public"}
```

### T11 — fork PR

```text
gh pr list -R steady-orchard/patch-steward-testbed-public --state all --head probe-canary-head-fork --json number,state,isCrossRepository,baseRefName,headRepositoryOwner,url
[{"baseRefName":"probe-canary-base","headRepositoryOwner":{"id":"MDQ6VXNlcjIwOTUxNzE=","name":"John Bolton","login":"jambolo"},"isCrossRepository":true,"number":1,"state":"CLOSED","url":"https://github.com/steady-orchard/patch-steward-testbed-public/pull/1"}]
```

### T12 — ssh-deploy blob identity confirmed on all three test-beds

```text
git rev-parse HEAD:probes/smoke/workflows/probe-smoke-machinery.yml
038e59c53b4b63b769f9116a9adbf84ad673d5a8

gh api repos/steady-orchard/patch-steward-testbed-public/contents/.github/workflows/probe-smoke-machinery.yml --jq .sha
038e59c53b4b63b769f9116a9adbf84ad673d5a8
gh api repos/steady-orchard/patch-steward-testbed-private/contents/.github/workflows/probe-smoke-machinery.yml --jq .sha
038e59c53b4b63b769f9116a9adbf84ad673d5a8
gh api repos/jambolo/patch-steward-testbed-personal/contents/.github/workflows/probe-smoke-machinery.yml --jq .sha
038e59c53b4b63b769f9116a9adbf84ad673d5a8
```

### T13 — dispatch confirmed on all three test-beds

```text
gh run list -R steady-orchard/patch-steward-testbed-public --workflow probe-smoke-machinery.yml --limit 1 --json databaseId,event,conclusion --jq '.[0]'
{"conclusion":"success","databaseId":36058315507,"event":"workflow_dispatch"}
gh run list -R steady-orchard/patch-steward-testbed-private --workflow probe-smoke-machinery.yml --limit 1 --json databaseId,event,conclusion --jq '.[0]'
{"conclusion":"success","databaseId":36058764257,"event":"workflow_dispatch"}
gh run list -R jambolo/patch-steward-testbed-personal --workflow probe-smoke-machinery.yml --limit 1 --json databaseId,event,conclusion --jq '.[0]'
{"conclusion":"success","databaseId":36059305382,"event":"workflow_dispatch"}
```

### T14 — app-token and app-check-run confirmed on all three test-beds

```text
gh api repos/steady-orchard/patch-steward-testbed-public/check-runs/107830828554 --jq '{id, name, conclusion, app_id: .app.id}'
{"app_id":4993303,"conclusion":"neutral","id":107830828554,"name":"probe-smoke/machinery"}
gh api repos/steady-orchard/patch-steward-testbed-private/check-runs/107832339980 --jq '{id, name, conclusion, app_id: .app.id}'
{"app_id":4993303,"conclusion":"neutral","id":107832339980,"name":"probe-smoke/machinery"}
gh api repos/jambolo/patch-steward-testbed-personal/check-runs/107833788656 --jq '{id, name, conclusion, app_id: .app.id}'
{"app_id":4993303,"conclusion":"neutral","id":107833788656,"name":"probe-smoke/machinery"}
```

### T15 — artifact-list confirmed on all three test-beds

```text
gh api repos/steady-orchard/patch-steward-testbed-public/actions/artifacts/10832839374 --jq '{id, name, expired}'
{"expired":false,"id":10832839374,"name":"probe-smoke-36058315507-1"}
gh api repos/steady-orchard/patch-steward-testbed-private/actions/artifacts/10833188644 --jq '{id, name, expired}'
{"expired":false,"id":10833188644,"name":"probe-smoke-36058764257-1"}
gh api repos/jambolo/patch-steward-testbed-personal/actions/artifacts/10833258806 --jq '{id, name, expired}'
{"expired":false,"id":10833258806,"name":"probe-smoke-36059206514-1"}
```

### T16 — fixture inventory on org-public

```text
gh workflow list -R steady-orchard/patch-steward-testbed-public --all --json path,state --jq '.[] | select(.path | startswith(".github/workflows/probe-")) | "\(.path) \(.state)"'
.github/workflows/probe-pa03-schedule-env.yml active
.github/workflows/probe-pa03-schedule.yml active
.github/workflows/probe-smoke-machinery.yml active

gh api repos/steady-orchard/patch-steward-testbed-public/environments --jq '[.environments[]?.name | select(startswith("probe-"))]'
["probe-pa03-default-branch"]

gh api repos/steady-orchard/patch-steward-testbed-public/branches --paginate --jq '[.[].name | select(startswith("probe-"))]'
["probe-pa03-base"]

gh api repos/steady-orchard/patch-steward-testbed-public/rulesets --jq '[.[] | {id, name}]'
[]
```

### T17 — fixture inventory on org-private

```text
gh workflow list -R steady-orchard/patch-steward-testbed-private --all --json path,state --jq '.[] | select(.path | startswith(".github/workflows/probe-")) | "\(.path) \(.state)"'
.github/workflows/probe-pa03-schedule-env.yml active
.github/workflows/probe-pa03-schedule.yml active
.github/workflows/probe-smoke-machinery.yml active

gh api repos/steady-orchard/patch-steward-testbed-private/environments --jq '[.environments[]?.name | select(startswith("probe-"))]'
["probe-pa03-default-branch"]

gh api repos/steady-orchard/patch-steward-testbed-private/branches --paginate --jq '[.[].name | select(startswith("probe-"))]'
["probe-pa03-base"]

gh api repos/steady-orchard/patch-steward-testbed-private/rulesets --jq '[.[] | {id, name}]'
{"message":"Upgrade to GitHub Pro or make this repository public to enable this feature.","documentation_url":"https://docs.github.com/rest/repos/rules#get-all-repository-rulesets","status":"403"}gh: Upgrade to GitHub Pro or make this repository public to enable this feature. (HTTP 403)
```

### T18 — fixture inventory on personal

```text
gh workflow list -R jambolo/patch-steward-testbed-personal --all --json path,state --jq '.[] | select(.path | startswith(".github/workflows/probe-")) | "\(.path) \(.state)"'
.github/workflows/probe-pa03-schedule-env.yml active
.github/workflows/probe-pa03-schedule.yml active
.github/workflows/probe-smoke-machinery.yml active

gh api repos/jambolo/patch-steward-testbed-personal/environments --jq '[.environments[]?.name | select(startswith("probe-"))]'
["probe-pa03-default-branch"]

gh api repos/jambolo/patch-steward-testbed-personal/branches --paginate --jq '[.[].name | select(startswith("probe-"))]'
["probe-pa03-base"]

gh api repos/jambolo/patch-steward-testbed-personal/rulesets --jq '[.[] | {id, name}]'
[]
```

### T19 — probe-canary-retention artifact on org-public and org-private

```text
gh api "repos/steady-orchard/patch-steward-testbed-public/actions/artifacts?name=probe-canary-retention" --jq '[.artifacts[] | {id, created_at, expires_at}]'
[{"created_at":"2026-09-24T20:57:38Z","expires_at":"2026-09-25T20:57:37Z","id":10832604674}]

gh api "repos/steady-orchard/patch-steward-testbed-private/actions/artifacts?name=probe-canary-retention" --jq '[.artifacts[] | {id, created_at, expires_at}]'
[{"created_at":"2026-09-24T21:01:52Z","expires_at":"2026-09-25T21:01:51Z","id":10833138561}]
```

### T20 — scheduled-trigger fixture: no run captured on org-private within the bounded wait; disabled

```text
gh run list -R steady-orchard/patch-steward-testbed-private --workflow probe-pa03-schedule.yml --event schedule --status completed --limit 5 --json databaseId,conclusion,createdAt,headBranch
[]
gh run list -R steady-orchard/patch-steward-testbed-private --workflow probe-pa03-schedule-env.yml --event schedule --status completed --limit 5 --json databaseId,conclusion,createdAt,headBranch
[]
(polled 3 times at 60 s intervals; all empty; org-public and personal returned the same empty result and stay enabled)

gh api repos/steady-orchard/patch-steward-testbed-private/actions/workflows/probe-pa03-schedule.yml/disable -X PUT
gh api repos/steady-orchard/patch-steward-testbed-private/actions/workflows/probe-pa03-schedule-env.yml/disable -X PUT
```

### T21 — final workflow state on all three test-beds after disabling

```text
gh workflow list -R steady-orchard/patch-steward-testbed-public --all --json path,state --jq '.[] | select(.path | startswith(".github/workflows/probe-")) | "\(.path) \(.state)"'
.github/workflows/probe-pa03-schedule-env.yml active
.github/workflows/probe-pa03-schedule.yml active
.github/workflows/probe-smoke-machinery.yml active

gh workflow list -R steady-orchard/patch-steward-testbed-private --all --json path,state --jq '.[] | select(.path | startswith(".github/workflows/probe-")) | "\(.path) \(.state)"'
.github/workflows/probe-pa03-schedule-env.yml disabled_manually
.github/workflows/probe-pa03-schedule.yml disabled_manually
.github/workflows/probe-smoke-machinery.yml active

gh workflow list -R jambolo/patch-steward-testbed-personal --all --json path,state --jq '.[] | select(.path | startswith(".github/workflows/probe-")) | "\(.path) \(.state)"'
.github/workflows/probe-pa03-schedule-env.yml active
.github/workflows/probe-pa03-schedule.yml active
.github/workflows/probe-smoke-machinery.yml active
```

### T22 — initial scheduled-run query on org-public and personal, and immediate disables

```text
date -u +%Y-%m-%dT%H:%M:%SZ; for T in steady-orchard/patch-steward-testbed-public jambolo/patch-steward-testbed-personal; do for S in probe-pa03-schedule.yml probe-pa03-schedule-env.yml; do echo "$T $S"; gh run list -R $T --workflow $S --event schedule --limit 100 --json databaseId,status,conclusion,createdAt,headBranch; gh run list -R $T --workflow $S --event schedule --status completed --limit 100 --json databaseId,createdAt --jq 'sort_by(.createdAt) | .[0] | "first=\(.databaseId) created=\(.createdAt)"'; done; done
2026-09-24T22:01:18Z
steady-orchard/patch-steward-testbed-public probe-pa03-schedule.yml
[]
first=null created=null
steady-orchard/patch-steward-testbed-public probe-pa03-schedule-env.yml
[]
first=null created=null
jambolo/patch-steward-testbed-personal probe-pa03-schedule.yml
[{"conclusion":"success","createdAt":"2026-09-24T21:53:07Z","databaseId":36064228359,"headBranch":"master","status":"completed"},{"conclusion":"success","createdAt":"2026-09-24T21:40:39Z","databaseId":36062978420,"headBranch":"master","status":"completed"}]
first=36062978420 created=2026-09-24T21:40:39Z
jambolo/patch-steward-testbed-personal probe-pa03-schedule-env.yml
[{"conclusion":"success","createdAt":"2026-09-24T22:00:32Z","databaseId":36064938300,"headBranch":"master","status":"completed"},{"conclusion":"success","createdAt":"2026-09-24T21:45:45Z","databaseId":36063493816,"headBranch":"master","status":"completed"}]
first=36063493816 created=2026-09-24T21:45:45Z

gh api repos/jambolo/patch-steward-testbed-personal/actions/workflows/probe-pa03-schedule.yml/disable -X PUT

gh api repos/jambolo/patch-steward-testbed-personal/actions/workflows/probe-pa03-schedule-env.yml/disable -X PUT
```

### T23 — bounded wait for scheduled runs on org-public

```text
r=$(gh api rate_limit --jq .resources.core.remaining); echo "rate_remaining=$r"; if [ "${r:-0}" -ge 500 ]; then for i in 1 2 3 4; do l="$(date -u +%Y-%m-%dT%H:%M:%SZ)"; hit=0; for S in probe-pa03-schedule.yml probe-pa03-schedule-env.yml; do n=$(gh run list -R steady-orchard/patch-steward-testbed-public --workflow $S --event schedule --status completed --limit 100 --json databaseId --jq length); l="$l $S=${n:-error}"; if [ "${n:-0}" != 0 ]; then hit=1; fi; done; echo "$l"; if [ $hit = 1 ]; then break; fi; sleep 120; done; fi
rate_remaining=5000
2026-09-24T22:01:39Z probe-pa03-schedule.yml=0 probe-pa03-schedule-env.yml=0
2026-09-24T22:03:40Z probe-pa03-schedule.yml=0 probe-pa03-schedule-env.yml=0
2026-09-24T22:05:42Z probe-pa03-schedule.yml=0 probe-pa03-schedule-env.yml=0
2026-09-24T22:07:44Z probe-pa03-schedule.yml=0 probe-pa03-schedule-env.yml=0
rate_remaining=5000
2026-09-24T22:09:53Z probe-pa03-schedule.yml=0 probe-pa03-schedule-env.yml=0
2026-09-24T22:11:55Z probe-pa03-schedule.yml=0 probe-pa03-schedule-env.yml=0
2026-09-24T22:13:56Z probe-pa03-schedule.yml=0 probe-pa03-schedule-env.yml=0
2026-09-24T22:15:58Z probe-pa03-schedule.yml=0 probe-pa03-schedule-env.yml=0
rate_remaining=5000
2026-09-24T22:18:06Z probe-pa03-schedule.yml=0 probe-pa03-schedule-env.yml=0
2026-09-24T22:20:07Z probe-pa03-schedule.yml=0 probe-pa03-schedule-env.yml=0
2026-09-24T22:22:09Z probe-pa03-schedule.yml=0 probe-pa03-schedule-env.yml=0
2026-09-24T22:24:11Z probe-pa03-schedule.yml=0 probe-pa03-schedule-env.yml=0
rate_remaining=5000
2026-09-24T22:26:19Z probe-pa03-schedule.yml=0 probe-pa03-schedule-env.yml=0
2026-09-24T22:28:21Z probe-pa03-schedule.yml=0 probe-pa03-schedule-env.yml=0
2026-09-24T22:30:22Z probe-pa03-schedule.yml=0 probe-pa03-schedule-env.yml=0
2026-09-24T22:32:24Z probe-pa03-schedule.yml=0 probe-pa03-schedule-env.yml=0
rate_remaining=5000
2026-09-24T22:34:32Z probe-pa03-schedule.yml=0 probe-pa03-schedule-env.yml=0
2026-09-24T22:36:33Z probe-pa03-schedule.yml=0 probe-pa03-schedule-env.yml=0
2026-09-24T22:38:35Z probe-pa03-schedule.yml=0 probe-pa03-schedule-env.yml=0
2026-09-24T22:40:36Z probe-pa03-schedule.yml=0 probe-pa03-schedule-env.yml=0
rate_remaining=5000
2026-09-24T22:42:45Z probe-pa03-schedule.yml=0 probe-pa03-schedule-env.yml=0
2026-09-24T22:44:47Z probe-pa03-schedule.yml=0 probe-pa03-schedule-env.yml=0
2026-09-24T22:46:49Z probe-pa03-schedule.yml=0 probe-pa03-schedule-env.yml=0
2026-09-24T22:48:51Z probe-pa03-schedule.yml=0 probe-pa03-schedule-env.yml=0
rate_remaining=5000
2026-09-24T22:51:00Z probe-pa03-schedule.yml=0 probe-pa03-schedule-env.yml=0
2026-09-24T22:53:01Z probe-pa03-schedule.yml=0 probe-pa03-schedule-env.yml=0
2026-09-24T22:55:03Z probe-pa03-schedule.yml=0 probe-pa03-schedule-env.yml=0
2026-09-24T22:57:04Z probe-pa03-schedule.yml=0 probe-pa03-schedule-env.yml=0
rate_remaining=5000
2026-09-24T22:59:12Z probe-pa03-schedule.yml=0 probe-pa03-schedule-env.yml=0
2026-09-24T23:01:14Z probe-pa03-schedule.yml=0 probe-pa03-schedule-env.yml=0
2026-09-24T23:03:16Z probe-pa03-schedule.yml=0 probe-pa03-schedule-env.yml=0
2026-09-24T23:05:17Z probe-pa03-schedule.yml=0 probe-pa03-schedule-env.yml=0
```

### T24 — settle observation after the last disable

Columns: UTC time, then total/open scheduled runs for org-public probe-pa03-schedule.yml, org-public probe-pa03-schedule-env.yml, personal probe-pa03-schedule.yml, personal probe-pa03-schedule-env.yml.

```text
for i in 1 2 3 4 5 6 7; do l="$(date -u +%Y-%m-%dT%H:%M:%SZ)"; for T in steady-orchard/patch-steward-testbed-public jambolo/patch-steward-testbed-personal; do for S in probe-pa03-schedule.yml probe-pa03-schedule-env.yml; do l="$l $(gh run list -R $T --workflow $S --event schedule --limit 100 --json status --jq '"\(length)/\([.[] | select(.status != "completed")] | length)"')"; done; done; echo "$l"; sleep 60; done
2026-09-24T23:07:26Z 0/0 0/0 2/0 2/0
2026-09-24T23:08:29Z 0/0 0/0 2/0 2/0
2026-09-24T23:09:32Z 0/0 0/0 2/0 2/0
2026-09-24T23:10:36Z 0/0 0/0 2/0 2/0
2026-09-24T23:11:39Z 0/0 0/0 2/0 2/0
2026-09-24T23:12:42Z 0/0 0/0 2/0 2/0
2026-09-24T23:13:45Z 0/0 0/0 2/0 2/0
```

### T25 — final completed scheduled runs and workflow states

```text
for T in steady-orchard/patch-steward-testbed-public jambolo/patch-steward-testbed-personal; do for S in probe-pa03-schedule.yml probe-pa03-schedule-env.yml; do echo "gh run list -R $T --workflow $S --event schedule --status completed --limit 100 --json databaseId,conclusion,createdAt,headBranch"; gh run list -R $T --workflow $S --event schedule --status completed --limit 100 --json databaseId,conclusion,createdAt,headBranch; done; done; for T in steady-orchard/patch-steward-testbed-public steady-orchard/patch-steward-testbed-private jambolo/patch-steward-testbed-personal; do echo "gh workflow list -R $T --all"; gh workflow list -R $T --all --json path,state --jq '.[] | select(.path | startswith(".github/workflows/probe-")) | "\(.path) \(.state)"'; done
gh run list -R steady-orchard/patch-steward-testbed-public --workflow probe-pa03-schedule.yml --event schedule --status completed --limit 100 --json databaseId,conclusion,createdAt,headBranch
[]
gh run list -R steady-orchard/patch-steward-testbed-public --workflow probe-pa03-schedule-env.yml --event schedule --status completed --limit 100 --json databaseId,conclusion,createdAt,headBranch
[]
gh run list -R jambolo/patch-steward-testbed-personal --workflow probe-pa03-schedule.yml --event schedule --status completed --limit 100 --json databaseId,conclusion,createdAt,headBranch
[{"conclusion":"success","createdAt":"2026-09-24T21:53:07Z","databaseId":36064228359,"headBranch":"master"},{"conclusion":"success","createdAt":"2026-09-24T21:40:39Z","databaseId":36062978420,"headBranch":"master"}]
gh run list -R jambolo/patch-steward-testbed-personal --workflow probe-pa03-schedule-env.yml --event schedule --status completed --limit 100 --json databaseId,conclusion,createdAt,headBranch
[{"conclusion":"success","createdAt":"2026-09-24T22:00:32Z","databaseId":36064938300,"headBranch":"master"},{"conclusion":"success","createdAt":"2026-09-24T21:45:45Z","databaseId":36063493816,"headBranch":"master"}]
gh workflow list -R steady-orchard/patch-steward-testbed-public --all
.github/workflows/probe-pa03-schedule-env.yml active
.github/workflows/probe-pa03-schedule.yml active
.github/workflows/probe-smoke-machinery.yml active
gh workflow list -R steady-orchard/patch-steward-testbed-private --all
.github/workflows/probe-pa03-schedule-env.yml disabled_manually
.github/workflows/probe-pa03-schedule.yml disabled_manually
.github/workflows/probe-smoke-machinery.yml active
gh workflow list -R jambolo/patch-steward-testbed-personal --all
.github/workflows/probe-pa03-schedule-env.yml disabled_manually
.github/workflows/probe-pa03-schedule.yml disabled_manually
.github/workflows/probe-smoke-machinery.yml active
```

### T26 — steady-state plan on the three test-beds

```text
bash probes/smoke/tools/steady-state.sh steady-orchard/patch-steward-testbed-public plan
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa01-sequence.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa02-list.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa02-upload.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa03-events.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa03-schedule-env.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa03-schedule.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa03-upstream.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa04-callee-perms.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa04-callee.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa04-ceiling-grant.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa04-ceiling-omit-copilot.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa04-ceiling-omit-issues.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa04-envs.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa04-pipeline.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa04-publish.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa05-concurrency.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa05-rounds.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa05-run.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa06-control.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa06-relay.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa06-steward.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa07-listen.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa07-write.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa08-infer.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa09-act.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa09-count.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa09-follow.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa09-listen.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-public workflow probe-smoke-machinery.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-public branch probe-pa01-head-1 would-delete
STEADY steady-orchard/patch-steward-testbed-public branch probe-pa03-head-absent would-delete
STEADY steady-orchard/patch-steward-testbed-public branch probe-pa03-head-modify would-delete
STEADY steady-orchard/patch-steward-testbed-public branch probe-pa03-head-nd would-delete
STEADY steady-orchard/patch-steward-testbed-public branch probe-pa06-head-1-1 would-delete
STEADY steady-orchard/patch-steward-testbed-public branch probe-pa06-head-1-2 would-delete
STEADY steady-orchard/patch-steward-testbed-public branch probe-pa06-head-1-3 would-delete
STEADY steady-orchard/patch-steward-testbed-public branch probe-pa06-head-1-4 would-delete
STEADY steady-orchard/patch-steward-testbed-public branch probe-pa06-head-1-5 would-delete
STEADY steady-orchard/patch-steward-testbed-public branch probe-pa06-head-2-1 would-delete
STEADY steady-orchard/patch-steward-testbed-public branch probe-pa06-head-2-2 would-delete
STEADY steady-orchard/patch-steward-testbed-public branch probe-pa06-head-2-3 would-delete
STEADY steady-orchard/patch-steward-testbed-public branch probe-pa06-head-2-4 would-delete
STEADY steady-orchard/patch-steward-testbed-public branch probe-pa06-head-2-5 would-delete
STEADY steady-orchard/patch-steward-testbed-public branch probe-pa07-head-1-app would-delete
STEADY steady-orchard/patch-steward-testbed-public branch probe-pa07-head-1-github would-delete
STEADY steady-orchard/patch-steward-testbed-public branch probe-pa07-head-2-app would-delete
STEADY steady-orchard/patch-steward-testbed-public branch probe-pa07-head-2-github would-delete
STEADY steady-orchard/patch-steward-testbed-public branch probe-pa09-head-1 would-delete
STEADY steady-orchard/patch-steward-testbed-public result=planned active_workflows=27 head_branches=19
```

```text
bash probes/smoke/tools/steady-state.sh steady-orchard/patch-steward-testbed-private plan
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa02-list.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa02-upload.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa03-events.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa03-schedule-env.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa03-schedule.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa03-upstream.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa04-callee-perms.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa04-callee.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa04-ceiling-grant.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa04-ceiling-omit-copilot.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa04-ceiling-omit-issues.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa04-envs.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa07-listen.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa07-write.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa08-infer.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-private workflow probe-smoke-machinery.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-private branch probe-pa03-head-absent would-delete
STEADY steady-orchard/patch-steward-testbed-private branch probe-pa03-head-modify would-delete
STEADY steady-orchard/patch-steward-testbed-private branch probe-pa03-head-nd would-delete
STEADY steady-orchard/patch-steward-testbed-private branch probe-pa07-head-1-app would-delete
STEADY steady-orchard/patch-steward-testbed-private branch probe-pa07-head-1-github would-delete
STEADY steady-orchard/patch-steward-testbed-private result=planned active_workflows=14 head_branches=5
```

```text
bash probes/smoke/tools/steady-state.sh jambolo/patch-steward-testbed-personal plan
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa01-sequence.yml active would-disable
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa03-events.yml active would-disable
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa03-schedule-env.yml disabled_manually keep
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa03-schedule.yml disabled_manually keep
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa03-upstream.yml active would-disable
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa04-callee-perms.yml active would-disable
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa04-callee.yml active would-disable
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa04-ceiling-grant.yml active would-disable
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa04-ceiling-omit-copilot.yml active would-disable
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa04-ceiling-omit-issues.yml active would-disable
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa04-envs.yml active would-disable
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa07-listen.yml active would-disable
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa07-write.yml active would-disable
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa08-cap.yml active would-disable
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa08-infer.yml active would-disable
STEADY jambolo/patch-steward-testbed-personal workflow probe-smoke-machinery.yml active would-disable
STEADY jambolo/patch-steward-testbed-personal branch probe-pa01-head-1 would-delete
STEADY jambolo/patch-steward-testbed-personal branch probe-pa03-head-modify would-delete
STEADY jambolo/patch-steward-testbed-personal branch probe-pa03-head-nd would-delete
STEADY jambolo/patch-steward-testbed-personal branch probe-pa07-head-1-app would-delete
STEADY jambolo/patch-steward-testbed-personal branch probe-pa07-head-1-github would-delete
STEADY jambolo/patch-steward-testbed-personal result=planned active_workflows=14 head_branches=5
```

### T27 — steady-state apply on the three test-beds

```text
bash probes/smoke/tools/steady-state.sh steady-orchard/patch-steward-testbed-public apply
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa01-sequence.yml active disabled
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa02-list.yml active disabled
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa02-upload.yml active disabled
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa03-events.yml active disabled
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa03-schedule-env.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa03-schedule.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa03-upstream.yml active disabled
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa04-callee-perms.yml active disabled
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa04-callee.yml active disabled
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa04-ceiling-grant.yml active disabled
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa04-ceiling-omit-copilot.yml active disabled
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa04-ceiling-omit-issues.yml active disabled
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa04-envs.yml active disabled
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa04-pipeline.yml active disabled
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa04-publish.yml active disabled
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa05-concurrency.yml active disabled
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa05-rounds.yml active disabled
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa05-run.yml active disabled
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa06-control.yml active disabled
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa06-relay.yml active disabled
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa06-steward.yml active disabled
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa07-listen.yml active disabled
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa07-write.yml active disabled
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa08-infer.yml active disabled
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa09-act.yml active disabled
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa09-count.yml active disabled
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa09-follow.yml active disabled
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa09-listen.yml active disabled
STEADY steady-orchard/patch-steward-testbed-public workflow probe-smoke-machinery.yml active disabled
STEADY steady-orchard/patch-steward-testbed-public branch probe-pa01-head-1 deleted
STEADY steady-orchard/patch-steward-testbed-public branch probe-pa03-head-absent deleted
STEADY steady-orchard/patch-steward-testbed-public branch probe-pa03-head-modify deleted
STEADY steady-orchard/patch-steward-testbed-public branch probe-pa03-head-nd deleted
STEADY steady-orchard/patch-steward-testbed-public branch probe-pa06-head-1-1 deleted
STEADY steady-orchard/patch-steward-testbed-public branch probe-pa06-head-1-2 deleted
STEADY steady-orchard/patch-steward-testbed-public branch probe-pa06-head-1-3 deleted
STEADY steady-orchard/patch-steward-testbed-public branch probe-pa06-head-1-4 deleted
STEADY steady-orchard/patch-steward-testbed-public branch probe-pa06-head-1-5 deleted
STEADY steady-orchard/patch-steward-testbed-public branch probe-pa06-head-2-1 deleted
STEADY steady-orchard/patch-steward-testbed-public branch probe-pa06-head-2-2 deleted
STEADY steady-orchard/patch-steward-testbed-public branch probe-pa06-head-2-3 deleted
STEADY steady-orchard/patch-steward-testbed-public branch probe-pa06-head-2-4 deleted
STEADY steady-orchard/patch-steward-testbed-public branch probe-pa06-head-2-5 deleted
STEADY steady-orchard/patch-steward-testbed-public branch probe-pa07-head-1-app deleted
STEADY steady-orchard/patch-steward-testbed-public branch probe-pa07-head-1-github deleted
STEADY steady-orchard/patch-steward-testbed-public branch probe-pa07-head-2-app deleted
STEADY steady-orchard/patch-steward-testbed-public branch probe-pa07-head-2-github deleted
STEADY steady-orchard/patch-steward-testbed-public branch probe-pa09-head-1 deleted
STEADY steady-orchard/patch-steward-testbed-public result=steady active_workflows=0 head_branches=0
```

```text
bash probes/smoke/tools/steady-state.sh steady-orchard/patch-steward-testbed-private apply
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa02-list.yml active disabled
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa02-upload.yml active disabled
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa03-events.yml active disabled
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa03-schedule-env.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa03-schedule.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa03-upstream.yml active disabled
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa04-callee-perms.yml active disabled
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa04-callee.yml active disabled
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa04-ceiling-grant.yml active disabled
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa04-ceiling-omit-copilot.yml active disabled
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa04-ceiling-omit-issues.yml active disabled
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa04-envs.yml active disabled
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa07-listen.yml active disabled
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa07-write.yml active disabled
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa08-infer.yml active disabled
STEADY steady-orchard/patch-steward-testbed-private workflow probe-smoke-machinery.yml active disabled
STEADY steady-orchard/patch-steward-testbed-private branch probe-pa03-head-absent deleted
STEADY steady-orchard/patch-steward-testbed-private branch probe-pa03-head-modify deleted
STEADY steady-orchard/patch-steward-testbed-private branch probe-pa03-head-nd deleted
STEADY steady-orchard/patch-steward-testbed-private branch probe-pa07-head-1-app deleted
STEADY steady-orchard/patch-steward-testbed-private branch probe-pa07-head-1-github deleted
STEADY steady-orchard/patch-steward-testbed-private result=steady active_workflows=0 head_branches=0
```

```text
bash probes/smoke/tools/steady-state.sh jambolo/patch-steward-testbed-personal apply
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa01-sequence.yml active disabled
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa03-events.yml active disabled
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa03-schedule-env.yml disabled_manually keep
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa03-schedule.yml disabled_manually keep
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa03-upstream.yml active disabled
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa04-callee-perms.yml active disabled
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa04-callee.yml active disabled
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa04-ceiling-grant.yml active disabled
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa04-ceiling-omit-copilot.yml active disabled
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa04-ceiling-omit-issues.yml active disabled
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa04-envs.yml active disabled
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa07-listen.yml active disabled
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa07-write.yml active disabled
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa08-cap.yml active disabled
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa08-infer.yml active disabled
STEADY jambolo/patch-steward-testbed-personal workflow probe-smoke-machinery.yml active disabled
STEADY jambolo/patch-steward-testbed-personal branch probe-pa01-head-1 deleted
STEADY jambolo/patch-steward-testbed-personal branch probe-pa03-head-modify deleted
STEADY jambolo/patch-steward-testbed-personal branch probe-pa03-head-nd deleted
STEADY jambolo/patch-steward-testbed-personal branch probe-pa07-head-1-app deleted
STEADY jambolo/patch-steward-testbed-personal branch probe-pa07-head-1-github deleted
STEADY jambolo/patch-steward-testbed-personal result=steady active_workflows=0 head_branches=0
```

### T28 — steady-state verification on the three test-beds

```text
for r in steady-orchard/patch-steward-testbed-public steady-orchard/patch-steward-testbed-private jambolo/patch-steward-testbed-personal; do echo "== $r"; echo "active=$(gh workflow list -R $r --all --json path,state --jq '[.[] | select(.path | startswith(".github/workflows/probe-")) | select(.state != "disabled_manually")] | length') open_issues=$(gh issue list -R $r --state open --search 'probe in:title' --json number --jq length) open_prs=$(gh pr list -R $r --state open --search 'probe in:title' --json number --jq length) head_branches=$(gh api repos/$r/branches --paginate --jq '.[].name' | grep -c '^probe-pa0[1-9]-head-')"; done
== steady-orchard/patch-steward-testbed-public
active=0 open_issues=0 open_prs=0 head_branches=0
== steady-orchard/patch-steward-testbed-private
active=0 open_issues=0 open_prs=0 head_branches=0
== jambolo/patch-steward-testbed-personal
active=0 open_issues=0 open_prs=0 head_branches=0
```

### T29 — retention canary artifacts and allow_auto_merge read

```text
date -u +%Y-%m-%dT%H:%M:%SZ; for r in steady-orchard/patch-steward-testbed-public steady-orchard/patch-steward-testbed-private; do echo "== $r"; gh api "repos/$r/actions/artifacts?name=probe-canary-retention" --jq '.total_count, (.artifacts[] | {id, expired, created_at, expires_at})'; done; gh api repos/steady-orchard/patch-steward-testbed-public --jq '{allow_auto_merge}'
2026-09-25T06:20:51Z
== steady-orchard/patch-steward-testbed-public
1
{"created_at":"2026-09-24T20:57:38Z","expired":false,"expires_at":"2026-09-25T20:57:37Z","id":10832604674}
== steady-orchard/patch-steward-testbed-private
1
{"created_at":"2026-09-24T21:01:52Z","expired":false,"expires_at":"2026-09-25T21:01:51Z","id":10833138561}
{"allow_auto_merge":false}
```

### T30 — Phase 4 steady-state plan on the three test-beds

```text
bash probes/smoke/tools/steady-state.sh steady-orchard/patch-steward-testbed-public plan
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa01-sequence.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa02-list.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa02-upload.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa03-events.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa03-schedule-env.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa03-schedule.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa03-upstream.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa04-callee-perms.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa04-callee-secrets.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa04-callee.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa04-ceiling-grant.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa04-ceiling-omit-copilot.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa04-ceiling-omit-issues.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa04-envs.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa04-pipeline.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa04-publish.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa04-w1-host-personal.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa04-w2-host-personal.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa05-concurrency.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa05-rounds.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa05-run.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa06-control.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa06-relay.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa06-steward.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa07-listen.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa07-write.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa08-infer.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa09-act.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa09-count.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa09-follow.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa09-listen.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-smoke-machinery.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public result=planned active_workflows=3 head_branches=0
```

```text
bash probes/smoke/tools/steady-state.sh steady-orchard/patch-steward-testbed-private plan
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa02-list.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa02-upload.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa03-events.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa03-schedule-env.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa03-schedule.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa03-upstream.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa04-callee-perms.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa04-callee.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa04-ceiling-grant.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa04-ceiling-omit-copilot.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa04-ceiling-omit-issues.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa04-envs.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa04-w1-host-org-public.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa04-w1-host-personal.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa04-w2-host-org-public.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa04-w2-host-personal.yml active would-disable
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa07-listen.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa07-write.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa08-infer.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-private workflow probe-smoke-machinery.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-private result=planned active_workflows=4 head_branches=0
```

```text
bash probes/smoke/tools/steady-state.sh jambolo/patch-steward-testbed-personal plan
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa01-sequence.yml disabled_manually keep
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa03-events.yml disabled_manually keep
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa03-schedule-env.yml disabled_manually keep
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa03-schedule.yml disabled_manually keep
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa03-upstream.yml disabled_manually keep
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa04-callee-perms.yml disabled_manually keep
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa04-callee-secrets.yml active would-disable
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa04-callee.yml disabled_manually keep
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa04-ceiling-grant.yml disabled_manually keep
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa04-ceiling-omit-copilot.yml disabled_manually keep
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa04-ceiling-omit-issues.yml disabled_manually keep
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa04-envs.yml disabled_manually keep
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa04-w1-host-org-public.yml active would-disable
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa04-w2-host-org-public.yml active would-disable
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa07-listen.yml disabled_manually keep
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa07-write.yml disabled_manually keep
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa08-cap.yml disabled_manually keep
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa08-infer.yml disabled_manually keep
STEADY jambolo/patch-steward-testbed-personal workflow probe-smoke-machinery.yml disabled_manually keep
STEADY jambolo/patch-steward-testbed-personal result=planned active_workflows=3 head_branches=0
```

### T31 — Phase 4 steady-state apply on the three test-beds

```text
bash probes/smoke/tools/steady-state.sh steady-orchard/patch-steward-testbed-public apply
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa01-sequence.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa02-list.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa02-upload.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa03-events.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa03-schedule-env.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa03-schedule.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa03-upstream.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa04-callee-perms.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa04-callee-secrets.yml active disabled
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa04-callee.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa04-ceiling-grant.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa04-ceiling-omit-copilot.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa04-ceiling-omit-issues.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa04-envs.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa04-pipeline.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa04-publish.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa04-w1-host-personal.yml active disabled
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa04-w2-host-personal.yml active disabled
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa05-concurrency.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa05-rounds.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa05-run.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa06-control.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa06-relay.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa06-steward.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa07-listen.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa07-write.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa08-infer.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa09-act.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa09-count.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa09-follow.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-pa09-listen.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public workflow probe-smoke-machinery.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-public result=steady active_workflows=0 head_branches=0
```

```text
bash probes/smoke/tools/steady-state.sh steady-orchard/patch-steward-testbed-private apply
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa02-list.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa02-upload.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa03-events.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa03-schedule-env.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa03-schedule.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa03-upstream.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa04-callee-perms.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa04-callee.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa04-ceiling-grant.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa04-ceiling-omit-copilot.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa04-ceiling-omit-issues.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa04-envs.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa04-w1-host-org-public.yml active disabled
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa04-w1-host-personal.yml active disabled
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa04-w2-host-org-public.yml active disabled
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa04-w2-host-personal.yml active disabled
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa07-listen.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa07-write.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-private workflow probe-pa08-infer.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-private workflow probe-smoke-machinery.yml disabled_manually keep
STEADY steady-orchard/patch-steward-testbed-private result=steady active_workflows=0 head_branches=0
```

```text
bash probes/smoke/tools/steady-state.sh jambolo/patch-steward-testbed-personal apply
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa01-sequence.yml disabled_manually keep
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa03-events.yml disabled_manually keep
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa03-schedule-env.yml disabled_manually keep
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa03-schedule.yml disabled_manually keep
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa03-upstream.yml disabled_manually keep
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa04-callee-perms.yml disabled_manually keep
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa04-callee-secrets.yml active disabled
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa04-callee.yml disabled_manually keep
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa04-ceiling-grant.yml disabled_manually keep
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa04-ceiling-omit-copilot.yml disabled_manually keep
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa04-ceiling-omit-issues.yml disabled_manually keep
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa04-envs.yml disabled_manually keep
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa04-w1-host-org-public.yml active disabled
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa04-w2-host-org-public.yml active disabled
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa07-listen.yml disabled_manually keep
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa07-write.yml disabled_manually keep
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa08-cap.yml disabled_manually keep
STEADY jambolo/patch-steward-testbed-personal workflow probe-pa08-infer.yml disabled_manually keep
STEADY jambolo/patch-steward-testbed-personal workflow probe-smoke-machinery.yml disabled_manually keep
STEADY jambolo/patch-steward-testbed-personal result=steady active_workflows=0 head_branches=0
```

### T32 — Phase 4 steady-state verification and org-private scheduled-trigger state

```text
for r in steady-orchard/patch-steward-testbed-public steady-orchard/patch-steward-testbed-private jambolo/patch-steward-testbed-personal; do echo "== $r"; echo "active=$(gh workflow list -R $r --all --json path,state --jq '[.[] | select(.path | startswith(".github/workflows/probe-")) | select(.state != "disabled_manually")] | length') open_issues=$(gh issue list -R $r --state open --search 'probe in:title' --json number --jq length) open_prs=$(gh pr list -R $r --state open --search 'probe in:title' --json number --jq length) head_branches=$(gh api repos/$r/branches --paginate --jq '.[].name' | grep -c '^probe-pa0[1-9]-head-')"; done; gh workflow list -R steady-orchard/patch-steward-testbed-private --all --json path,state --jq '.[] | select(.path | test("probe-pa03-schedule")) | "\(.path) \(.state)"'
== steady-orchard/patch-steward-testbed-public
active=0 open_issues=0 open_prs=0 head_branches=0
== steady-orchard/patch-steward-testbed-private
active=0 open_issues=0 open_prs=0 head_branches=0
== jambolo/patch-steward-testbed-personal
active=0 open_issues=0 open_prs=0 head_branches=0
.github/workflows/probe-pa03-schedule-env.yml disabled_manually
.github/workflows/probe-pa03-schedule.yml disabled_manually
```
