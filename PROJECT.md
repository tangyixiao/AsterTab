# AsterTab — Project Brief for Coding Agents

> **Tagline:** Don't replace your tools. Connect them.

## 0. Purpose of This File

This file is the canonical product brief for coding agents working on **AsterTab**.

Before making implementation decisions, preserve the product intent in this document. Do not silently expand scope, turn AsterTab into a super-app, or replace external services that should instead be integrated.

If implementation details conflict with this brief, prefer the product principles here unless the user explicitly overrides them.

---

# 1. Product Definition

**AsterTab** is a command-first browser new-tab workspace for students, competitive programmers, developers, and heavy AI users.

It combines:

- a unified search / command center;
- a lightweight new-tab dashboard;
- contextual work recovery;
- configurable workspaces;
- a permission-aware Agent layer;
- modular integrations with existing tools.

AsterTab is **not** primarily a pretty start page.

It is also **not** a ChatGPT wrapper.

The core idea is:

> Use one low-friction browser entry point to connect tools that already exist.

---

# 2. Primary Product Goal

The highest-level success criterion is:

> Users similar to the original target user — students, OIers, developers, and heavy AI users — install AsterTab and continue using it as an important browser entry point over the long term.

Long-term retention matters more than feature count.

The product should become useful enough that users naturally start search, navigation, tool switching, and some multi-service workflows from AsterTab.

---

# 3. Primary Target Users

Prioritize:

1. students;
2. competitive programmers / OIers;
3. developers;
4. heavy AI-tool users.

These users often already use:

- GitHub;
- OJ platforms;
- AI assistants;
- search engines;
- many browser tabs;
- project documentation;
- developer tools;
- browser history and bookmarks.

Their problem is usually not a lack of tools.

Their problem is that the tools are fragmented.

---

# 4. Core Product Principle

## Default restrained, maximum capability

The default experience should remain simple.

Advanced features should reveal themselves progressively.

Do not expose every feature at once.

The product should feel lightweight even when the underlying capability is powerful.

---

# 5. Product Shape

AsterTab uses a hybrid model.

```text
                     New Tab
                        |
              +---------v---------+
              |   Command Center  |
              | Search / Cmd / AI |
              +---------+---------+
                        |
        +---------------+---------------+
        |               |               |
        v               v               v
   Dashboard        Workspace        Context
   minimal info     customization    recovery
        |               |               |
        +---------------+---------------+
                        |
                        v
                      Agent
                        |
              +---------+---------+
              |         |         |
              v         v         v
            GitHub      OJ        AI
```

The **Command Center** is the core.

Dashboard, Workspace, Context, and Agent exist around it.

---

# 6. Progressive Experience Levels

## Level 0 — Minimal

Show:

- primary command/search input;
- a few essential shortcuts.

## Level 1 — Lightweight workspace

May additionally show:

- recent projects;
- recent activity;
- essential status;
- small contextual hints.

## Level 2 — Workspace

Allow:

- modular panels;
- layout customization;
- multiple workspaces;
- optional widgets.

## Level 3 — Agent

Allow:

- natural-language intent;
- contextual multi-service workflows;
- controlled actions across connected services.

Do not make Level 3 the default UI for every task.

---

# 7. Command Center

The Command Center is the most important long-term foundation.

It should support fast deterministic actions before using AI.

Examples:

```text
g xxx
gh xxx
lg xxx
ai xxx
```

It should eventually search or invoke:

- web search;
- bookmarks;
- history;
- open tabs;
- GitHub;
- OJ platforms;
- AI providers;
- commands;
- calculations;
- other installed modules.

## Rule

> Deterministic parsing first. AI fallback second.

Do not route trivial operations through an LLM.

Opening GitHub, searching a known provider, calculating an expression, or switching to an existing tab should be fast and predictable.

---

# 8. Agent Philosophy

The Agent is not the whole product.

The Agent is an intent-understanding and orchestration layer.

It should:

- understand user intent;
- gather permitted context;
- call existing integrations;
- produce a clear plan/result;
- execute only within explicit permissions.

The Agent should not become an unrestricted autonomous process.

---

# 9. V1 Agent Scope

V1 should focus on:

```text
Browser
+
Web Services
```

Do **not** make local shell access, native filesystem control, IDE control, or a native host core requirements for V1.

Those may be later extensions.

---

# 10. V1 First-Class Integrations

The first three first-class integration families are:

## GitHub

Potential capabilities:

- repositories;
- issues;
- pull requests;
- recent activity;
- related source code;
- links to current projects.

Do not reimplement GitHub.

Use GitHub as a source and action target.

## AI

Treat AI as a provider layer.

