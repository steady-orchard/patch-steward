- status: pass
- base: ded94d936391ac61e872394f93f9a1651209ed8f
- changes: |
    - packages/core/src/github/app-auth.ts (new): RS256 App JWT builder (createAppJwt, using node:crypto createPrivateKey/sign,
      backdated per APP_JWT_BACKDATE_SECONDS/APP_JWT_LIFETIME_SECONDS), per-repository installation lookup
      (lookupInstallationId), installation token minting with exact repository/permission scope enforcement and
      auto-revocation on scope mismatch (mintInstallationToken), token revocation (revokeInstallationToken), and App bot
      user id lookup (lookupAppBotUserId), plus the required schemas, types, and failure codes exactly as specified; built
      only on './client.js', './writer.js', './budget.js', './reader.js', '../policy/bounds.js', and '../result.js'.
    - packages/core/src/github/app-auth.test.ts (new): describe 'github app authentication' with the 12 required it titles,
      a recording fake fetch answering the documented endpoints, RSA (pkcs1/pkcs8) and EC keys generated at runtime, and a
      token sample built by string concatenation ('gh' + 's_' + ...); verifies JWT signing/backdating, key-format
      acceptance, credential rejection with zero fetch calls, exact-scope enforcement (extra repository, wrong repository,
      excess permission value, unrequested non-metadata permission, non-'read' metadata) with revocation on mismatch,
      metadata:'read' as an accepted implicit grant, revocation and bot-lookup requests/headers, budget exhaustion, absence
      of the private key/JWTs/tokens from any produced Result or recorded request, and redaction of the key and token via
      redactTexts.
    - development-artifacts/patch-steward-m6-2.6-report.md (new): this report.
- acceptance: |
    1. pnpm vitest run packages/core/src/github/app-auth.test.ts --reporter=json --outputFile=node_modules/.m6-p2-2.6.json
       -> exit 0 (JSON report written to C:/w/m6-2.6/node_modules/.m6-p2-2.6.json)
    2. node -e "...titles check..." -> titles ok
    3. grep -cE "ghs_[A-Za-z0-9]|BEGIN [A-Z ]*PRIVATE KEY-----[A-Za-z0-9+/]" packages/core/src/github/app-auth.ts packages/core/src/github/app-auth.test.ts
       -> packages/core/src/github/app-auth.ts:0
          packages/core/src/github/app-auth.test.ts:0
          (grep exit 1, as expected)
    4. pnpm vitest run -> Test Files 158 passed (158), Tests 2973 passed (2973); exit 0
    5. pnpm typecheck -> completed with no diagnostics printed; exit 0
    6. pnpm exec eslint packages/core/src/github/app-auth.ts packages/core/src/github/app-auth.test.ts -> exit 0 (no output)
    7. pnpm exec prettier --check packages/core/src/github/app-auth.ts packages/core/src/github/app-auth.test.ts
       -> "Checking formatting...\nAll matched files use Prettier code style!"; exit 0
    8. cat packages/core/src/github/app-auth.test.ts | grep -cE "mkdtemp|tmpdir|writeFile|child_process" -> 0 (grep exit 1, as expected)
    9. node -e "...control/bidi/zero-width scan..." packages/core/src/github/app-auth.ts packages/core/src/github/app-auth.test.ts
       -> clean
- deviations: none
