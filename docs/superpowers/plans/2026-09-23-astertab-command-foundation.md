# AsterTab Command Center First Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Implementation still requires the user's separate authorization.
>
> **状态：待最终审核；不构成实现授权。** Architecture Spec 与五个 Task 的顺序已获确认。本计划审核通过并获得单独实现授权后，才能 scaffold、安装依赖或编码。

**Goal:** 交付 Chrome / Edge 可加载的本地新标签 Command Center。空输入不执行；普通文本及 g、gh、lg 命令只经确定性逻辑进入固定 HTTPS 搜索目标；显式 ai 命令只显示“AI 尚未接入”。首屏、解析和 URL 构造不依赖网络。

**Architecture:** WXT 负责 MV3 入口、Manifest、浏览器目标和开发流程；Preact 负责输入 UI 与本地提示；纯 TypeScript Command Parser 负责分类；纯 TypeScript URL builder 负责固定搜索目标和编码；newtab 入口只负责挂载及 `window.location.assign`。不拆 Search Engine package，不添加 service worker、content script、registry、通用 executor、adapter 或 plugin runtime。

**Tech Stack:** Chrome / Edge Manifest V3、WXT 0.21.4、Vite 8.3.0、TypeScript 6.0.3、Preact 10.29.8、`@preact/preset-vite` 2.10.6、Vitest 5.0.1、npm。纯逻辑测试使用 Vitest 的 Node 环境；UI 交互通过 Task 4、5 的真实浏览器验收，不安装 jsdom 或 Testing Library。版本是 2026-09-24 查询 registry 后确定的候选精确版本；Task 1 开始时仍须复核环境和元数据。当前本机 Node 为 v26.9.0、npm 为 11.19.0，但执行时必须重新检查。

**Spec:** [已批准的命令架构设计](../specs/2026-09-23-astertab-command-architecture-design.md)、[ADR-0001 技术栈](../../decisions/ADR-0001-wxt-preact-extension-stack.md)、[PROJECT.md](../../../PROJECT.md)、[AGENTS.md](../../../AGENTS.md)。

## Global Constraints

- 遵守 Approved Spec：普通文本恒为确定性默认搜索；搜索失败、未知文本、低置信度、服务不可用都不能自动进入 AI/Agent。
- 只有首 token 为 `ai`（大小写不敏感且 token 完全匹配）才是显式 Agent 请求。第一切片不调用 AI、不联网；`ai <request>` 显示“AI 尚未接入”，不降级为搜索。
- 搜索目的地只能由 `SearchTarget` 的固定分支决定。用户输入一律作为 query；不得解析成 origin、scheme、完整 URL 或浏览器指令。
- 首切片无浏览器 API、host permissions、storage、service worker、content script、登录、远程配置或外部 API。Manifest 不声明权限；开发构建额外权限须和生产构建分开审计。
- 新标签本地 HTML、JS、CSS 和本地状态即可渲染；不等待网络、AI、第三方服务或远程配置。UI 使用 Preact 函数组件，不用原生 DOM 拼 UI；入口只做挂载和导航回调。
- WXT 管扩展工程、Manifest 和目标浏览器构建；不自建脚手架、manifest 拼装器或开发服务器。Preact preset 关闭 React 别名；不增加大型 UI、状态、路由或插件框架。
- 保持单仓库、单扩展应用；不为未来能力创建 capability/adapter/provider/context registry、通用 Executor、占位接口/文件或额外 package。
- npm 顶层依赖用精确版本，`package.json` 不写 `^`/`~`；提交唯一 `package-lock.json` 锁定完整解析树。兼容性检查失败时不得自行换版本，先停下报告并修订本计划。
- 每个任务只 stage 该任务列出的文件，并按任务给出的 message 建立独立 commit。不得用 `git add .`、`git add -A` 或顺手提交其他已有未跟踪文件。
- 当前 `PROJECT.md`、`AGENTS.md` 和 `docs/` 均为用户已有的未跟踪内容；执行期间保护它们，不把本文档或其他已有文件顺手纳入 Task commit。

## Review Focus

| 必须审查的行为 | 明确用例与预期 | 覆盖任务 |
| --- | --- | --- |
| 未知普通文本默认搜索，绝不升级 Agent | `how do I debug dynamic programming?` → `kind: "search", target: "default"` | Task 2 的单测、Task 4/5 的浏览器验收 |
| 命令 token 大小写与边界 | `AI explain` 是显式 Agent；`GH preact` 是 GitHub 搜索；`ghfoo preact` 是普通默认搜索 | Task 2 的单测、Task 4/5 的浏览器验收 |
| 已知前缀缺参数 | `g`、`gh`、`lg` 返回本地 `missing_query`；`ai` 返回 `missing_agent_request`；都不导航 | Task 2 的单测、Task 4/5 的浏览器验收 |
| Unicode 和 `&` 是一个查询值 | `g 矩阵 & 字符串` 构造 Google URL，`searchParams.get("q")` 仍等于原查询 | Task 3 的单测、Task 5 的浏览器验收 |
| 危险 scheme 只能是搜索数据 | `javascript:alert(1)`、`data:text/html,hello` 保留为 query；生成结果永远是固定 HTTPS origin | Task 2/3 的单测、Task 5 的浏览器验收 |
| `gh` 的语义不会被误认成代码搜索 | `gh preact` 使用 GitHub `type=repositories`；不声明 GitHub 登录、代码 API 或 token | Task 3 的单测、Task 5 的浏览器验收 |
| 首屏独立于第三方 | Chrome / Edge 断网加载仍能显示并输入；提交 `ai explain` 不产生网络请求 | Task 5 |

## 已核验并定稿供本计划审核的搜索行为

执行代理不得临场选择服务、hostname、path 或参数。固定路由如下；builder 用 `URL` 和 `URLSearchParams` 赋值，不拼接用户提供的 URL：

