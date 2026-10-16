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
