# AGENTS.md — AsterTab / Codex Instructions

This file defines how Codex should work inside the **AsterTab** repository.

Read `PROJECT.md` before making product, architecture, or implementation decisions.

---

## 1. Project

**AsterTab**

> Don't replace your tools. Connect them.

AsterTab is a command-first browser new-tab workspace for students, competitive programmers, developers, and heavy AI users.

It combines:

- unified search;
- a command center;
- contextual work recovery;
- modular workspaces;
- permission-aware Agent workflows;
- integrations with existing services such as GitHub, OJs, and AI providers.

The project must **connect tools rather than rebuild them**.

---

## 2. Current Stage

The project is currently in the:

```text
product definition
        ↓
architecture design
        ↓
technical planning
```

stage.

Unless the user explicitly asks for implementation:

- do not scaffold the project;
- do not install dependencies;
- do not choose a framework as if it were already decided;
- do not generate large amounts of production code;
- do not silently create infrastructure;
- do not prematurely split the project into multiple repositories/services.

Planning artifacts are allowed.

---

## 3. Source of Truth

Read these files in this order when available:

```text
PROJECT.md
AGENTS.md
README.md
docs/
```

Priority when instructions conflict:

```text
explicit user request
        >
PROJECT.md
        >
AGENTS.md
        >
existing repository conventions
        >
agent preference
```

Never silently override the product direction in `PROJECT.md`.

---

## 4. Product North Star

The highest-level goal is not feature count.

The goal is:

> Users similar to students, OIers, developers, and heavy AI users install AsterTab and continue using it as a meaningful browser entry point over the long term.

Optimize for:

1. repeated real-world usefulness;
2. speed;
3. low friction;
4. predictability;
5. user control;
6. privacy;
7. modularity;
8. extensibility.

Visual novelty comes after these.

---

## 5. Core Product Model

AsterTab should conceptually remain:

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

The **Command Center is the core**.

Do not let Dashboard, widgets, or chat UI become the main product.

---

## 6. V1 Strategy

V1 follows:

```text
Agent First
+
Command Foundation
```

Meaning:

1. establish a fast, reliable command/search foundation;
2. prove one valuable Agent workflow;
3. focus on GitHub + OJ + AI;
4. avoid broad feature expansion.

The flagship V1 scenario is:

> “把这个洛谷题、我最近的提交和 GitHub 上相关代码一起看，帮我判断我现在卡在哪。”

Equivalent intent:

> Combine the current OJ problem, recent submissions, related GitHub code, and user-approved context to diagnose where the user is stuck.

This scenario should influence architecture more than speculative future features.

---

## 7. Command Center Rule

Prefer deterministic execution before AI.

Examples:

```text
g xxx
gh xxx
lg xxx
ai xxx
```

Trivial actions must not require an LLM.

Prefer:

```text
parse
  ↓
deterministic command/search
  ↓
execute
```

Use AI only when semantic interpretation is genuinely useful.

Do not create an “AI everywhere” architecture.

---

## 8. Agent Rule

The Agent is:

```text
intent understanding
+
context assembly
+
tool orchestration
+
controlled execution
```

The Agent is **not**:

- the entire UI;
- an unrestricted autonomous process;
- a permanent chat window;
- a reason to route every action through an LLM.

AI interprets intent.

The command/action layer controls execution.

---

## 9. Learning-Agent Behavior

For OJ workflows, diagnose before solving.

Possible user bottleneck stages:

```text
problem understanding
        ↓
modeling
        ↓
algorithm selection
        ↓
complexity reasoning
        ↓
implementation
        ↓
debugging
        ↓
submission feedback
```

The Agent should adapt assistance depth.

Possible responses include:

- Socratic question;
- minimal hint;
- concept explanation;
- algorithm direction;
- implementation guidance;
- full solution only when appropriate or explicitly requested.

Do not automatically dump a full solution.

---

## 10. V1 First-Class Integrations

Treat these as first-class:

### GitHub

Use GitHub as an integration target.

Do not rebuild GitHub.

### AI

Use a provider abstraction where practical.

Do not hard-code the product conceptually to one AI provider.

### OJ

Treat OJ support as an integration layer.

Initial examples may include Luogu and Codeforces, but avoid making the core depend on one platform.

---

## 11. Anti-Super-App Rule

This is one of the strongest constraints in the project.

Do **not** drift into building:

- a notes app;
- a Todo app;
- a Git client;
- an email client;
- a calendar app;
- an OJ;
- an AI platform;
- a cloud drive;
- a full IDE.

AsterTab should connect these tools.

If a feature can be implemented by integrating a mature existing service rather than reimplementing it, strongly prefer integration.

---

## 12. Reuse Before Rebuild

Before proposing a substantial new subsystem:

1. check whether the capability already exists in the browser platform;
2. check whether an existing API/SDK/protocol can provide it;
3. check whether a mature open-source library solves the generic part;
4. only build custom infrastructure where AsterTab has unique product value.

Avoid dependency bloat, but also avoid reinventing generic infrastructure.

---

## 13. Permissions

Use least privilege.

Permissions should be:

- modular;
- explicit;
- revocable;
- scoped to the integration/action that needs them.

Conceptually separate:

```text
browser history
GitHub
OJ
AI provider
calendar
future local host
```

Installing AsterTab must not imply access to everything.

---

## 14. Action Risk Model

Think in levels:

### L0 — Search / navigation

Usually safe to execute directly.

### L1 — Browser actions

Low-risk but observable.

### L2 — Personal data changes

Show what will change.

### L3 — External service writes

Prefer preview + confirmation.

### L4 — Local system / shell

Future scope.

Require strict authorization and explicit confirmation.

Do not blur read and write permissions.

---

## 15. Data Principles