The architecture should avoid hard-coding the product to a single model/provider.

Possible providers may include:

- OpenAI;
- Anthropic;
- Gemini;
- OpenRouter;
- other future providers.

Provider abstraction is preferred.

## OJ

Competitive programming / online judge integrations are a first-class product area.

Initial focus may include platforms such as:

- Luogu;
- Codeforces;
- other OJs where practical.

Capabilities may include:

- problem context;
- submission history;
- verdicts;
- problem metadata;
- links to statements/editorials;
- contest/problem context.

Avoid rebuilding an OJ.

---

# 11. V1 Signature Workflow

The most important reference scenario is:

> “把这个洛谷题、我最近的提交和 GitHub 上相关代码一起看，帮我判断我现在卡在哪。”

In English:

> “Look at this Luogu problem, my recent submissions, and the related code on GitHub, then help me determine where I’m currently stuck.”

This workflow should combine:

```text
Current problem
    +
Recent submissions
    +
Related GitHub code
    +
User-approved context
    |
    v
Context assembly
    |
    v
Agent diagnosis
    |
    v
Identify current bottleneck
```

This scenario is more important than building many unrelated widgets.

---

# 12. Learning-Agent Behavior

The learning Agent should diagnose before answering.

Possible stages:

```text
Problem understanding
        |
        v
Modeling
        |
        v
Algorithm selection
        |
        v
Complexity reasoning
        |
        v
Implementation
        |
        v
Debugging
        |
        v
Submission feedback
```

The Agent should infer which stage the user is stuck at.

Then it should adapt the level of help.

Possible intervention styles:

- Socratic question;
- minimal hint;
- concept explanation;
- algorithm direction;
- implementation guidance;
- full solution when explicitly requested.

## Principle

> Diagnose first, then adapt assistance depth.

Do not default to dumping the full solution.

---

# 13. Active vs Agent Modes

## Default mode: Light Active

The product may:

- reorder recent items;
- surface recent projects;
- show relevant recent activity;
- suggest continuation points.

It should not aggressively interrupt the user.

## Agent mode

Agent-like behavior should require explicit user intent or explicit enablement.

Avoid a constantly talking “AI butler” experience.

---

# 14. Permission Model

AsterTab may eventually become powerful, but permissions must remain modular.

Use:

- least privilege;
- per-integration authorization;
- revocable permissions;
- clear disclosure;
- explicit confirmation for risky actions.

Example conceptual permission boundaries:

```text
Browser history      separate permission
GitHub               separate permission
OJ                   separate integration
AI provider          separate configuration
Calendar             separate permission
Local host           separate permission
```

Installing AsterTab must not imply access to everything.

---

# 15. Action Risk Levels

Use a risk model similar to:

## L0 — Search / navigation

Examples:

- search;
- open link;
- switch tab.

Usually safe to execute directly.

## L1 — Browser actions

Examples:

- close tabs;
- group tabs;
- pin tabs;
- restore session.

Low risk, but still observable.

## L2 — Personal data changes

Examples:

- create task;
- modify workspace;
- save a note.

Show what will change.

## L3 — External service writes

Examples:

- create GitHub issue;
- modify external data;
- write to remote services.

Require preview + confirmation where appropriate.

## L4 — Local system / shell

Future scope.

Require strict authorization and explicit confirmation.

## Principle

> AI interprets intent. The command system controls execution.

---

# 16. Data Model Philosophy

Use a hybrid local-first model.

Prefer local storage for:

- sensitive indices;
- history-related context;
- local contextual state;
- search indexes;
- private derived metadata.

Optional sync may be used for:

- layout;
- preferences;
- shortcuts;
- non-sensitive configuration;
- workspace metadata.

Users should decide what leaves the device.

AsterTab should not require mandatory account login just to be useful.

---

# 17. Integration Philosophy

AsterTab should not rebuild external tools.

Do not recreate:

- GitHub;
- OJ platforms;
- AI platforms;
- Todo apps;
- calendars;
- Notion;
- email;
- RSS;
- cloud drives.

Instead, AsterTab should own:

```text
Entry point
    |
Search
    |
Context
    |
Orchestration
    |
Permissions
    |
Execution
```

Prefer existing APIs, protocols, SDKs, and mature open-source components.

---

# 18. Modular Architecture Direction

Long-term conceptual structure:

```text
Core
|
+-- Command Engine
+-- Search Engine
+-- Context Engine
+-- Permission System
+-- Agent Orchestrator
+-- Workspace
|
+-- Module Runtime
      |
      +-- GitHub Adapter
      +-- AI Adapter
      +-- OJ Adapter
      +-- Calendar Adapter
      +-- Todo Adapter
      +-- ...
```

