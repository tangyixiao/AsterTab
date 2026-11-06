# Learning diagnostic source selection and preview — acceptance

Date: 2026-09-28 (Asia/Shanghai). Scope: `ai <request>` local draft, selected public source readers, and exact prospective outbound preview. No AI request or private GitHub path was implemented.

## Build and tests

| Gate | Observation |
| --- | --- |
| `npm ci` | Exit 0; 205 packages; `wxt prepare` completed. |
| `npm test` | Exit 0; four files, 37 tests passed (after the HTTP 403 recovery test was added). The existing Vite native-config warning remains. |
| `npm run typecheck` | Exit 0; no TypeScript diagnostics. |
| `npm run build` | Exit 0; WXT 0.21.4 produced Chrome MV3 new-tab build. |
| `npm run build:edge` | Exit 0; WXT 0.21.4 produced Edge MV3 new-tab build. |

Both production manifests contain exactly two `optional_host_permissions`: `https://www.luogu.com.cn/*` and `https://api.github.com/*`. Neither contains required `permissions`, `host_permissions`, a background worker, or content scripts. The generated new-tab page uses packaged HTML, JS, and CSS. The final production JS chunk was 26.29 kB in each build; this is a bundle observation, not a performance target.

## Real Edge new-tab checks

An isolated temporary Edge profile loaded the final `D:\AsterTab\.output\edge-mv3` build as an unpacked extension. CDP `/json/version` reported `Edg/154.0.4258.37`. The new-tab document resolved to `chrome-extension://ekalhcolgnnlnmiaoapdkpjaomacfcih/newtab.html`. A local, temporary CDP script drove the page and observed:

| Action | Observed result |
| --- | --- |
| Submit `ai explain` | The `学习诊断资料` draft opened. Preview began with `学习诊断请求\nexplain`; no send/diagnose button existed. |
| Paste `<script>alert(1)</script>` into selected submission | The literal string appeared inside preview; no inline script node was created. |
| Uncheck submission | Its text disappeared from preview, leaving `（未选择资料）`. |
| Enter `https://evil.example/problem/P1001` and click read | Local error: `只支持指定服务的 HTTPS 页面 URL，且不能带参数或片段。` No source text appeared. |
| Close and reopen with `ai again` | New preview showed `again`; submission textarea was empty. |
| Submit `g dynamic programming` | CDP saw document navigation to `https://www.google.com/search?q=dynamic+programming`. |

With CDP network emulation set to offline before reloading the new tab, the input and `ai offline` draft remained usable. `Network.requestWillBeSent` recorded only three extension-origin resources: new-tab HTML, its packaged JS chunk, and its packaged CSS. It recorded no external-origin request for that flow.

Clicking `读取此题面` for valid P1001 in the hidden automated Edge run left the button at `读取中…` while the browser's optional host permission prompt awaited a user choice. Therefore this run does **not** verify a completed permission grant or live source fetch in Edge. Unit tests verify exact request targets, omitted credentials, redirect rejection, response limits, and parsed content under injected responses. Separately, a read-only host request for the public P1001 page returned HTTP 200 and included `lentille-context` problem data. A read-only request to the public GitHub Contents API returned HTTP 403 (`rate limit exceeded`) from this machine; the added test verifies that the UI reader reports a useful 403 error and does not try another endpoint.

Independent code review found that a GitHub `blob/<ref>/<path>` URL can silently identify the wrong file when a slash-containing branch name overlaps a tag and file path. Automated GitHub reading was therefore restricted to URLs with a 40-hex commit SHA; ordinary branch/tag URLs now give a local error and retain the paste fallback. A regression test failed before this change and passed afterward. The final SHA restriction was verified by unit tests and production builds; the Edge UI observations above were captured before this last source-reader change.

## Limits and cleanup

Chrome's branded browser ignored the `--load-extension` switch in a separate temporary profile. This run verified the Chrome production build and manifest but did not perform fresh Chrome UI interaction; the earlier Command Center first-slice Chrome acceptance does not cover this new draft.