Use a hybrid local-first philosophy.

Prefer local storage for:

- sensitive indexes;
- history-derived context;
- private contextual state;
- search indexes;
- derived private metadata.

Optional sync may cover:

- layouts;
- preferences;
- shortcuts;
- non-sensitive configuration;
- workspace metadata.

Avoid making cloud login mandatory for basic usefulness.

---

## 16. Architecture Direction

Keep the core service-agnostic.

Long-term conceptual boundaries:

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
      +-- ...
```

Important:

- do not hard-code provider-specific behavior into unrelated core modules;
- prefer narrow interfaces;
- keep integration boundaries clear;
- avoid premature abstractions that have no second real use case.

---

## 17. Suggested Repository Shape

Treat this only as a direction, not a mandate:

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
+-- tests/
+-- PROJECT.md
+-- AGENTS.md
+-- README.md
```

Do not create all directories merely because they appear here.

Create structure only when justified by actual implementation.

---

## 18. Engineering Behavior for Codex

When asked to implement something:

1. inspect the repository first;
2. identify existing conventions;
3. understand the exact requested scope;
4. avoid unrelated refactors;
5. propose a concise implementation plan for non-trivial work;
6. keep changes modular and reviewable;
7. test the behavior you changed;
8. verify before claiming success.

Do not report “done”, “fixed”, or “passing” without evidence.

---

## 19. Scope Control

When a request suggests multiple new subsystems, explicitly separate:

```text
required now
nice later
out of scope
```

Do not implement speculative future architecture unless it materially simplifies the current requirement.

Apply YAGNI aggressively.

---

## 20. UX Rules

Prefer:

- keyboard-first interaction;
- fast startup;
- predictable commands;
- progressive disclosure;
- minimal default UI;
- high information density without clutter;
- discoverable advanced features;
- visible permissions;
- explainable Agent actions.

Avoid:

- widget overload;
- decorative noise;
- slow startup;
- excessive animation;
- chat-first UI for every feature;
- unexplained background activity;
- hidden automation.

---

## 21. Performance Rule

A new-tab page is latency-sensitive.

Treat startup performance as a product feature.

Avoid making initial rendering depend on:

- AI responses;
- slow remote APIs;
- unnecessary network requests;
- large integration initialization;
- expensive background computation.

Prefer:

```text
render immediately
        ↓
load local state
        ↓
progressively hydrate optional context
```

The page must remain useful even when external services are unavailable.

---

## 22. Failure Behavior

Integrations will fail.

Design for partial availability.

If GitHub, OJ, or AI is unavailable:

- core new-tab functionality should still work;
- Command Center should still handle local/deterministic actions;
- failures should be isolated to the affected integration;
- show useful recovery information;
- never make one provider failure break the entire page.

---

## 23. AI Provider Design

Do not assume one permanent provider.

Keep conceptual separation between:

```text
Agent logic
        |
Provider interface
        |
OpenAI / Anthropic / Gemini / OpenRouter / ...
```

Provider-specific advanced features are allowed behind capability checks.

Do not reduce all providers to the lowest common denominator if richer capabilities can be exposed cleanly.

---

## 24. OJ Integration Design

Do not make OJ logic synonymous with Luogu.

Prefer:

```text
OJ abstraction
    |
    +-- Luogu
    +-- Codeforces
    +-- future adapters
```

Shared concepts may include:

- problem;
- contest;
- submission;
- verdict;
- language;
- user;
- source link.

Do not prematurely force incompatible platforms into a bad universal schema.

---

## 25. GitHub Integration Design

GitHub integration may provide contextual data such as:

- repositories;
- files;
- commits;
- issues;
- pull requests;
- code links.

For V1, optimize for useful context retrieval rather than recreating a full GitHub client.

---

## 26. Security

Never:

- expose secrets in client logs;
- commit API keys;
- persist tokens insecurely without explicit design;
- grant broad permissions “just in case”;
- send private browser context to AI without clear permission and policy.

Treat user context as sensitive by default.

---

## 27. Documentation

For major decisions, prefer short decision documents over burying assumptions in code.

Useful locations:

```text
docs/architecture/
docs/decisions/
docs/specs/
```

Do not generate documentation for documentation's sake.

Document choices that future agents/developers need to understand.

---

## 28. Commit / Change Discipline

Keep changes cohesive.

A single change should preferably answer one clear question.

Avoid mixing:

- architecture refactors;
- formatting changes;
- dependency upgrades;
- product changes;
- unrelated bug fixes

in one implementation unless necessary.

---

## 29. When Requirements Are Ambiguous

Do not guess major product behavior.

For important ambiguity:

- state the ambiguity;
- derive likely options from `PROJECT.md`;
- prefer the option that best preserves scope and product principles;
- ask the user when the decision would materially affect architecture or UX.

For small implementation details, make a reasonable local decision and document it.

---

## 30. Explicit Non-Goals for V1

Do not treat these as required:

- dozens of widgets;
- dozens of integrations;
- full plugin marketplace;
- local shell Agent;
- native host;
- advanced sync backend;
- autonomous background Agent;
- full productivity suite;
- general-purpose desktop automation.

---

## 31. V1 Proof Questions

Every major V1 decision should help answer at least one:

### Q1

Is the Command Center useful enough to become a daily entry point?

### Q2

Is GitHub + OJ + AI contextual orchestration more useful than simply opening a generic AI chat?

If a proposed feature helps neither, challenge its priority.

---

## 32. Final Product Reminder

AsterTab is not:

> “a new tab with every feature.”

AsterTab is:

> **a fast, restrained command workspace that connects existing tools and uses AI only where semantic understanding creates real value.**

When uncertain, return to:

> **Don't replace your tools. Connect them.**