Keep the core small.

Treat integrations as adapters/modules.

Avoid hard-coding service-specific logic into unrelated core layers.

---

# 19. Anti-Goals

The most important anti-goal:

> AsterTab must not become a super-app.

Do not let the project drift into:

```text
build our own notes app
build our own todo app
build our own Git client
build our own mail client
build our own AI platform
build our own calendar
build our own OJ
```

That is scope failure.

Correct direction:

> Do not replace tools. Connect them.

---

# 20. V1 Strategy

Use:

## Agent First + Command Foundation

Meaning:

1. build a strong Command Center foundation;
2. prove one meaningful Agent workflow;
3. use GitHub + OJ + AI as the initial integrated context;
4. avoid feature breadth until the core workflow proves valuable.

---

# 21. V1 Non-Goals

V1 does **not** need:

- dozens of widgets;
- dozens of integrations;
- a full third-party plugin ecosystem;
- local shell Agent;
- native-host complexity;
- advanced cross-device sync;
- a fully autonomous assistant;
- a complete productivity suite.

---

# 22. V1 Questions That Must Be Proven

V1 should answer:

## Question 1

Is the Command Center good enough that users want to open it every day?

## Question 2

Is the combined GitHub + OJ + AI contextual Agent meaningfully more useful than simply opening a general AI chat?

If both answers are yes, expansion is justified.

---

# 23. Product UX Principles

Prefer:

- fast keyboard-first interaction;
- predictable commands;
- progressive disclosure;
- high information density without clutter;
- minimal default UI;
- strong discoverability for advanced features;
- visible permissions;
- understandable Agent actions;
- reversible actions where possible.

Avoid:

- widget overload;
- decorative noise;
- excessive animations;
- mandatory chat-first interaction;
- AI everywhere;
- hidden automation;
- unexplained background behavior.

---

# 24. Branding

## Product name

**AsterTab**

## Repository

Recommended:

```text
astertab
```

Example:

```text
TangyixiaoQAQ/astertab
```

## GitHub Project

```text
AsterTab Roadmap
```

## Tagline

```text
Don't replace your tools. Connect them.
```

## Short description

```text
A command-first new tab workspace connecting search, AI, GitHub, OJs and the tools you already use.
```

---

# 25. Suggested Repository Topics

```text
browser-extension
chrome-extension
new-tab
command-palette
ai-agent
productivity
developer-tools
competitive-programming
github
manifest-v3
```

---

# 26. Recommended Initial Repository Shape

Do not split into many repositories yet.

Prefer a single repository / monorepo.

Conceptually:

```text
astertab/
|
+-- apps/
|   +-- extension/
|
+-- packages/
|   +-- core/
|   +-- command/
|   +-- context/
|   +-- permissions/
|   +-- agent/
|   +-- modules/
|
+-- integrations/
|   +-- github/
|   +-- ai/
|   +-- oj/
|
+-- docs/
|
+-- tests/
|
+-- README.md
+-- PROJECT.md
+-- AGENTS.md
```

This is a conceptual layout, not a mandatory implementation decision.

Do not over-architect before real code exists.

---

# 27. Rules for Coding Agents

When working on AsterTab:

1. Do not expand product scope without explicit user approval.
2. Prefer reuse over rebuilding mature external tools.
3. Keep core logic service-agnostic.
4. Keep integrations modular.
5. Prefer deterministic command execution over AI calls.
6. Use AI only when it adds real semantic value.
7. Default to least privilege.
8. Avoid mandatory cloud dependence.
9. Protect fast new-tab startup performance.
10. Do not trade basic responsiveness for visual effects.
11. Keep Agent actions inspectable.
12. Treat destructive or external write actions as higher risk.
13. Preserve the “default restrained, maximum capability” principle.
14. Optimize for real repeated use, not demo impressiveness.
15. Do not turn the product into a super-app.

---

# 28. Decision Priority

When two design options conflict, prefer in this order:

1. repeated real-world usefulness;
2. speed and low friction;
3. predictability;
4. user control;
5. privacy and permission clarity;
6. modularity;
7. extensibility;
8. visual novelty.

---

# 29. Current Product State