| 输入 | 目标 | 固定 HTTPS 路由 |
| --- | --- | --- |
| 无前缀普通文本 | Bing 默认网页搜索 | `https://www.bing.com/search?q=<query>` |
| `g <query>` | Google 网页搜索 | `https://www.google.com/search?q=<query>` |
| `gh <query>` | GitHub 公开仓库搜索（不是 code search） | `https://github.com/search?q=<query>&type=repositories` |
| `lg <query>` | 洛谷题库问题列表 | `https://www.luogu.com.cn/problem/list?keyword=<query>&page=1` |

核验记录（2026-09-24）：[Microsoft Edge 搜索 URL 文档](https://learn.microsoft.com/zh-cn/deployedge/microsoft-edge-policies/defaultsearchprovidersearchurl)明确给出 Bing/Google 的 `search?q=` 形式；[GitHub 仓库搜索文档](https://docs.github.com/en/search-github/searching-on-github/searching-for-repositories)确认仓库搜索与代码搜索的区别；[洛谷题库页面](https://www.luogu.com.cn/problem/list?keyword=astertab&page=1)使用 `keyword`、`page` 参数。先前对四条测试路由的实际 GET 首次均返回 HTTP 200；本次网页工具无法重新打开四个搜索结果页，因此在线可用性仍以 Task 5 的 Chrome/Edge 实测为准。固定路由和产品语义已定，执行代理不得临时改目的地。

## 文件职责图与任务顺序

| 路径 | 单一职责 | 所属 Task |
| --- | --- | --- |
| `package.json`、`package-lock.json`、`wxt.config.ts`、`tsconfig.json`、`.gitignore` | 扩展工程与可复现依赖 | 1 |
| `entrypoints/newtab/index.html`、`entrypoints/newtab/main.tsx` | WXT 页面入口、Preact 挂载与最终导航副作用 | 1、4 |
| `src/app/command-center/CommandCenter.tsx`、`command-center.css` | 输入、状态、提示和本地交互 | 1、4 |
| `vitest.config.ts`、`src/core/commands/parse-command.ts`、`tests/commands/parse-command.test.ts` | Node 测试配置与纯输入分类 | 2 |
| `src/core/search/build-search-url.ts`、`tests/search/build-search-url.test.ts` | 固定 HTTPS 搜索路由与编码 | 3 |
| `docs/testing/command-center-first-slice-acceptance.md` | 实际浏览器、权限和性能验收证据 | 5 |

每个 Task 的交付物可单独构建或验证；后续 Task 只依赖此表明确列出的先前交付物。当前仅编写计划，没有创建上述工程文件。

### Task 1：建立 WXT / Preact 新标签工程壳

**目标：** 建立单扩展 npm 工程；WXT 生成 MV3 newtab；Preact 本地挂载最小可访问输入壳。先核对兼容矩阵，再创建应用入口。本 Task 通过 typecheck、双浏览器构建和本地页面加载验收；纯逻辑 TDD 从 Task 2 开始。

**Files**

- Create: `package.json`、`package-lock.json`、`wxt.config.ts`、`tsconfig.json`、`.gitignore`。
- Create: `entrypoints/newtab/index.html`、`entrypoints/newtab/main.tsx`。
- Create: `src/app/command-center/CommandCenter.tsx`、`src/app/command-center/command-center.css`。
- Modify: 无。
- Test: 不创建 DOM 测试文件；执行 `npm run typecheck`、Chrome/Edge build 和本地页面加载检查。

**Interfaces**

- `entrypoints/newtab/index.html` 提供唯一 `#app` mount 节点并加载同目录 `main.tsx`。
- 本任务临时页面壳接口：`export function CommandCenter(): JSX.Element`；Task 4 会变更为最终 `CommandCenterProps` 接口。
- `main.tsx` 只取得 `#app`、调用 Preact `render`；导航回调在 Task 4 接入。
- WXT `newtab` HTML entrypoint 自动生成 manifest 覆盖项；不手写 manifest 文件或构建管道。

**步骤**

- [ ] **兼容性预检（scaffold 前）。** 执行以下只读命令：
  ```powershell
  node --version
  npm --version
  npm view wxt@0.21.4 peerDependencies engines --json
  npm view vite@8.3.0 engines --json
  npm view typescript@6.0.3 engines --json
  npm view preact@10.29.8 version --json
  npm view @preact/preset-vite@2.10.6 peerDependencies --json
  npm view vitest@5.0.1 peerDependencies engines --json
  ```
  **预期：** 精确版本均存在；WXT peer 支持 Vite 8、TS ≥5.4、Node ≥22；Vitest peer 支持 Vite 8 且要求 Node ≥22.12；preset peer 支持 Vite 8。只在 Node `22.12+`（22.x）、`24.x` 或 `26+` 继续。版本不存在、peer 不相交、或 Node 不满足时停止，不 scaffold、不安装、不暗中换 pin，先修订计划。
- [ ] **初始化并精确安装。** 执行 `npm init -y`，随后执行：
  ```powershell
  npm install --save-exact preact@10.29.8
  npm install --save-dev --save-exact wxt@0.21.4 vite@8.3.0 typescript@6.0.3 @preact/preset-vite@2.10.6 vitest@5.0.1
  ```
  **预期：** 只生成 npm 的 `package-lock.json`；`package.json` 顶层版本均为精确版本，不含 `^`/`~`。
- [ ] **配置 WXT 与 TypeScript。** 在 `package.json` 设置如下 scripts；配置 `wxt.config.ts` 使用 `preact({ reactAliasesEnabled: false })`，Manifest 指定 name、description，version 由 `package.json` 提供；`tsconfig.json` extends `./.wxt/tsconfig.json`，JSX 使用 `react-jsx` 与 `jsxImportSource: "preact"`。`.gitignore` 排除 `node_modules/`、`.output/`、`.wxt/`、`.vitest/`。
  ```json
  {
    "scripts": {
      "dev": "wxt -b chrome",
      "dev:edge": "wxt -b edge",
      "build": "wxt build -b chrome",
      "build:edge": "wxt build -b edge",
      "typecheck": "tsc --noEmit",
      "test": "vitest run",
      "postinstall": "wxt prepare"
    }
  }
  ```
  ```ts
  // wxt.config.ts
  import preact from "@preact/preset-vite";
  import { defineConfig } from "wxt";

  export default defineConfig({
    manifest: {
      name: "AsterTab",
      description: "Don't replace your tools. Connect them.",
    },
    vite: () => ({ plugins: [preact({ reactAliasesEnabled: false })] }),
  });
  ```
  ```json
  {
    "extends": "./.wxt/tsconfig.json",
    "compilerOptions": {
      "jsx": "react-jsx",
      "jsxImportSource": "preact",
      "strict": true
    }
  }
  ```
  `.gitignore` 内容：
  ```gitignore
  node_modules/
  .output/
  .wxt/
  .vitest/
  ```
  **预期：** WXT 生成 `.wxt/` TS 类型配置和生产 Manifest；Manifest 版本取自 `package.json`；不手写 Manifest 或开发服务器配置。
- [ ] **实现最小 Preact 壳。** 创建以下四个文件：
  ```html
  <!-- entrypoints/newtab/index.html -->
  <!doctype html>
  <html lang="zh-CN">
    <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>AsterTab</title></head>
    <body><div id="app"></div><script type="module" src="./main.tsx"></script></body>
  </html>
  ```
  ```tsx
  // entrypoints/newtab/main.tsx
  import { render } from "preact";
  import { CommandCenter } from "../../src/app/command-center/CommandCenter";

  const root = document.getElementById("app");
  if (!root) throw new Error("Missing #app mount node");
  render(<CommandCenter />, root);
  ```
  ```tsx
  // src/app/command-center/CommandCenter.tsx
  import type { JSX } from "preact";
  import "./command-center.css";

  export function CommandCenter(): JSX.Element {
    return <main><label for="command-input">搜索或输入命令</label><input id="command-input" autoFocus /><p>g / gh / lg / ai</p></main>;
  }
  ```
  ```css
  /* src/app/command-center/command-center.css */
  body { margin: 0; font: 16px system-ui, sans-serif; }
  main { max-width: 42rem; margin: 15vh auto 0; padding: 1.5rem; }
  label { display: block; margin-bottom: 0.75rem; }
  input { width: 100%; box-sizing: border-box; padding: 0.75rem; font: inherit; }
  ```
  **预期：** Chrome/Edge 本地新标签均能显示可聚焦输入框；没有 fetch、AI、storage 或 `chrome.*` 调用。
- [ ] **验证锁文件可复现。** 执行 `npm ci`。
  **预期：** 命令退出码为 0；按唯一 lockfile 安装同一组依赖 pin。
- [ ] **检查工程类型。** 执行 `npm run typecheck`。
  **预期：** TypeScript 检查退出码为 0。
- [ ] **构建 Chrome 目标。** 执行 `npm run build`。
  **预期：** 命令退出码为 0，生成 `.output/chrome-mv3/`。
- [ ] **构建 Edge 目标。** 执行 `npm run build:edge`。
  **预期：** 命令退出码为 0，生成 `.output/edge-mv3/`。
- [ ] **手动验收本地页面和开发重载。** 在终端执行 `npm run dev`；Chrome 扩展页加载 `.output/chrome-mv3/` unpacked 输出，打开新标签检查输入框；临时改动组件 CSS 并保存一次，再用同一补丁恢复到计划样式。
  **预期：** 本地新标签可打开，CSS 改动触发 WXT 开发重载；不以开发 Manifest 权限作为生产依据。按 `Ctrl+C` 结束 dev server。
- [ ] **提交 Task 1。** 执行：
  ```powershell
  git add package.json package-lock.json wxt.config.ts tsconfig.json .gitignore entrypoints/newtab/index.html entrypoints/newtab/main.tsx src/app/command-center/CommandCenter.tsx src/app/command-center/command-center.css
  git diff --cached --check
  git commit -m "feat: scaffold AsterTab new tab"
  ```
  **预期：** 仅 Task 1 所列文件进入该 commit，commit 成功。

**独立验收：** 工程从 npm lockfile 可重装；Chrome / Edge 都有 MV3 newtab 输出；本地 Preact 输入壳能加载、测试和热更新。

### Task 2：实现确定性 Command Parser

**目标：** 用纯 TypeScript 对输入做确定性分类。未知文本始终搜索；仅显式 `ai` 前缀进入本地 Agent 未接入状态。

**Files**

- Create: `vitest.config.ts`、`src/core/commands/parse-command.ts`、`tests/commands/parse-command.test.ts`。
- Modify: 无。
- Test: `tests/commands/parse-command.test.ts`；使用 Vitest Node 环境。

**Interfaces**

- Consumes: Task 1 的 `package.json` 中 `npm test` 脚本；不依赖 Preact 或浏览器 API。
- Produces: 下列类型及 `parseCommand(input: string): ParsedCommand`，供 Task 3、4 使用。

```ts
export type SearchTarget = "default" | "google" | "github" | "luogu";

export type SearchCommand = {
  kind: "search";
  target: SearchTarget;
  query: string;
};

export type ParsedCommand =
  | { kind: "empty" }
  | SearchCommand
  | { kind: "agent"; request: string }
  | { kind: "error"; code: "missing_query"; command: "g" | "gh" | "lg" }
  | { kind: "error"; code: "missing_agent_request"; command: "ai" };

export function parseCommand(input: string): ParsedCommand;
```

**步骤**

- [ ] **配置纯逻辑测试环境。** 创建 `vitest.config.ts`：
  ```ts
  import { defineConfig } from "vitest/config";

  export default defineConfig({ test: { environment: "node" } });
  ```
  执行 `npm test -- --help`。**预期：** CLI 帮助正常显示；没有 DOM 测试依赖或 WXT browser mock。
- [ ] **写失败测试。** 在 `tests/commands/parse-command.test.ts` 写入下列完整用例，暂不创建实现文件：
  ```ts
  import { describe, expect, it } from "vitest";
  import { parseCommand } from "../../src/core/commands/parse-command";

  describe("parseCommand", () => {
    it.each([
      ["   ", { kind: "empty" }],
      ["how do I debug dynamic programming?", { kind: "search", target: "default", query: "how do I debug dynamic programming?" }],
      ["ghfoo preact", { kind: "search", target: "default", query: "ghfoo preact" }],
      ["git tutorial", { kind: "search", target: "default", query: "git tutorial" }],
      ["g matrix", { kind: "search", target: "google", query: "matrix" }],
      ["G matrix", { kind: "search", target: "google", query: "matrix" }],
      ["gh preact", { kind: "search", target: "github", query: "preact" }],
      ["GH preact", { kind: "search", target: "github", query: "preact" }],
      ["lg P1001", { kind: "search", target: "luogu", query: "P1001" }],
      ["LG P1001", { kind: "search", target: "luogu", query: "P1001" }],
      ["AI explain", { kind: "agent", request: "explain" }],
      ["g", { kind: "error", code: "missing_query", command: "g" }],
      ["gh   ", { kind: "error", code: "missing_query", command: "gh" }],
      ["lg", { kind: "error", code: "missing_query", command: "lg" }],
      ["ai", { kind: "error", code: "missing_agent_request", command: "ai" }],
      ["  g  矩阵 &  字符串  ", { kind: "search", target: "google", query: "矩阵 &  字符串" }],
      ["javascript:alert(1)", { kind: "search", target: "default", query: "javascript:alert(1)" }],
      ["data:text/html,hello", { kind: "search", target: "default", query: "data:text/html,hello" }],
    ] as const)("classifies %s", (input, expected) => {
      expect(parseCommand(input)).toEqual(expected);
    });
  });
  ```
- [ ] **运行并确认 FAIL。** 执行 `npm test -- tests/commands/parse-command.test.ts`。**预期：** 退出码非 0，错误指向尚不存在的 `parse-command` 模块；如果因测试配置或依赖失败，先修复该环境问题，直到失败由缺少实现造成。
- [ ] **写最小 parser。** 按以下逻辑创建 `src/core/commands/parse-command.ts`；类型声明须与上方接口逐字段一致：
  ```ts
  export function parseCommand(input: string): ParsedCommand {
    const trimmed = input.trim();
    if (!trimmed) return { kind: "empty" };
    const [, rawToken, rawRest = ""] = /^([^\s]+)(?:\s+([\s\S]*))?$/.exec(trimmed)!;
    const token = rawToken.toLowerCase();
    const query = rawRest.trim();
    if (token === "ai") {
      return query ? { kind: "agent", request: query } : { kind: "error", code: "missing_agent_request", command: "ai" };
    }
    const target: SearchTarget | undefined = token === "g" ? "google" : token === "gh" ? "github" : token === "lg" ? "luogu" : undefined;
    if (target) {
      return query ? { kind: "search", target, query } : { kind: "error", code: "missing_query", command: token as "g" | "gh" | "lg" };
    }
    return { kind: "search", target: "default", query: trimmed };
  }
  ```
  **预期：** `ghfoo`、危险 scheme、任意未知自然语言始终是默认搜索；不导入 UI、WXT 或 AI。
- [ ] **运行并确认 PASS。** 执行 `npm test -- tests/commands/parse-command.test.ts`。
  **预期：** 全部分类测试通过，普通自然语言没有 `agent` 结果。
- [ ] **运行完整 Vitest suite。** 执行 `npm test`。
  **预期：** 所有 parser 测试退出码为 0。
- [ ] **运行 TypeScript 检查。** 执行 `npm run typecheck`。
  **预期：** TS 类型检查退出码为 0。
- [ ] **提交 Task 2。** 两项检查都通过后执行：
  ```powershell
  git add vitest.config.ts src/core/commands/parse-command.ts tests/commands/parse-command.test.ts
  git diff --cached --check
  git commit -m "feat: add deterministic command parser"
  ```
  **预期：** 完整 Vitest suite 与类型检查退出码均为 0；只提交 Task 2 三个文件。

**独立验收：** 对同一输入总产生同一 ParsedCommand；非显式 `ai` 文本绝不产出 `agent`。

### Task 3：实现固定搜索 URL builder

**目标：** 把 SearchCommand 映射到上方已核验的固定 HTTPS 路由；用户输入只写入指定 query 参数。

**Files**

- Create: `src/core/search/build-search-url.ts`、`tests/search/build-search-url.test.ts`。
- Modify: 无。
- Test: `tests/search/build-search-url.test.ts`。

**Interfaces**

- Consumes: Task 2 的 `SearchCommand`，只接受 parser 已分类的搜索请求。
- Produces: `buildSearchUrl(command: SearchCommand): URL`，供 Task 4 导航回调使用。

```ts
import type { SearchCommand } from "../commands/parse-command";

export function buildSearchUrl(command: SearchCommand): URL;
```

**固定映射**

- `default` → `https://www.bing.com/search`，设置 `q=<query>`。
- `google` → `https://www.google.com/search`，设置 `q=<query>`。
- `github` → `https://github.com/search`，设置 `q=<query>` 和固定 `type=repositories`。
- `luogu` → `https://www.luogu.com.cn/problem/list`，设置 `keyword=<query>` 和固定 `page=1`。

**步骤**

- [ ] **写失败测试。** 创建 `tests/search/build-search-url.test.ts`，暂不创建 builder：
  ```ts
  import { describe, expect, it } from "vitest";
  import type { SearchCommand } from "../../src/core/commands/parse-command";
  import { buildSearchUrl } from "../../src/core/search/build-search-url";

  const cases: Array<[SearchCommand["target"], string, string, string, string]> = [
    ["default", "https://www.bing.com", "/search", "q", "hello world"],
    ["google", "https://www.google.com", "/search", "q", "hello world"],
    ["github", "https://github.com", "/search", "q", "hello world"],
    ["luogu", "https://www.luogu.com.cn", "/problem/list", "keyword", "hello world"],
  ];

  describe("buildSearchUrl", () => {
    it.each(cases)("routes %s to its fixed HTTPS origin", (target, origin, path, key, query) => {
      const url = buildSearchUrl({ kind: "search", target, query });
      expect(url).toBeInstanceOf(URL);
      expect(url.origin).toBe(origin);
      expect(url.pathname).toBe(path);
      expect(url.searchParams.get(key)).toBe(query);
      expect(url.searchParams.get("type")).toBe(target === "github" ? "repositories" : null);
      expect(url.searchParams.get("page")).toBe(target === "luogu" ? "1" : null);
    });

    it("keeps Unicode, ampersands, and attempted filters inside one query value", () => {
      const google = buildSearchUrl({ kind: "search", target: "google", query: "矩阵 & 字符串" });
      const github = buildSearchUrl({ kind: "search", target: "github", query: "preact&type=code" });
      expect(google.searchParams.get("q")).toBe("矩阵 & 字符串");
      expect(google.searchParams.size).toBe(1);
      expect(github.searchParams.get("q")).toBe("preact&type=code");
      expect(github.searchParams.get("type")).toBe("repositories");
    });

    it.each(["javascript:alert(1)", "data:text/html,hello"])("treats %s as search data", query => {
      const url = buildSearchUrl({ kind: "search", target: "default", query });
      expect(url.origin).toBe("https://www.bing.com");
      expect(url.searchParams.get("q")).toBe(query);
    });

    it.each(["", "   "])("rejects empty query %j", query => {
      expect(() => buildSearchUrl({ kind: "search", target: "google", query })).toThrow(RangeError);
    });
  });
  ```
- [ ] **运行并确认 FAIL。** 执行 `npm test -- tests/search/build-search-url.test.ts`。**预期：** 退出码非 0，原因是缺少 `build-search-url` 模块；先排除测试配置/依赖错误。
- [ ] **写最小固定路由。** 创建 `src/core/search/build-search-url.ts`：
  ```ts
  import type { SearchCommand } from "../commands/parse-command";

  export function buildSearchUrl(command: SearchCommand): URL {
    if (!command.query.trim()) throw new RangeError("Search query is empty");
    let url: URL;
    switch (command.target) {
      case "default":
        url = new URL("https://www.bing.com/search");
        url.searchParams.set("q", command.query);
        return url;
      case "google":
        url = new URL("https://www.google.com/search");
        url.searchParams.set("q", command.query);
        return url;
      case "github":
        url = new URL("https://github.com/search");
        url.searchParams.set("q", command.query);
        url.searchParams.set("type", "repositories");
        return url;
      case "luogu":
        url = new URL("https://www.luogu.com.cn/problem/list");
        url.searchParams.set("keyword", command.query);
        url.searchParams.set("page", "1");
        return url;
    }
  }
  ```
  **预期：** 用户文本只进入 query 参数；没有任何用户可控的 origin、scheme 或固定筛选参数。
- [ ] **运行并确认 PASS。** 执行 `npm test -- tests/search/build-search-url.test.ts`。
  **预期：** 四个 target 的 host/path/参数完全匹配表格；Unicode 与 `&` 通过 `searchParams.get` 还原为单一原 query；恶意 scheme 输入仍得到指定 HTTPS host；全空白 query 抛 `RangeError`。
- [ ] **运行完整 Vitest suite。** 执行 `npm test`。
  **预期：** parser 和 URL builder 测试退出码为 0。
- [ ] **运行 TypeScript 检查。** 执行 `npm run typecheck`。
  **预期：** TS 类型检查退出码为 0。
- [ ] **提交 Task 3。** 两项检查都通过后执行：
  ```powershell
  git add src/core/search/build-search-url.ts tests/search/build-search-url.test.ts
  git diff --cached --check
  git commit -m "feat: add fixed search URL builder"
  ```
  **预期：** 完整单测与类型检查退出码均为 0；只提交 Task 3 两个文件。

**独立验收：** Builder 不接受任意目的地；唯一输出是表内四个 HTTPS origin/path 之一。

### Task 4：接通 Preact Command Center 和导航

**目标：** UI 收集输入、展示本地结果/提示并调用窄导航回调；解析和目的地规则留在纯逻辑模块。

**Files**

- Create: 无。
- Modify: `src/app/command-center/CommandCenter.tsx`、`src/app/command-center/command-center.css`、`entrypoints/newtab/main.tsx`。
- Test: Task 2/3 的完整单测；Chrome 开发包的手动键盘交互。UI 交互在 Task 5 用 Chrome/Edge 生产包复验。

**Interfaces**

```ts
import type { JSX } from "preact";

export type CommandCenterProps = {
  onNavigate: (url: URL) => void;
};

export function CommandCenter(props: CommandCenterProps): JSX.Element;
```

- Consumes: Task 2 的 `parseCommand(input: string): ParsedCommand` 与 Task 3 的 `buildSearchUrl(command: SearchCommand): URL`。
- Produces: `CommandCenter(props: CommandCenterProps): JSX.Element`；由 `main.tsx` 注入 `onNavigate(url: URL): void`。
- 组件只在 `kind: "search"` 时调用 `props.onNavigate(url)`；`empty` 不执行，`error` 展示本地提示，`agent` 显示“AI 尚未接入”。
- `entrypoints/newtab/main.tsx` 将 `onNavigate` 实现为 `window.location.assign(url.href)`；不调用 `chrome.*`、不申请权限。

**步骤**

- [ ] **接通 Command Center 表单。** 将 Task 1 的页面壳替换为下列组件；CSS 追加下列按钮和状态样式。`onSubmit` 只对 `kind: "search"` 调用 URL builder 和窄导航回调；空输入清空状态且不导航。
  ```tsx
  import type { JSX } from "preact";
  import { useState } from "preact/hooks";
  import { parseCommand } from "../../core/commands/parse-command";
  import { buildSearchUrl } from "../../core/search/build-search-url";
  import "./command-center.css";

  export type CommandCenterProps = {
    onNavigate: (url: URL) => void;
  };

  export function CommandCenter({ onNavigate }: CommandCenterProps): JSX.Element {
    const [input, setInput] = useState("");
    const [status, setStatus] = useState("");
    return (
      <main>
        <form onSubmit={event => {
          event.preventDefault();
          const result = parseCommand(input);
          if (result.kind === "search") {
            onNavigate(buildSearchUrl(result));
            return;
          }
          if (result.kind === "agent") {
            setStatus("AI 尚未接入。");
            return;
          }
          if (result.kind === "error") {
            setStatus(result.code === "missing_query" ? "请输入搜索内容。" : "请输入 AI 请求内容。");
            return;
          }
          setStatus("");
        }}>
          <label for="command-input">搜索或输入命令</label>
          <input id="command-input" value={input} onInput={event => { setInput(event.currentTarget.value); setStatus(""); }} autoFocus />
          <button type="submit">搜索</button>
        </form>
        <p>g / gh / lg / ai</p>
        <p role="status">{status}</p>
      </main>
    );
  }
  ```
  ```css
  /* 追加到 src/app/command-center/command-center.css */
  button { margin-top: 0.75rem; padding: 0.5rem 0.9rem; font: inherit; }
  [role="status"] { min-height: 1.5em; }
  ```
  **预期：** 错误与 Agent 请求仅显示本地状态；组件不写服务 URL、不访问 `chrome.*`、不发请求。
- [ ] **接通入口导航。** 将 `entrypoints/newtab/main.tsx` 更新为：
  ```tsx
  import { render } from "preact";
  import { CommandCenter } from "../../src/app/command-center/CommandCenter";

  const root = document.getElementById("app");
  if (!root) throw new Error("Missing #app mount node");
  render(<CommandCenter onNavigate={url => window.location.assign(url.href)} />, root);
  ```
  **预期：** 入口仅执行经 builder 产生的 URL 导航；不存在扩展消息通道或浏览器 API 调用。
- [ ] **Chrome 开发包键盘验收。** 执行 `npm run dev`，加载开发包；打开新标签，确认输入焦点。逐项输入并按 Enter：空白、`hello world`、`g dynamic programming`、`gh preact`、`lg P1001`、`ghfoo preact`、`g`、`gh`、`lg`、`ai`、`AI explain`。导航成功的用例每次返回新标签重试；不导航用例保持本地页。检查错误文案和目的地地址栏。
  **预期：** `hello world`、`g`、`gh`、`lg` 的完整查询按固定目标导航，`ghfoo` 进 Bing；空白不导航；缺参、Agent 状态只更新本地文字。按 `Ctrl+C` 结束 dev server。此步骤不以开发包权限或在线搜索结果质量代替 Task 5 的生产验收。
- [ ] **运行完整 Vitest suite。** 执行 `npm test`。
  **预期：** parser 与 builder 测试退出码为 0。
- [ ] **运行 TypeScript 检查。** 执行 `npm run typecheck`。
  **预期：** TS 类型检查退出码为 0。
- [ ] **构建 Chrome 与 Edge。** 分别执行 `npm run build` 和 `npm run build:edge`。
  **预期：** 两个 WXT production build 均退出码为 0；组件与核心代码不访问浏览器 API，不发网络请求。
- [ ] **提交 Task 4。** 执行：
  ```powershell
  git add src/app/command-center/CommandCenter.tsx src/app/command-center/command-center.css entrypoints/newtab/main.tsx
  git diff --cached --check
  git commit -m "feat: connect command center navigation"
  ```
  **预期：** 仅 Task 4 所列三个文件进入 commit。

**独立验收：** `CommandCenter` 无扩展权限依赖；导航由入口提供；组件不会把未知文本或 Agent 请求发送给 AI。

### Task 5：生产构建、权限审计与 Chrome / Edge 验收

**目标：** 在两种浏览器用生产构建验收可用路由、离线首屏、无权限依赖和本地 AI 提示，并留下实际证据。

**Files**

- Create: `docs/testing/command-center-first-slice-acceptance.md`，只记录本次真实执行结果。
- Modify: 无；若验收失败，回到所属 Task 单独修复并记录复测结果。
- Test: `npm test`、`npm run typecheck`、两个 production build、Manifest 审计，以及 Chrome/Edge 的生产包人工验收。

**Interfaces**

- 消费 Task 1–4 的 npm scripts 和 `.output/chrome-mv3/`、`.output/edge-mv3/`。
- 产出验收记录：运行日期、Node/npm 和浏览器版本、命令退出结果、两个 Manifest 摘要、路由检查、离线与 AI 网络检查、bundle bytes、FCP 样本。
- 验收未通过时不得填写“通过”或提交 Task 5；回到失败 Task 修复，另做范围明确的修复 commit 后重跑失败项。

**步骤**

- [ ] **用锁文件干净安装。** 执行 `npm ci`。
  **预期：** 退出码 0；安装版本与 lockfile 一致。
- [ ] **重跑完整测试和类型检查。** 分别执行 `npm test`、`npm run typecheck`。
  **预期：** 所有测试通过，类型检查退出码为 0。
- [ ] **重跑 Chrome 与 Edge production build。** 分别执行 `npm run build`、`npm run build:edge`。
  **预期：** 两条命令退出码均为 0；两个生产输出目录均生成。
- [ ] **逐份审计生产 Manifest。** 执行：
  ```powershell
  $manifestPaths = @(
    ".output/chrome-mv3/manifest.json",
    ".output/edge-mv3/manifest.json"
  )
  foreach ($manifestPath in $manifestPaths) {
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    [pscustomobject]@{
      Path = $manifestPath
      Version = $manifest.manifest_version
      Permissions = ($manifest.permissions -join ",")
      HostPermissions = ($manifest.host_permissions -join ",")
      NewTab = $manifest.chrome_url_overrides.newtab
      Background = $null -ne $manifest.background
      ContentScripts = $null -ne $manifest.content_scripts
    } | Format-List
  }
  ```
  **预期：** 两个版本均为 Manifest V3；newtab override 指向 `newtab.html`；permissions/host permissions 为空或字段不存在；无 background 和 content scripts。发现开发热更新权限进入生产输出即停止验收并查明原因。
- [ ] **在 Chrome 验收生产包。** 打开 `chrome://extensions`，启用 Developer mode，加载 unpacked `.output/chrome-mv3/`；打开新标签页。检查输入焦点、Tab/Shift+Tab 到按钮再 Enter 提交的键盘流程、本地首屏；然后在线逐项提交 `hello world`、`g dynamic programming`、`gh preact`、`lg P1001`。
  **预期：** 进入 Bing `/search?q=...`、Google `/search?q=...`、GitHub `/search?q=...&type=repositories`、Luogu `/problem/list?keyword=...&page=1`；第三方结果页依赖其自身在线可用性。记录浏览器完整版本与每项通过/失败。
- [ ] **在 Edge 验收生产包。** 打开 `edge://extensions`，启用 Developer mode，加载 unpacked `.output/edge-mv3/`；重复输入焦点、Tab/Shift+Tab/Enter 键盘流程与四条路由检查。
  **预期：** 结果和 Chrome 相同；记录完整 Edge 版本及每项通过/失败。
- [ ] **验证危险输入和语法提示。** 在至少一个浏览器输入 `ghfoo preact`、单独 `g`、`gh`、`lg`、`ai`、`AI explain`、`javascript:alert(1)`、`data:text/html,hello` 及 `g 矩阵 & 字符串`。
  **预期：** `ghfoo` 作为 Bing 普通查询；缺参数和 AI 分支显示可恢复的本地提示且不导航；scheme 字符串仍进入 Bing 查询参数；Unicode/`&` 解码后是原始单一 query，地址栏 origin 仍是固定服务 host。
- [ ] **验证离线首屏和 AI 不联网。** Chrome、Edge 均用 DevTools Network 检查新标签正常在线加载时是否出现非扩展资源请求；然后切到 Offline 并重新加载 newtab，输入但不要提交外部搜索；提交 `ai explain` 并观察 Network 面板。
  **预期：** 在线首屏没有无必要的第三方请求；离线状态下输入 UI、帮助和状态仍可用；Agent 提示为“AI 尚未接入”；提交 `ai` 不产生到 AI/第三方服务的请求。分别记录浏览器、请求 URL/数量或零请求证据，避免将第三方搜索结果页的请求算作扩展首屏请求。
- [ ] **记录体积与启动观测。** Chrome 和 Edge 各在浏览器重启后首次打开新标签时记录一次 FCP，作为冷启动观测；随后每个浏览器再打开五个新标签，记录 FCP 原始值及中位数。DevTools Console 使用 `performance.getEntriesByName("first-contentful-paint")[0]?.startTime`；生产包 JS 体积按下列命令计算：
  ```powershell
  foreach ($bundlePath in @(".output/chrome-mv3", ".output/edge-mv3")) {
    $bytes = (Get-ChildItem -LiteralPath $bundlePath -Recurse -File -Filter "*.js" |
      Measure-Object -Property Length -Sum).Sum
    "{0}: {1} bytes" -f $bundlePath, $bytes
  }
  ```
  **预期：** 验收文档分别记录 Chrome/Edge 的首次 FCP、五次重复 FCP、中位数和 JS bytes；标明机器、浏览器版本、是否打开 DevTools 及 Network 限速状态。FCP 是渲染观测值，不宣称等同用户感知的全部启动时间；不新增无依据阈值或生产埋点。
- [ ] **写验收记录并提交。** 将实际环境、Node/npm/浏览器版本、命令退出结果、两份 Manifest 摘要、每项路由/键盘/离线/危险输入结果、首屏 Network 观察、FCP 样本与 bytes 写入 `docs/testing/command-center-first-slice-acceptance.md`；每个结论标出通过/失败及其原始观察。复核数字来自真实输出。执行：
  ```powershell
  git add docs/testing/command-center-first-slice-acceptance.md
  git diff --cached --check
  git commit -m "docs: record command center browser acceptance"
  ```
  **预期：** 仅验收记录进入 Task 5 commit；失败项保持明确未通过，不用文档掩盖。

**独立验收：** 生产构建在 Chrome 和 Edge 可加载；普通搜索路由、dangerous-scheme 数据隔离、AI 本地提示、离线首屏及权限边界均有实测记录。

## 明确的 Non-Goals

- AI API/SDK、Intent Interpreter、Agent Orchestrator、Agent runtime、模型请求或 AI provider。
- service worker、content script、扩展消息通道、任何 browser API 权限。
- GitHub / OJ 登录、OAuth、token、服务 API、私有仓库读取、代码搜索 API、当前题目或提交读取。
- history、tabs、bookmarks、本地上下文、搜索索引、Context persistence、远程同步。
- Permission UX、Context 外发、凭证或上下文存储。
- Workspace、widgets、弹层、Command Palette、插件 runtime/marketplace。
- 通用 Tool/Capability registry、Executor、Adapter、Context Provider registry。
- 为未来 Agent 增加占位接口、占位文件、额外 package 或后台设施。
- 搜索联想、结果页嵌入、自动补全、Escape/global hotkey、无依据的性能阈值。

## 后续决策闸门

- GitHub / OJ / AI 学习诊断须先单独定义一个端到端只读 workflow 的入口、数据来源、认证、失败降级和上下文外发，再写实施计划。
- Permission UX 将来按场景区分一次性、会话级、持续授权及高风险逐次确认；本计划不预建授权存储或提示系统。
- 当前 `ai` 是显式请求语法，不代表长期产品概念中的 AI 与 Agent 等同。
- 第二个真实用例证明复用价值之前，不提取通用接口或运行时。

## Self-Review（writing-plans）

- [x] **Spec coverage：** Task 1–5 只覆盖批准的本地确定性 Command Center；普通文本搜索、显式 ai 状态、固定 HTTPS 导航、Chrome/Edge 与离线验收都有对应步骤；Spec 中延后的 Agent、Context、权限、认证、集成均在 Non-Goals。
- [x] **Placeholder scan：** 搜索目标、host、query 参数、依赖版本、文件路径、类型、npm 命令、测试命令和 commit message 均已写定；不存在 TBD/TODO、“自行决定”“适当处理”。
- [x] **Type consistency：** Parser 输出 `ParsedCommand`；Search builder 输入其中的 `SearchCommand` 并返回 `URL`；CommandCenter 输入 `onNavigate(URL)`；newtab 入口以 `url.href` 导航。字段名与 discriminant 在 Task 2–4 一致。
- [x] **Review Focus coverage：** 五类指定安全/路由用例均在 Task 2/3 的实际测试代码中；Task 4/5 用真实浏览器检查交互；第三方映射与权限边界在 Task 3/5；离线首屏和 AI 无网络在 Task 5。
- [x] **Task execution shape：** Task 2/3 以独立 checkbox 明确写失败测试、运行确认 FAIL、最小实现、运行确认 PASS、完整测试与独立 commit；Task 1/4 用构建和真实浏览器验证，不为当前需求添加 jsdom 或 Testing Library。
- [x] **No implementation performed in this revision：** 本次修改只更新本计划；未 scaffold、安装依赖、运行项目测试或构建。

---

**审核闸门：** 请审核最终任务顺序、接口、搜索路由和逐步验收方式。当前仍是 Draft；必须收到你单独的明确实现授权后才能执行 Task 1。实现时请按 [本计划](2026-09-23-astertab-command-foundation.md) 使用 Superpowers 子代理驱动开发，并在每个 Task 的 commit 后 review 再继续。

## References

- [WXT Installation](https://wxt.dev/guide/installation)
- [WXT Entrypoints](https://wxt.dev/guide/essentials/entrypoints)
- [WXT Manifest generation](https://wxt.dev/guide/essentials/config/manifest)
- [WXT browser targets](https://wxt.dev/guide/essentials/target-different-browsers)
- [WXT upgrade and peer requirements](https://wxt.dev/guide/resources/upgrading)
- [WXT Vite config](https://wxt.dev/guide/essentials/config/vite)
- [WXT Frontend Frameworks](https://wxt.dev/guide/essentials/frontend-frameworks)
- [Vitest 5 compatibility](https://vitest.dev/guide/migration/)
- [Preact Vite preset and peer versions](https://github.com/preactjs/preset-vite/blob/main/package.json)
- [WXT 0.21.4 package](https://www.npmjs.com/package/wxt/v/0.21.4), [Vite 8.3.0](https://www.npmjs.com/package/vite/v/8.3.0), [TypeScript 6.0.3](https://www.npmjs.com/package/typescript/v/6.0.3)
- [Preact 10.29.8](https://www.npmjs.com/package/preact/v/10.29.8), [Vitest 5.0.1](https://www.npmjs.com/package/vitest/v/5.0.1)
- [Microsoft Edge documented Bing and Google search URL syntax](https://learn.microsoft.com/zh-cn/deployedge/microsoft-edge-policies/defaultsearchprovidersearchurl)
- [GitHub repository search behavior](https://docs.github.com/en/search-github/searching-on-github/searching-for-repositories)
- [GitHub repository search route example](https://github.com/search?q=react&type=repositories)
- [Luogu problem list route with keyword parameter](https://www.luogu.com.cn/problem/list?keyword=astertab&page=1)

## 实现状态补记（2026-11-04）

> 本节是对历史计划的现状补记，不修改上文任何任务原文，也不构成新的实现授权。

- **5 个 Task 均已实现并验收。** 第一切片的生产构建、权限与浏览器验收记录见 [`docs/testing/command-center-first-slice-acceptance.md`](../../testing/command-center-first-slice-acceptance.md)；后续学习诊断本地上下文增量的验收记录见 [`docs/testing/diagnostic-local-context-acceptance.md`](../../testing/diagnostic-local-context-acceptance.md)。当前 `npm test` 为 9 files / 65 tests passed。
- **第一切片与诊断增量均已合入 main。** main 历史中已合并 PR #1、#2、#3、#4；其中 PR #4 为 `vitest.config.ts` → `vitest.config.mts` 的 `git mv` 重命名（R100，内容 0 变化）。本补记不展开或推断各 PR 的其他内容。
- **本计划仍是历史产物。** 它记录撰写当时的任务顺序、命令、版本与验收方式，仅供追溯；头部 `状态：待最终审核；不构成实现授权。` 保持不变，不授权重新实现、不重跑 Task，也不改动产品方向或代码。
- **唯一陈旧引用的说明（原文逐字保留）。** 文中 L60 表格、L211 `Create: vitest.config.ts`、L241 任务项、L306 `git add vitest.config.ts ...` 四处仍写旧名；这些是历史原文，不做逐处替换。文中所有 `vitest.config.ts` 指同一文件、现名 `vitest.config.mts`，重命名 R100 零内容变化，消除了 Vite 的 ESM-as-CJS 警告；当前 `npm test` 输出不再含 `(!) ... ESM syntax in a file loaded as CommonJS` 警告。
