# AsterTab Diagnostic Local Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make an explicit `ai <request>` open a reviewable learning-diagnostic draft. Users select a Luogu problem, paste selected submission evidence, and select a public GitHub file or paste code. The screen shows the exact prospective AI payload but never sends it.

**Architecture:** Keep `parseCommand` as the sole command classifier. Pure TypeScript modules validate two fixed URL shapes, extract the selected public content, and build the exact preview text. Preact owns temporary draft state; a narrow permission callback asks for each host only when the user clicks its read button. Closing the draft discards the content.

**Tech Stack:** Existing WXT 0.21.4, TypeScript 6.0.3, Preact 10.29.8, Vitest 5.0.1, Chrome and Edge MV3.

**Spec:** [Learning diagnostic workflow design](../specs/2026-09-25-astertab-learning-diagnostic-workflow-design.md). The user chose source selection and outbound preview without AI calls for this increment. Private GitHub access and AI sending remain later decisions from Section 10 of the spec.

## Global Constraints

- Ordinary text and `g`, `gh`, `lg` keep their current deterministic destinations; `ai` alone keeps its missing-request error.
- The draft reads no active tab, history, clipboard, or account. Only explicit clicks can fetch one validated public Luogu problem or one validated public GitHub file; each fixed host uses an optional host permission requested at use time.
- Fetches use `credentials: "omit"`, `redirect: "error"`, and a response-size cap. No arbitrary host, raw URL, private GitHub token, or user-provided fetch endpoint is allowed.
- Input remains in page memory only. Closing the draft or new tab discards the raw text.
- The preview must show every text field that a later AI request would contain, including the user's request, source labels, and source URLs where used. There is no send control in this increment.
- Do not add a general Agent runtime, provider registry, service worker, storage, or new dependency.
- Preserve the already untracked `PROJECT.md`, `AGENTS.md`, and existing `docs/` artifacts; stage only files in this plan.

## Review Focus

| Input or condition | Required behavior | Owning task |
| --- | --- | --- |
| `ai` without text | Existing local error, no draft | 3 |
| `ai explain` | Opens a draft with `explain` visible | 3 |
| Source removed after preview | Removed text disappears from next preview | 1, 3 |
| HTML or script-like pasted text | Shown as inert text; no navigation or execution | 3 |
| Closing and reopening | Old pasted content is gone | 3 |
| Invalid URL, redirect, or permission denial | No fetch or cross-host retry; user may paste text | 2, 3 |
| One selected source fails | Other selected sources remain in preview | 3 |

## File responsibilities

| File | Responsibility |
| --- | --- |
| `src/core/diagnostic/context-preview.ts` | Source types and pure exact-preview builder |
| `tests/diagnostic/context-preview.test.ts` | Preview inclusion, ordering, omission, and empty input |
| `src/core/diagnostic/public-sources.ts` | Fixed URL validation, bounded public fetches, Luogu/GitHub extraction |
| `tests/diagnostic/public-sources.test.ts` | URL, redirect, payload, and failure tests with injected fetch |
| `src/app/diagnostic/DiagnosticDraft.tsx` | Temporary source entry, removal, preview, and close UI |
| `src/app/diagnostic/diagnostic-draft.css` | Minimal draft layout |
| `src/app/command-center/CommandCenter.tsx` | Route explicit Agent command to the draft |
| `docs/testing/diagnostic-local-context-acceptance.md` | Real browser observation of offline, inert paste, and unchanged search |

### Task 1: Pure context preview

**Files:**
- Create: `src/core/diagnostic/context-preview.ts`
- Test: `tests/diagnostic/context-preview.test.ts`

**Interfaces:**
- Produce: `type DiagnosticSource = { id: string; kind: "problem" | "submission" | "code"; label: string; text: string; url?: string }`.
- Produce: `buildContextPreview(request: string, sources: readonly DiagnosticSource[]): string`.
- Sources may also have a canonical `url?: string`. Empty or whitespace-only source text is omitted; nonempty source text is trimmed, kept in input order, and shown with its kind, label, and URL. The request is always first.

- [x] Write tests for exact preview order, removed source omission, empty text omission, and treating script-like text as plain text.
- [x] Run `npm test -- tests/diagnostic/context-preview.test.ts`; expect failure because the module is absent.
- [x] Implement `buildContextPreview` with no browser or network imports.
- [x] Run `npm test -- tests/diagnostic/context-preview.test.ts`; expect all tests to pass.
- [x] Stage only the two files and commit `feat: build local diagnostic context preview`.

### Task 2: Fixed public source readers

**Files:**
- Create: `src/core/diagnostic/public-sources.ts`
- Test: `tests/diagnostic/public-sources.test.ts`
- Modify: `wxt.config.ts`