The first slice and the learning-diagnostic increment are **implemented and accepted**. The deterministic Command Center (plain-text search and `g` / `gh` / `lg` commands parsed and routed to fixed HTTPS URLs without an LLM) and the learning diagnostic have both landed (PR #1 / #2) and passed acceptance.

Two follow-on increments have since landed on the same foundation (PR #17 / #18, with the `--expect-200` acceptance path in PR #20):

- **Private GitHub files.** The user may paste a read-only fine-grained personal access token. It is kept in `browser.storage.session` only, is sent as a `Bearer` header exclusively to `https://api.github.com/*`, and never enters the URL, the preview, the request body, or any log. The accepted URL shape is unchanged (public or private, still a `blob/<40-hex SHA>/<path>` permalink). No GitHub App, OAuth, PKCE, or token refresh was built, and no new host permission was added.
- **Multi-turn diagnosis.** A follow-up question resends the fixed system prompt plus the whole in-memory conversation plus the new question. History exists only in component memory, never in storage. Every send still requires a fresh explicit confirmation against the full serialized body, and the 50,000-character limit applies to the body as a whole. There is no permanent chat window, no auto-scroll, and no background polling.
- **Command Center expansion (2026-11-08, PRs #23 / #24 / #25).** Three deterministic commands landed on the same parse/route foundation, without new permissions, network calls at parse time, or LLM involvement: `cf <题号或用户名>` opens a Codeforces problem page (`cf 1234A`, `cf 1234/A`, index normalized to uppercase) or a user profile; `= <表达式>` (alias `calc`) evaluates a math expression locally with a hand-written tokenizer + recursive-descent parser (no `eval` / `new Function`), showing the result inline in the status line; `help` / `?` (whole input only) renders the inline command reference.

Verified baseline on the merged tree:

- `npm test`: 11 files / 146 tests passed.
- `npm run typecheck`: exit 0.
- `npm run build` and `npm run build:edge`: exit 0 (Chrome / Edge Manifest V3 production builds).
- Browser acceptance with all network calls stubbed: 12 checks passed, including the PAT-never-leaves-session and multi-turn-resend assertions.
- Production Manifest: the only required permission is `storage`; the same three optional host permissions as before; no host was added by either increment.

Records and sources: [command-center-first-slice-acceptance.md](docs/testing/command-center-first-slice-acceptance.md), [diagnostic-local-context-acceptance.md](docs/testing/diagnostic-local-context-acceptance.md), [ADR-0002-openrouter-diagnostic-integration.md](docs/decisions/ADR-0002-openrouter-diagnostic-integration.md), [package.json](package.json), [wxt.config.ts](wxt.config.ts).

The following stack and integration choices are **already implemented facts**, not new decisions made by this document: WXT 0.21.4 + Preact 10.29.8 + TypeScript 6.0.3 + Vite 8.3.0 + Vitest 5.0.1; Manifest V3; the OpenRouter API key kept in `browser.storage.session` and the model ID in `storage.local`; a fixed OpenRouter endpoint; and no provider registry, background service worker, or content script. See [package.json](package.json), [wxt.config.ts](wxt.config.ts), and [ADR-0002-openrouter-diagnostic-integration.md](docs/decisions/ADR-0002-openrouter-diagnostic-integration.md).

> Historical note (2026-09-23):
>
> The lines below are the original §29 text, written during the product-definition / architecture-planning stage, before implementation began. They are retained verbatim as a historical record and are superseded by the implemented baseline above; they no longer describe the current state.
>
> ```text
> # 29. Current Product State
> The project is currently in the **product-definition / architecture-planning stage**.
> Do not assume implementation choices have already been made.
> Technology stack, framework, storage engine, AI SDK, sync backend, and UI framework remain open unless separately specified by the user.
> Before major implementation, derive a concrete technical plan from this product brief.
> ```

The guardrail "Do not assume implementation choices have already been made" now applies **only to the areas below, which are still unimplemented or unverified**. Do not treat any of them as decided or shipped:

1. A second AI Provider (only the fixed OpenRouter path is wired; no provider registry exists).
2. A sync backend (no cloud sync; settings stay local or session-scoped).
3. Successful live inference verified with a real API key. The `--expect-200` acceptance path exists and asserts a real HTTP 200 with non-empty diagnosis text, but it has **never been run with a real key**: the only live run so far used a disposable sentinel key, reached the real endpoint, and saw HTTP 401.

Two items that appeared on this list earlier are now shipped and are no longer guardrailed: multi-turn diagnostic interaction / follow-up questions, and GitHub private-repository access. Both are described above and their boundaries are recorded in the acceptance document.

For these areas, derive a concrete technical plan from this product brief before major implementation, and do not assume the implementation choices have already been made.

---

# 30. One-Sentence Definition

> **AsterTab is a restrained but extensible browser Command Workspace that connects search, context, GitHub, OJs, AI, and future tools through a permission-aware Agent instead of rebuilding those tools.**

> 2026-11-04: §29 synced with implemented baseline; no product decisions changed.
