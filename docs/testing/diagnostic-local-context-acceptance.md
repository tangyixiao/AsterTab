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

Both production manifests contain exactly two `optional_host_permissions`: `https://www.luogu.com.cn/*` and `https://api.github.com/*`. Neither contains required `permissions`, `host_permissions`, a background worker, or content scripts. The generated new-tab page uses packaged HTML, JS, and CSS. The final production JS chunk was 26.18 kB in each build; this is a bundle observation, not a performance target.

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

## Limits and cleanup

Chrome's branded browser ignored the `--load-extension` switch in a separate temporary profile. This run verified the Chrome production build and manifest but did not perform fresh Chrome UI interaction; the earlier Command Center first-slice Chrome acceptance does not cover this new draft.

All isolated Edge process trees were stopped after the run. No listeners remained on the test CDP ports 10447–10450. Temporary profile directories and the temporary CDP script were left under the user's Temp directory for possible inspection; the regular browser profiles were not opened for this acceptance.

Primary interface references: [Chrome optional host permissions](https://developer.chrome.com/docs/extensions/mv3/declare_permissions), [GitHub repository contents API](https://docs.github.com/en/rest/repos/contents), [GitHub REST rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api), and [Luogu P1001](https://www.luogu.com.cn/problem/P1001).
