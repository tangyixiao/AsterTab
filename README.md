# AsterTab

> **Don't replace your tools. Connect them.**

AsterTab 是一个以命令为中心的浏览器新标签页工作区（Chrome / Edge Manifest V3 扩展），面向学生、OIer、开发者与重度 AI 用户。它用一个低摩擦入口把搜索、GitHub、OJ、AI 等**已有工具连接起来**，而不是重做它们。

核心是 **Command Center**：先做确定性的解析与跳转，AI 只在确实需要语义理解时介入。AsterTab **不是 super-app**——不做「AI everywhere」、插件市场，也不自建笔记 / Todo / Git 客户端 / 日历 / IDE / OJ / AI 平台。产品原则、边界与优先级见 [PROJECT.md](PROJECT.md) 和 [AGENTS.md](AGENTS.md)。

## 当前状态（V1）

- **确定性 Command Center 第一切片**：普通文本与 `g` / `gh` / `lg` / `cf` 命令经纯 TypeScript 解析、构造固定 HTTPS URL 后直接跳转，不经过 LLM。`= <表达式>`（别名 `calc`）在本地计算数学表达式（手写解析器，不用 `eval`、不联网），`help` / `?` 显示内联命令参考。首屏只加载打包的 HTML / JS / CSS，无外部请求，离线可用。
- **学习诊断工作流**：显式 `ai <request>` 打开一个本地、逐项可勾选的诊断草稿，汇集洛谷题面、手动粘贴的提交记录、GitHub 公开文件（限 40-hex commit SHA 的 URL），拼出精确预览后由 OpenRouter 做**单次**诊断。读取 / 发送前会按需申请对应 host 权限。
- **Agent 仅显式 `ai` 触发**：普通搜索、跳转、命令执行都不走 AI；首屏与草稿打开时不联网、不发送。
- **默认不给完整题解**：先判断卡在题意理解、建模、算法、复杂度、实现、调试还是提交反馈的哪一步，再按需给出反问、最小提示或方向；完整题解仅在用户明确要求时出现。
- 当前实现不预建多 Provider runtime、不含 background service worker / content script，也不做自动重试或模型切换。

## 命令语法

在输入框中提交；命令为首个 token（大小写不敏感），空参数只给本地提示、不跳转。目标 URL 来自 [src/core/commands/parse-command.ts](src/core/commands/parse-command.ts) 与 [src/core/search/build-search-url.ts](src/core/search/build-search-url.ts)。

| 输入 | 行为 | 目标 URL |
| --- | --- | --- |
| 普通文本，如 `hello world` | Bing 网页搜索 | `https://www.bing.com/search?q=<query>` |
| `g <query>` | Google 网页搜索 | `https://www.google.com/search?q=<query>` |
| `gh <query>` | GitHub 仓库搜索 | `https://github.com/search?q=<query>&type=repositories` |
| `lg <query>` | 洛谷题目搜索 | `https://www.luogu.com.cn/problem/list?keyword=<query>&page=1` |
| `cf <题号或用户名>` | Codeforces 题目页（如 `cf 1234A`、`cf 1234/A`）或用户主页（如 `cf tourist`） | `https://codeforces.com/problemset/problem/<contest>/<index>` 或 `https://codeforces.com/profile/<handle>` |
| `= <表达式>` | 本地计算数学表达式（如 `= 2^10`），结果显示在状态行，不跳转 | 无（本地求值） |
| `help` 或 `?` | 显示内联命令参考 | 无（本地渲染） |
| `ai <request>` | 打开学习诊断草稿（**不联网首屏**，不发送） | 无（本地草稿与预览） |

`ai` 草稿中的资料读取、勾选与请求体预览都在本地完成；只有用户确认发送时才向 OpenRouter 发起一次请求。

## 开发

验收记录使用的环境为 Node `v26.9.0` / npm `11.19.0`（见 [command-center-first-slice-acceptance.md](docs/testing/command-center-first-slice-acceptance.md)）；以下命令在该环境验证通过，**不将其写成硬性版本门槛**。技术栈：WXT 0.21.4、TypeScript 6.0.3、Preact 10.29.8、Vitest 5.0.1、Vite 8.3.0。

```bash
npm ci                 # 安装依赖（postinstall 执行 wxt prepare）
npm test               # vitest run
npm run typecheck      # tsc --noEmit
npm run build          # 产出 .output/chrome-mv3
npm run build:edge     # 产出 .output/edge-mv3
```

## 本地加载扩展

`npm run build` / `npm run build:edge` 之后：

- Chrome：打开 `chrome://extensions`，启用开发者模式，用 **Load unpacked** 选择 `.output/chrome-mv3`。
- Edge：打开 `edge://extensions`，用 **Load unpacked** 选择 `.output/edge-mv3`。

加载后新标签页即被 `newtab.html` 接管。生产 manifest 为 MV3，版本 `1.0.0`，仅通过 `chrome_url_overrides.newtab` 覆盖新标签页。

## 权限与隐私

- Manifest 的必需权限**仅 `storage`**；Luogu（`https://www.luogu.com.cn/*`）、GitHub API（`https://api.github.com/*`）、OpenRouter（`https://openrouter.ai/*`）都是 `optional_host_permissions`，只在用户点击「读取」或「发送」时按需请求，可撤销（见 [wxt.config.ts](wxt.config.ts)）。
- OpenRouter API key **只存 `browser.storage.session`**（会话级，不落持久化存储）；模型 ID 存本地 storage；仓库与构建产物不含任何真实 key。
- **每次外发需显式勾选确认**：发送前展示精确的序列化 JSON 请求体、所选资料、固定 endpoint，以及 OpenRouter 会转发给所选模型提供商的提示；改动请求、所选资料或模型会使确认失效，需重新勾选并点击发送。
- 请求有上下文 / 响应大小上限与 60 秒超时；不自动重试、不自动换模型；错误不暴露原始响应体。首屏、草稿打开与关闭均不保存隐私上下文、不发网络请求。

## 文档索引

产品与协作约定：

- [PROJECT.md](PROJECT.md) — 产品 brief、V1 策略、反 super-app 约束
- [AGENTS.md](AGENTS.md) — 仓库内 agent / 贡献者约定

决策记录：

- [ADR-0001：扩展平台与 UI 技术栈](docs/decisions/ADR-0001-wxt-preact-extension-stack.md)
- [ADR-0002：学习诊断首个 AI Provider 采用 OpenRouter](docs/decisions/ADR-0002-openrouter-diagnostic-integration.md)

设计与实施计划：

- [命令架构设计 Spec](docs/superpowers/specs/2026-09-23-astertab-command-architecture-design.md)
- [学习诊断 Agent 工作流设计 Spec](docs/superpowers/specs/2026-09-25-astertab-learning-diagnostic-workflow-design.md)
- [Command Center First Slice Implementation Plan](docs/superpowers/plans/2026-09-23-astertab-command-foundation.md)
- [Diagnostic Local Context Implementation Plan](docs/superpowers/plans/2026-09-27-astertab-diagnostic-local-context.md)

验收记录：

- [Command Center first slice — production acceptance](docs/testing/command-center-first-slice-acceptance.md)
- [Learning diagnostic source selection and preview — acceptance](docs/testing/diagnostic-local-context-acceptance.md)

## 许可证

Apache-2.0，见 [LICENSE](LICENSE)。
