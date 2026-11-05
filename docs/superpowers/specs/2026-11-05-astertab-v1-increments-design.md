# 设计：V1 三项增量（2026-11-05）

> **状态：设计草案，待用户审核；不构成实现授权。**
> 依据：用户 m00670「1 你自己给我临时邮箱免费申请一个key 2. 允许 3. 允许」+ m00742/m00744「用这个个啊」（改用已登录 OpenRouter 账号）+ m00790 四项架构取舍确认（全部按推荐）。
> 本文件是 planning artifact，按 `brainstorming` 设计门与 AGENTS.md §29 在写任何实现代码前提交审阅。批准后才转入 implementation plan。

## 0. 背景与硬约束

上一轮已把 PR #1–#12 全部合并进 `main`（`f758b85`），四门禁全绿（9 files / 65 tests、typecheck 0、build 0、build:edge 0）。结案时如实列出 3 个未做项，本设计覆盖它们：

1. **真实 key 的成功 live 推理未验** —— 现有 `tests/browser/diagnostic-openrouter.mjs` 只验证「无效 key → HTTP 401」失败路径。
2. **GitHub 私有仓库接入** —— `src/core/diagnostic/public-sources.ts:69-75` 的 `fetchSelected` 固定 `credentials: "omit"` 且不带 Authorization 头。
3. **多轮诊断交互** —— `src/integrations/ai/openrouter.ts` 的 `OpenRouterRequestBody.messages` 是固定 `[system, user]` 二元组，ADR-0002 §20 把「对话历史」列为受限能力。

全局约束（来自 PROJECT.md / AGENTS.md / ADR-0002）：确定性优先、最小权限、本地优先、不做 super-app、不重建 GitHub、Agent 不是永久聊天窗、避免 chat-first UI、每次外发须新鲜确认、四门禁必须通过、commit discipline。

**已否决的路径（探测结论）**：让 AI 用临时邮箱注册新 OpenRouter 账号不可行 —— ToS §4.1 要求购 Credits、§2 注册须满 18 岁并点 "I ACCEPT" 接受含强制仲裁的法律合同、§3.1 须准确邮箱；本机无临时邮箱收验证码工具；隔离浏览器 sign-up 被 Google OAuth 以「此浏览器或应用可能不安全」拒绝。**绝不代签合同 / 虚构身份 / 编造 key / 把 401 冒充 200。**

## 1. 增量①：用已登录账号做「成功 live 推理」验收

**性质**：操作 + 测试资产增量，不改产品运行时逻辑。

- 用户已授权使用其**自己已登录**的 OpenRouter 账号（窗口 `Activity | OpenRouter - Google Chrome`，账号 `Total spend $0.00 / Requests 0`）。该账号由用户本人创建并接受条款，绕开上述身份/合同问题。
- **创建 key**：走 `wincu` 桌面 UIA/OCR 回退路径（该窗口 `browserLane.browsers` 为空，无 CDP 后台通道），点击左栏 `API keys` → 创建 → 复制。key 是外部服务写操作，用户已明确说「用这个」授权。
- **key 生命周期**：只注入本地临时验证脚本 / 环境变量，**不写仓库、不提交、不入任何日志、不写 `storage.local`**。验证结束可从 OpenRouter 侧撤销。
- **零成本模型**：选 `:free` 变体（如 `google/gemma-4-31b-it:free` 或 `liquid/lfm-2.5-2.6b:free`，prompt 价 0）。官方 limits 文档称累计购买 <$10 的账号有 50 次/日 `:free` 额度，但与 ToS §4.1 有张力 —— **必须实测真实 HTTP 200（含非空 `choices[0].message.content`）才算数，不靠假设**。
- **测试资产**：在 `tests/browser/diagnostic-openrouter.mjs` 增加「期望 200」路径（与既有「期望 401」路径并列、由显式 flag 区分，默认仍跑无 key 的 401 路径），或独立探针脚本。断言点：HTTP 200、响应不是 error envelope、`finish_reason !== "error"`、诊断文本非空且被 UI 展示。
- **失败分支（用户已确认 A）**：若 `$0` 账号的 `:free` 模型仍返回 HTTP 402（或任何非 200），**立即停下如实报告**「成功 live 未验证」，由用户决定充值 / 领积分 / 另给 key；不产生任何真实费用、不购买 $5 Credits。
- 不做：不把 key 写进 fixture、不让 CI 依赖真实账号、不改产品默认模型。

## 2. 增量②：GitHub 私有仓库（细粒度 PAT）

**用户取舍 A：细粒度 PAT**（否决 GitHub App + PKCE 的注册/安装/刷新复杂度，否决「手动粘贴文件内容」的非接入方案）。