**Interfaces:**
- Produce: `readLuoguProblem(inputUrl: string, fetcher: typeof fetch): Promise<DiagnosticSource>` and `readGitHubFile(inputUrl: string, fetcher: typeof fetch): Promise<DiagnosticSource>`; invalid URLs throw before any fetch.
- Luogu accepts only `https://www.luogu.com.cn/problem/<id>` with no credentials, query, or fragment. It extracts title, statement, input/output formats, samples, and hint from the public page's `lentille-context` JSON; if the structure changes, it fails closed and offers paste fallback.
- GitHub accepts only `https://github.com/<owner>/<repo>/blob/<40-hex-commit-SHA>/<file-path>` with no credentials, query, or fragment. It calls the fixed `https://api.github.com/repos/<owner>/<repo>/contents/<file-path>?ref=<SHA>` endpoint, rejects non-file/oversize/non-base64 results, and decodes selected file text. Branch and tag URLs have an ambiguous ref/path boundary; users use a commit permalink or paste code.
- Both readers reject redirects, omit credentials, check response status and bound response/body size. No generic URL fetch helper is exported.
- `wxt.config.ts` declares exactly `https://www.luogu.com.cn/*` and `https://api.github.com/*` as `optional_host_permissions`, with no required host permissions.

- [x] Write failing tests for accepted/blocked URLs, exact request target/options, valid selected content, non-file response, redirect, and oversize response.
- [x] Run `npm test -- tests/diagnostic/public-sources.test.ts`; expect failure because the reader module is absent.
- [x] Implement the two readers and exact optional host patterns.
- [x] Run `npm test -- tests/diagnostic/public-sources.test.ts` and `npm run typecheck`; expect success.
- [x] Stage only the reader, test, and config files and commit `feat: read selected public diagnostic sources`.

### Task 3: Local draft UI

**Files:**
- Create: `src/app/diagnostic/DiagnosticDraft.tsx`, `src/app/diagnostic/diagnostic-draft.css`
- Modify: `src/app/command-center/CommandCenter.tsx`
- Test: existing `tests/commands/parse-command.test.ts`; browser acceptance in Task 3.

**Interfaces:**
- `DiagnosticDraft({ request, onClose }: { request: string; onClose: () => void })` renders three optional sources: Luogu problem URL or pasted statement, selected submission text, and GitHub file URL or pasted code. Labels are editable plain text. Each source has an explicit include/remove control. Preview is recomputed from currently included sources using Task 1's builder.
- The two read controls request only their fixed origin via WXT's `browser.permissions.request` in the user click handler, then call Task 2's reader. Permission denial and source failure leave other entries intact and show a paste fallback. The read operation never occurs on render or URL typing.
- `CommandCenter` opens this component only for `ParsedCommand.kind === "agent"`; closing restores the command input and clears the request and draft.

- [x] Extend the parser tests only if routing reveals a parser regression; keep existing command semantics unchanged.
- [x] Implement the draft with Preact state, URL fields and read controls, textareas, source include controls, a full text preview, and a close control. Render pasted values through Preact text nodes.
- [x] Connect the existing Agent branch in `CommandCenter` to the draft; preserve empty and search branches.
- [x] Run `npm test`, `npm run typecheck`, `npm run build`, and `npm run build:edge`; expect all to pass.
- [x] Stage only the three UI files and commit `feat: add local diagnostic draft`.

### Task 4: Browser and manifest acceptance

**Files:**
- Create: `docs/testing/diagnostic-local-context-acceptance.md`

**Interfaces:**
- No production interface. Record observed Chrome and Edge behavior and exact generated manifest permissions.

- [x] Load both production builds in isolated Chrome and Edge profiles and exercise each Review Focus case, ordinary search, and offline draft creation. Test one public Luogu read and one public GitHub file read where the service is reachable; otherwise record the network limitation and the paste fallback.
- [x] Inspect both `.output/*-mv3/manifest.json` files; expect only the two named `optional_host_permissions`, no required `permissions` or `host_permissions`, background service worker, or content scripts.
- [x] Record commands, browser versions, observations, and limits in the acceptance document.
- [x] Stage only the acceptance document and commit `docs: verify local diagnostic draft`.

## Self-review

- The tasks cover source selection, selected public reads, and full preview. Provider authentication, actual outbound confirmation, diagnosis, and private GitHub access remain separate increments by user choice and because the Spec requires explicit implementation decisions before they can be planned.
- Task 1's exported types match Tasks 2 and 3's consumers. Task 4 verifies the UI and permission claims that pure tests cannot prove.
