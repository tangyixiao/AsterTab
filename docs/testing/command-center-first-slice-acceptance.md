# Command Center first slice — production acceptance

Date: 2026-09-25 (Asia/Shanghai). Result: **PASS for the Task 5 checks described below**. This record covers the built Chrome and Edge Manifest V3 extensions, not search result quality or an Agent integration.

## Environment and build gates

- Machine: JIAOLONG Series, AMD Ryzen 9 8945HX with Radeon Graphics, Windows 11 Pro 10.0.26200; Node `v26.9.0`, npm `11.19.0`.
- Chrome `153.0.8010.54`; Edge `153.0.4234.48` (browser CDP `/json/version` returned `Chrome/153.0.8010.54` and `Edg/153.0.4234.48`).
- Repository branch `codex/astertab-command-foundation`; implementation baseline `cd2233e9144db40cb8d5048c557ea8c03a2bf007`. Acceptance used separate, previously created temporary Chrome and Edge profiles, never the regular user profiles. Each profile already held its production unpacked extension, originally loaded through its `chrome://extensions/` or `edge://extensions/` management UI. This run rechecked `chrome.developerPrivate.getExtensionsInfo()`: both were `ENABLED`, `UNPACKED`, with paths pointing to this worktree's respective `.output/chrome-mv3` and `.output/edge-mv3` directories. Chrome's branded `--load-extension` switch was not used.

| Gate | Raw observation | Result |
| --- | --- | --- |
| `npm ci` | Exit 0; postinstall `wxt prepare` finished; `added 205 packages` | PASS |
| `npm test` | Exit 0; 2 test files, 27 tests passed. Vitest printed the existing Vite native-config warning. | PASS |
| `npm run typecheck` | Exit 0; `tsc --noEmit` printed no diagnostics | PASS |
| `npm run build` | Exit 0; WXT 0.21.4 / Vite 8.3.0 built `.output/chrome-mv3` | PASS |
| `npm run build:edge` | Exit 0; built `.output/edge-mv3` | PASS |

Both generated `manifest.json` files contain exactly `manifest_version: 3`, name `AsterTab`, version `1.0.0`, and `chrome_url_overrides.newtab: "newtab.html"`. Neither contains `permissions`, `host_permissions`, `background`, or `content_scripts`. The per-manifest inspection returned empty permission lists and `Background: False`, `ContentScripts: False` for each. No development hot-reload permission entered either production manifest. Recursive sum of production `*.js` file lengths: Chrome **15,397 bytes**; Edge **15,397 bytes** (one `chunks/newtab-aqwAmmqq.js` per output). WXT's 16.22 kB total also includes the manifest, HTML, and CSS and is not the JS measurement.

## Browser interaction and fixed routes

Browser checks used the actual installed, headed Chrome/Edge processes with isolated profiles and remote debugging. CDP created real `chrome://newtab/` or `edge://newtab/` targets, activated each target, inserted text, and sent keyboard events. Enter included `rawKeyDown`, `char`, and `keyUp`. Observations below are each page's `location.href` after submission plus its `Network.requestWillBeSent` document URL; they are not inferred from unit tests. The first CDP attempt omitted activation and the Enter `char` event, so it did not submit and is **excluded** from pass evidence; all listed cases were rerun with corrected events.

Both browsers opened `chrome-extension://<their extension ID>/newtab.html`, title `AsterTab`, with `#command-input` present and automatically focused. Chrome extension ID was `ofiebicpajljfpcmnenncbegefkopphf`; Edge was `algflakdlgackpajbniljhdidfppdiah`. In each browser, Tab moved focus from `command-input` to the `搜索` button, Shift+Tab returned focus to `command-input`, and Tab then Enter on the button submitted `hello world`.

| Submitted text | Chrome observed destination | Edge observed destination | Result |
| --- | --- | --- | --- |
| `hello world` | `https://www.bing.com/search?q=hello+world` | Same URL | PASS |
| `g dynamic programming` | Initial document request `https://www.google.com/search?q=dynamic+programming`; Google then added a `sei` query parameter to the page URL | `https://www.google.com/search?q=dynamic+programming` | PASS |
| `gh preact` | `https://github.com/search?q=preact&type=repositories` | Same URL | PASS |
| `lg P1001` | `https://www.luogu.com.cn/problem/list?keyword=P1001&page=1` | Same URL | PASS |

