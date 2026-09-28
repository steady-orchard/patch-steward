# Scenario results: org-public

Test-bed `steady-orchard/patch-steward-testbed-public`. Verbatim evidence from the test-bed scenario suite described in
`../README.md`; command output is copied unchanged inside `text` fences. Sections appear in the order the scenarios ran.

## S17 publication Environment delivers the App secrets only to Environment jobs

Date (UTC): 2026-09-28. Run: https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36409896857.

```text
$ bash scenarios/tools/environment-check.sh steady-orchard/patch-steward-testbed-public
ENVIRONMENT repo=steady-orchard/patch-steward-testbed-public check=environment-secrets expected=["PATCH_STEWARD_APP_ID","PATCH_STEWARD_APP_PRIVATE_KEY"] actual=["PATCH_STEWARD_APP_ID","PATCH_STEWARD_APP_PRIVATE_KEY"] ok
ENVIRONMENT repo=steady-orchard/patch-steward-testbed-public check=deployment-branches expected=["master"] actual=["master"] ok
ENVIRONMENT repo=steady-orchard/patch-steward-testbed-public check=repository-secrets expected=[] actual=[] ok
ENVIRONMENT repo=steady-orchard/patch-steward-testbed-public check=organization-secrets expected=[] actual=[] ok
ENVIRONMENT repo=steady-orchard/patch-steward-testbed-public result=ok
```

```text
$ bash scenarios/tools/secret-scope.sh run steady-orchard/patch-steward-testbed-public
SECRET-SCOPE check=mapping identical
SECRET-SCOPE check=declarations identical
DEPLOY repo=steady-orchard/patch-steward-testbed-public branch=master existed=yes
DEPLOY commit=39d3426736d1e497675c8884cf16e1fbe3858fc5 message=scenario: deploy secret-scope pair
DEPLOY push=ok attempt=1 head=39d3426736d1e497675c8884cf16e1fbe3858fc5
DEPLOY identical dest=.github/workflows/scenario-secret-scope.yml blob=3a488c17d9813f607bd810bf70be21a4c173d831
DEPLOY identical dest=.github/workflows/scenario-secret-scope-called.yml blob=9020f1a58702ee33bab4f83555a6e5ba9fb00168
SECRET-SCOPE job=inside line=PATCH_STEWARD_APP_ID length-zero=false
SECRET-SCOPE job=inside line=PATCH_STEWARD_APP_PRIVATE_KEY length-zero=false
SECRET-SCOPE job=outside line=PATCH_STEWARD_APP_ID length-zero=true
SECRET-SCOPE job=outside line=PATCH_STEWARD_APP_PRIVATE_KEY length-zero=true
SECRET-SCOPE repo=steady-orchard/patch-steward-testbed-public run=36409896857 url=https://github.com/steady-orchard/patch-steward-testbed-public/actions/runs/36409896857 result=pass
```

Result: pass