- **鉴权方式**：用户创建只读、仅授权指定仓库的 fine-grained PAT，填进诊断 UI；存 `browser.storage.session`（与 OpenRouter key 同生命周期，浏览器关闭即失效），**仅对 `https://api.github.com/*` 请求加 `Authorization: Bearer` 头**。
- **最小权限落点**：修改 `src/core/diagnostic/public-sources.ts` 的 `fetchSelected`，使其接受可选 header 参数；`readGitHubFile` 在用户提供 PAT 时附带该头，否则保持现状（`credentials: "omit"`、无 Authorization）。**绝不**把 token 拼进 URL、写进预览 JSON、写进 AI 请求体、写进日志、或发给 `www.luogu.com.cn` / `openrouter.ai`。
- **URL 边界不变**：仍只接受 `github.com` 的 `blob/<40-hex SHA>/<path>` 永久链接。私有仓库同样用 SHA 永久链接，避免引入「解析分支名 / 目录遍历」这类新基建（YAGNI）。
- **权限提示**：现有 `optional_host_permissions` 已含 `https://api.github.com/*`，不新增 host；UI 用一句话说明「仅本次会话、仅所选仓库、可随时在 GitHub 撤销」，不新增权限弹窗。
- **错误隔离**：403/404 仍走既有中文错误映射，私有读取失败不影响洛谷来源、预览、Command Center 与本地命令。
- 不做：不建 GitHub App、不做 OAuth/PKCE、不读用户全部仓库列表、不做 token 刷新、不持久化 token。

## 3. 增量③：多轮诊断（无状态全量重发）

**用户取舍 A：无状态全量重发**（否决 `storage.local` 持久化对话）。

- **请求形态**：`OpenRouterRequestBody.messages` 从固定二元组改为「1 条 system + N 条对话消息」。每轮发送 = system prompt + 全部历史消息 + 本轮追问，**预览完整序列化正文后才可勾选确认**（保持 ADR-0002 §18「预览与发送共用序列化正文」）。
- **确认纪律**：每轮都是一次新的外发，须重新勾选确认；编辑任一来源或历史消息都使旧确认失效（复用现有 `invalidateConfirmation` / `isCurrentConfirmedRequest` 机制，不重写）。
- **历史生命周期**：对话历史只存活在当前 `DiagnosticDraft` 组件内存，不落 `storage.local` / `storage.sync` / 日志；关闭草稿即清空。
- **50,000 字符上限对整体序列化正文生效**：累计超限要**明示错误、不静默截断、不发送**，由用户删减来源或开新草稿。
- **UX 克制**：在既有诊断结果区下方追加一个极简「继续追问」输入框 + 发送按钮 + 可折叠的历史摘要；不做常驻聊天窗、不做自动滚动、不做后台轮询。符合 AGENTS.md §8/§20。
- 不做：不解析响应为动作、不执行 HTML、不自动重试、不给模型配 tools、不加第二个 Provider。

## 4. ADR-0002 决策变更记录

**用户取舍 A：追加日期补记**（与 PROJECT.md §29 / AGENTS.md §2 现有同步惯例一致；不新写 ADR-0003、不改写历史决策）。

- 在 `docs/decisions/ADR-0002-openrouter-diagnostic-integration.md` 末尾追加「## 补记（2026-11-05）」：说明 §20「无对话历史」这一受限能力在本增量中解除，改为「无状态全量重发的对话历史，仅内存、每轮重新确认、整体受 50,000 字符上限约束」；其余 8 条决策（固定端点、session key、按需权限、预览共用正文、每次显式同意、上限、无 registry）**全部保持有效、逐字不改**。
- 头部「适用范围」补一行指向补记，不改写原行。

## 5. 范围分层

- **required now**：① 成功 live 200 验收（含失败时停下报告）、② 细粒度 PAT 私有读取、③ 无状态多轮重发、④ ADR-0002 补记、⑤ 对应单测 + 四门禁 + 文档同步。
- **nice later**（本次不做）：GitHub App / PKCE、跨会话对话恢复、第二个 AI Provider / registry、真实 key 的 CI 集成。
- **out of scope**：购买 Credits、注册新账号、GitHub 写操作、把私有上下文发给非 GitHub/非 OpenRouter 的第三方。

## 6. 验收门禁（每项增量合并前都跑）

1. `npm test`（新增/更新单测，65+ 全过）、`npm run typecheck`、`npm run build`、`npm run build:edge` 全 0。
2. 生产 Manifest 仍是 `permissions: ["storage"]` + 3 个既有 optional hosts，不新增 required 权限。
3. secret scan：仓库/日志/预览正文无真实 key、无 PAT。
4. 增量① 若未拿到 HTTP 200，如实标注「未验证」，不得写成通过。
5. 每个增量单独分支 → 单独 PR → 单独合并（沿用上一轮 `docs/...` 分支 + dsh badge 惯例），不混提交。

## 7. 已确认的关键架构取舍（m00790）

| # | 问题 | 决定 |
|---|------|------|
| 1 | GitHub 私有鉴权 | A 细粒度 PAT（session-only，仅 api.github.com Bearer） |
| 2 | 多轮形态 | A 无状态全量重发（仅内存，每轮新鲜确认，整体 50k 上限） |
| 3 | ADR-0002 变更 | A 追加日期补记，原决策逐字保留 |
| 4 | $0 余额 402 | A 停下如实报告，不充值、不产生费用 |

## 8. 待用户确认

- 本设计整体是否批准？批准后我按 §5 分层从 `main`（`f758b85`）建干净基底，先做①（拿 200）、再②③，各自四门禁 + PR 合并。
- 增量① 创建/撤销 API key 是在你自己的 OpenRouter 账号上的外部写操作，是否需要我在动手前再单独说一声？

> 2026-11-05: design drafted against implemented baseline f758b85; no implementation code written yet.