These checks establish destination routing. Third-party search results and their own network requests are outside the extension's first-screen request audit.

Additional Chrome production cases, each on a fresh new-tab target:

| Input | Raw observation after Enter | Result |
| --- | --- | --- |
| `ghfoo preact` | `https://www.bing.com/search?q=ghfoo+preact` | PASS: ordinary query |
| `g`, `gh`, `lg` | Each remained at the extension new-tab URL, showed `请输入搜索内容。`, and made no document navigation request | PASS |
| `ai` | Remained at the extension URL, showed `请输入 AI 请求内容。`, no document navigation request | PASS |
| `AI explain` | Remained at the extension URL, showed `AI 尚未接入。`, no document navigation request | PASS |
| `javascript:alert(1)` | `https://www.bing.com/search?q=javascript%3Aalert%281%29` | PASS: fixed HTTPS Bing origin; scheme is query data |
| `data:text/html,hello` | `https://www.bing.com/search?q=data%3Atext%2Fhtml%2Chello` | PASS: fixed HTTPS Bing origin; scheme is query data |
| `g 矩阵 & 字符串` | `https://www.google.com/search?q=%E7%9F%A9%E9%98%B5+%26+%E5%AD%97%E7%AC%A6%E4%B8%B2` | PASS: one `q` parameter decodes to `矩阵 & 字符串` |

## First-screen network and offline behavior

For each browser, CDP attached to an `about:blank` target, enabled Network observation before navigating to its browser new-tab URL, then captured `Network.requestWillBeSent`. This excludes third-party result pages. With normal network availability, each new-tab load requested exactly three extension-origin resources: `newtab.html` (Document), `chunks/newtab-aqwAmmqq.js` (Script), and `assets/newtab-D6bEFSmL.css` (Stylesheet). Chrome used extension origin `ofiebicpajljfpcmnenncbegefkopphf`; Edge used `algflakdlgackpajbniljhdidfppdiah`. External-origin requests: **0 in Chrome, 0 in Edge**.

In both browsers, CDP set `Network.emulateNetworkConditions` to Offline and reloaded the same target with cache ignored. Each reload again requested only those three extension resources; the page displayed `搜索或输入命令`, the input/button, and `g / gh / lg / ai`, with `command-input` focused. Typing and submitting `ai explain` left the page at its extension URL, showed `AI 尚未接入。`, and added **0 requests** after the reload's three resources. The offline condition was scoped to these targets. Result: **PASS** for local first screen and no AI/third-party request.

## Render and bundle observations

After closing both isolated browser processes, each was restarted with its own existing isolated profile. The first CDP-created new-tab target after restart was recorded separately, followed by five further new-tab targets. Each entry came from `performance.getEntriesByName("first-contentful-paint")[0]?.startTime` in the actual extension page; values are milliseconds relative to that page's navigation start. DevTools UI was closed; a remote CDP connection read the values. Network throttling was off. Browsers were launched with their extension-management page, so “first” means first newly created new tab after process restart, not complete process-start or user-perceived startup time.

| Browser | First after restart | Next five FCP values, in order | Median of next five | Production JS bytes |
| --- | ---: | --- | ---: | ---: |
| Chrome 153.0.8010.54 | 52 ms | 44, 76, 40, 40, 36 ms | 40 ms | 15,397 |
| Edge 153.0.4234.48 | 80 ms | 76, 72, 52, 52, 60 ms | 60 ms | 15,397 |

FCP is a render observation only. No performance threshold or production instrumentation was added.

## Cleanup

`Browser.close` was sent to both isolated CDP endpoints after the network checks and again after the restarted-browser FCP run. Both process-holding terminal sessions then exited with code 0. A final process and socket query returned no Chrome/Edge command line containing the two acceptance profile names and no listeners on CDP ports `10345` or `10346`. No development server was started. The temporary profile data was retained; the regular user profiles were not opened.