All isolated Edge process trees were stopped after the run. No listeners remained on the test CDP ports 10447–10450. Temporary profile directories and the temporary CDP script were left under the user's Temp directory for possible inspection; the regular browser profiles were not opened for this acceptance.

Primary interface references: [Chrome optional host permissions](https://developer.chrome.com/docs/extensions/mv3/declare_permissions), [GitHub repository contents API](https://docs.github.com/en/rest/repos/contents), [GitHub REST rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api), and [Luogu P1001](https://www.luogu.com.cn/problem/P1001).

## Repeatable source entries follow-up

Date: 2026-09-29 (Asia/Shanghai). The draft now allows multiple GitHub file entries and multiple manually pasted submission records. Each entry has independent text, inclusion, and removal; GitHub entries also have independent read status. Submission entries may include a link. Only included non-empty entries appear in the preview, in entry order. No submission history is fetched and no AI call was added.

| Gate | Observation |
| --- | --- |
| `npm test -- tests/diagnostic/github-code-drafts.test.ts` | Exit 0; 4 tests passed for independent drafts, selection order, exclusion, and removal. |
| `npm test -- tests/diagnostic/submission-drafts.test.ts` | Exit 0; 4 tests passed for independent entries, link retention, exclusion, and removal. |
| `npm test` | Exit 0; 6 files, 45 tests passed. The existing Vite native-config warning remains. |
| `npm run typecheck` | Exit 0; no TypeScript diagnostics. |
| `npm run build` / `npm run build:edge` | Both exited 0; each produced a 28.05 kB JavaScript chunk. |
| Chrome and Edge manifests | Both contain only the existing optional Luogu and GitHub API hosts; no required permissions, background worker, or content scripts. |

An isolated Edge launch with the production build and `--load-extension` did not expose an AsterTab extension page: the profile remained on Edge's sync-confirmation/new-tab pages, and the CDP endpoint was gone before a follow-up UI check. This follow-up therefore has no real-browser interaction result for the repeatable source controls. The earlier Edge interaction results above apply to the prior single-entry UI only.

## OpenRouter diagnostic integration

Date: 2026-09-29 (Asia/Shanghai). The user selected OpenRouter API key as the first provider. This update implements the fixed Chat Completions path for the existing explicitly opened learning-diagnostic draft. It does not make network requests on draft open or save.

| Gate | Observation |
| --- | --- |
| `npm test` | Exit 0; 9 files, 61 tests passed. The existing Vite native-config warning remains. |
| `npm run typecheck` | Exit 0; no TypeScript diagnostics. |
| `npm run build` / `npm run build:edge` | Both exited 0; each produced a 38.84 kB JavaScript chunk (41.26 kB total output). |
| Chrome and Edge manifests | Both require only `storage`; Luogu, GitHub API, and `https://openrouter.ai/*` remain optional hosts. No background worker or content script was added. |
| Production output secret scan | Neither build contains the test key sentinel `sk-or-test-secret` or the environment-variable name `OPENROUTER_API_KEY`. |

The API key is explicitly saved to `storage.session`; the selected model ID is saved to local extension storage. Before each send, the UI shows the exact serialized JSON body, selected content, fixed endpoint, and an explicit disclosure that OpenRouter forwards requests to the chosen model provider. The same serialized body is used for preview and fetch. Sending requires a fresh checkbox confirmation and button click, then requests the optional OpenRouter host permission. Changes to the request, selected context, or model invalidate confirmation. The call has bounded context/response sizes and a 60-second timeout; errors do not expose raw provider response bodies and requests do not auto-retry or switch models.

No real API key was supplied and no live OpenRouter request was made. No fresh browser UI interaction was completed for this integration, so permission-prompt behavior and an end-to-end rendered send/result flow remain unverified in a real browser. Unit tests cover request construction, key separation, consent freshness, cancellation, response handling, and failure behavior; builds and generated manifest checks are independent production-artifact observations.

## OpenRouter response handling and browser regression follow-up

Date: 2026-10-01 (Asia/Shanghai). This follow-up continues the existing integration and preserves the earlier uncommitted work. It adds no dependencies, providers, required hosts, background worker, or content scripts.

OpenRouter can report generation failures in a response whose HTTP status is 200; see its [error handling documentation](https://openrouter.ai/docs/api_reference/errors-and-debugging). Three new tests first failed against the existing implementation: an HTTP 200 error envelope with partial text was accepted, `finish_reason: "error"` with partial text was accepted, and a raw fetch exception reached the caller unchanged. The adapter now rejects both failed completions, maps a valid numeric error code to a local message, and hides raw transport details. A further test verifies cancellation at exactly 60 seconds and no automatic retry using fake time.

| Gate | Fresh observation |
| --- | --- |
| `npm test` | Exit 0; 9 files, 65 tests passed. The existing Vite native-config warning remains. |
| `npm run typecheck` | Exit 0; no TypeScript diagnostics. |
| `npm run build` / `npm run build:edge` | Both exited 0; each produced a 39.23 kB JS chunk, 41.66 kB total output. |
| Production manifests | Both require only `storage`; Luogu, GitHub API and OpenRouter hosts remain optional. No background or content scripts. |
| Production secret scan | Neither build contains `sk-or-test-secret`, `sk-or-browser-test-only` or `OPENROUTER_API_KEY`. |
| Browser harness syntax | `node --check tests/browser/diagnostic-openrouter.mjs` exited 0. |
| Edge production UI | Edge 154.0.4258.37; all 10 browser checks passed. |
| Chrome production UI | Chrome 154.0.8037.58; all 10 browser checks passed. |

The new [browser harness](../../tests/browser/diagnostic-openrouter.mjs) loads the production build into an isolated temporary persistent profile using the [CDP Extensions API](https://chromedevtools.github.io/devtools-protocol/tot/Extensions/). It runs the real Preact UI and Chrome local/session storage APIs. It replaces only the optional host permission request outcome and intercepts external page requests. Each browser run intercepted three fake API requests, saw no unexpected external page request and reported no page errors. The harness closes its own browser and temporary profile in `finally`.

The 10 browser checks cover:

1. The production new tab opens without an AI request.
2. Saving the model/key uses local/session storage respectively, clears the password input and makes no request or host permission call.
3. Multiple submission/file entries, exclusion and inert script-like pasted text produce the visible preview without the key.
4. Editing after confirmation clears the checkbox and disables sending.
5. Permission denial sends nothing and consumes the previous confirmation.
6. Editing while permission is pending prevents the old payload from being sent after permission resolves.
7. The actual POST body equals the visible JSON byte for byte; the key is only in the header, the result is inert text and confirmation is consumed.
8. A 401 preserves source input, clears the previous result, hides the raw provider body and causes no retry.
9. Closing during a pending API request discards context; reopening keeps only settings, and explicit key removal empties session storage.
10. Offline reload keeps the command entry and local diagnostic editing usable without an AI call.

Repeat with an **existing** Playwright installation; `--playwright-core` points to that installation's `index.mjs` and does not install anything. The default browser is Edge; use `--browser` for another executable. `--output` optionally saves a JSON report and screenshot outside the source tree.

```powershell
node tests/browser/diagnostic-openrouter.mjs --help
node tests/browser/diagnostic-openrouter.mjs --playwright-core 'D:\tangyixiao.github.io\node_modules\playwright-core\index.mjs' --build .output/edge-mv3
node tests/browser/diagnostic-openrouter.mjs --playwright-core 'D:\tangyixiao.github.io\node_modules\playwright-core\index.mjs' --browser 'C:\Program Files\Google\Chrome\Application\chrome.exe' --build .output/chrome-mv3
```

These results supersede the earlier absence of browser UI checks for repeatable entries and OpenRouter sending. **Native permission-prompt interaction, a real host grant and live OpenRouter inference remain unverified.** No real key or paid API call was used. The response fixes were reviewed locally and verified by regression tests; this follow-up does not claim a separate reviewer, CI result, commit or push.

## Live host-permission prompt and real-endpoint verification

Date: 2026-10-17 (Asia/Shanghai). This follow-up extends the [browser harness](../../tests/browser/diagnostic-openrouter.mjs) with `--live` / `--headed` and drops the attempted `--pre-grant` route: CDP `Browser.grantPermissions` only governs page content permissions, not extension optional host permissions, so a pre-grant cannot bypass the native prompt. Live mode drives the real `chrome.permissions.request` flow instead. This supersedes the preceding section's note about the native prompt and host grant; a successful live inference with a real key is still open.

Two harness corrections were verified before the live run:

1. Pending-permission race (found as a Chrome-only flake at harness check 6): the edit's re-render flushes on a macrotask while the permission resolve callback is a microtask, so on Chrome the resumed send could read the stale payload before the new preview committed. The harness now waits until `#openrouter-request-preview` contains the edited request text before resolving the stubbed permission; both browsers then pass deterministically.
2. Live-path split: live mode skips the stub-only checks (denial, pending edit, intercepted fakes), refuses to run without `--headed` because the native prompt needs a human, and waits up to 300 s for `chrome.permissions.contains` before asserting the real 401 flow.

| Gate | Fresh observation |
| --- | --- |
| `node --check tests/browser/diagnostic-openrouter.mjs` | Exit 0. |
| Edge stub regression | Edge 155.0.4283.45; all 10 checks passed; 3 intercepted fakes; no unexpected external requests; no page errors. |
| Chrome stub regression | Chrome 155.0.8059.84; all 10 checks passed with the same counts; previously flaky at check 6, now deterministic. |
| Edge live run | Edge 155.0.4283.45; 9 live checks passed, mode `live`. |

The live run loaded the production Edge build into an isolated persistent profile and used the default disposable sentinel key `sk-or-browser-test-only` — no real API key and no paid call. A human approved the native host-permission prompt in the visible browser window. Observed:

| Live step | Observed result |
| --- | --- |
| Native prompt | Appeared once, was approved by a human, after which `chrome.permissions.contains({ origins: ["https://openrouter.ai/*"] })` returned true; the grant persisted in the profile. |
| Real send | The confirmed request reached the real `https://openrouter.ai/api/v1/chat/completions` with the preview body and `Bearer` sentinel key; OpenRouter answered HTTP 401 and the UI surfaced the 401 alert, preserved the source preview, hid the raw provider detail, rendered no result, consumed the confirmation and did not retry. |
| Second send | No prompt appeared (persisted grant); the request reached the real endpoint again. |
| Boundary | No unexpected external page request; no page errors. |

With `--headed` the harness leaves the browser open after reporting checks for manual inspection; closing the window ends the run. A live run needs an existing Playwright installation:

```powershell
node tests/browser/diagnostic-openrouter.mjs --live --headed --playwright-core 'D:\tangyixiao.github.io\node_modules\playwright-core\index.mjs'
```

**Successful live inference with a real API key remains unverified.** With the browser left open after the checks, entering a real key manually and sending once would complete that path; the harness itself keeps runs keyless by default.

## The `--expect-200` success path

Date: 2026-11-06 (Asia/Shanghai). The 401 path above proves the request reaches OpenRouter and that failures surface honestly, but it cannot prove a successful inference. `--expect-200` closes that gap without weakening the keyless default.

It implies `--live` and requires two things before touching the network:

- `OPENROUTER_LIVE_KEY` in the environment, holding a real key. It is read once into memory and appears only in the `Authorization` header; the harness never prints it, writes it to disk or commits it.
- `--model` naming a model the account can actually serve, for example a `:free` variant.

Both guards exit 1 with an explanation rather than proceeding, so a missing key can never be mistaken for a passing run.

The success assertions reuse the live flow instead of adding a parallel one: after a human approves the native host-permission prompt, the same confirmed request resumes, and `.diagnosis-result` only renders when the adapter saw HTTP 200, no error envelope, `finish_reason !== "error"` and non-empty assistant text. The check then asserts that text is non-empty, the body sent equals the preview, the key is in the header and absent from both the body and the page, no alert is present, and the confirmation was consumed. A 402 or 429 surfaces as an alert and fails the run; it is never reported as success.

```powershell
$env:OPENROUTER_LIVE_KEY = '<real key>'
node tests/browser/diagnostic-openrouter.mjs --expect-200 --model google/gemma-4-31b-it:free --headed --playwright-core 'D:\tangyixiao.github.io\node_modules\playwright-core\index.mjs'
```

**`--expect-200` has not been run with a real key yet**, so successful live inference remains unverified. The default stub path is unchanged and still passes all 12 checks on Chrome 156.0.8078.80; the disposable-key 401 live path is likewise unchanged.

## Private GitHub files and multi-turn follow-ups

Date: 2026-11-06 (Asia/Shanghai). Two increments landed after the sections above, and the re-verification below was run on the merged `main` rather than on a feature branch.

### Private GitHub files via a fine-grained PAT

The reader previously sent every GitHub request with `credentials: "omit"` and no `Authorization` header, so a private file could only ever fail. `readGitHubFile(url, fetcher, pat?)` now attaches `Authorization: Bearer <pat>` when the user has saved a token, and only to `https://api.github.com/*`. The token lives in `browser.storage.session`, is validation-checked on save (non-empty, ≤ 500 characters, no whitespace), and is removed by an explicit clear action.

What the stub regression asserts: after saving a disposable fake PAT, `chrome.storage.session` contains exactly the API key and the PAT, `chrome.storage.local` still contains only the model ID, and neither `#diagnostic-preview` nor `#openrouter-request-preview` contains the token text. Clearing the PAT leaves only the API key behind. The URL boundary is unchanged: branch and tag URLs are still rejected before any request, and only `blob/<40-hex SHA>/<path>` links are read.

Deliberately **not** implemented: GitHub App authorization, OAuth, PKCE, token refresh, and any persistence beyond the browser session. The V1 decision was a user-supplied read-only PAT precisely to avoid those subsystems.

### Multi-turn follow-ups

`OpenRouterRequestBody.messages` is no longer a fixed `[system, user]` pair. `buildOpenRouterConversationRequestBody(modelId, turns)` builds one system message plus the full conversation, and validates that the turns are non-empty, alternate user/assistant, start with `user`, end with `user`, and that the system prompt plus all turn content stays within the 50,000-character cap.

What the stub regression asserts: after a first diagnosis, entering a follow-up and confirming sends a body whose `messages` are `[system, user, assistant, user]`, where the third entry carries the first answer and the fourth the new question. The history lives in component memory only — the assertions confirm `chrome.storage.local` still holds only the model ID — and the key stays in the header on the follow-up too. A second round then returns 401 and the UI keeps the committed history, hides the raw provider error, renders no result, and does not retry. "Start a new diagnosis" clears the history so the next send is a two-message request again.

[ADR-0002 decision 7](../decisions/ADR-0002-openrouter-diagnostic-integration.md) listed "no conversation history" as a deliberate restriction; its 2026-11-05 addendum lifts that one restriction and leaves the other eight decisions intact. Adding or changing a source mid-conversation still invalidates the preview and the confirmation — continuing a session with new sources is explicitly out of scope for this increment.

### Re-verification on merged `main` (`1b5b407`)

| Gate | Result |
| --- | --- |
| `npm test` | 10 files / 76 tests passed |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0, Chrome MV3 |
| `npm run build:edge` | exit 0, Edge MV3 |
| Stub browser regression | Chrome 156.0.4314.58, all 12 checks passed, 4 intercepted fakes, no unexpected external requests, no page errors |
| Production manifest | `permissions: ["storage"]` plus the same three optional host permissions; no new host was added for either increment |
| Secret scan / `git diff --check` | clean |

**Successful live inference with a real API key is still unverified.** Everything in this section except the `--expect-200` run is proven by the stub regression and the four gates; the live 200 path remains blocked on obtaining a real key.
