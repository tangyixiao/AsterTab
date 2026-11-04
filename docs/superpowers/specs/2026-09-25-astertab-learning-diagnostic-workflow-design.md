# AsterTab 学习诊断 Agent 工作流设计 Spec

> **状态：Implemented / 待产品复核（Baseline 定稿）。定稿 2026-11-04，依据已落地实现与验收记录。** 本文定义一个受控、只读的 OJ + GitHub 学习诊断流程。本次定稿只把截至 2026-11-04 已落地的实现与验收记录对齐到 Spec，如实标注已实现范围与仍未实现／未验证的部分；用户尚未逐条审核，故标注「待产品复核」，不代表产品逐条批准，也不新增功能设计或扩大范围。审核本文不代表批准后续 implementation plan 或授权开始实现。

- 日期：2026-09-25（初稿）
- 定稿：2026-11-04（依据已落地实现与验收记录；见 §11「实现与验收现状」）
- 范围：用户主动发起的“结合洛谷题目、近期提交和 GitHub 代码，判断学习卡点”单一工作流
- 产品依据：[`PROJECT.md`](../../../PROJECT.md)、[`AGENTS.md`](../../../AGENTS.md)
- 架构边界：[`2026-09-23-astertab-command-architecture-design.md`](2026-09-23-astertab-command-architecture-design.md)
- 前置工程切片：[`2026-09-23-astertab-command-foundation.md`](../plans/2026-09-23-astertab-command-foundation.md)

## 1. 目标与设计原则

目标是验证 AsterTab 能否把用户正在解决的 OJ 问题、用户选定的提交证据和用户指定的 GitHub 代码组织成一份有边界、可审阅的任务上下文，并帮助用户判断当前卡点。它扩展 Command Center 的价值，但不把 AsterTab 变成 OJ 客户端、GitHub 客户端或通用聊天产品。

1. **显式开始。** 只有用户发起 `ai <request>` 并继续选择资料后，才进入该工作流；普通输入仍是搜索。
2. **用户选什么，才读什么。** 不自动检查活动标签页、浏览器历史、书签或 Luogu 账户历史。
3. **读取与外发分开授权。** 服务访问权限、用户选择某个来源、以及将其内容发送给 AI，是三个不同决定。
4. **AI 诊断，确定性代码控边界。** 模型不能选取新数据源、扩展上下文、构造任意 URL 或执行工具。
5. **默认只读、默认少提示。** 不提交代码、不改仓库；默认诊断并给最小提示，不默认给完整题解。
6. **首屏和部分故障仍可用。** 网络、授权或 AI 失败不应影响确定性搜索和新标签页基本功能。
7. **先实现这一条路径。** 不提前创建通用 Agent runtime、tool registry、插件运行时或泛化的 OJ/GitHub 数据平台。

## 2. 范围

### 包含

- 在新标签页通过显式 `ai <request>` 开始一次学习诊断任务。
- 用户逐项提供洛谷题目、选定提交和 GitHub 文件/代码。
- 对本次将发送给 AI 的完整上下文进行预览、删减和确认。
- 诊断用户更可能卡在的学习阶段，给出证据、缺口和下一步最小帮助。
- 对单项来源错误、权限不足和 AI 不可用提供隔离、可恢复的反馈。

### 不包含

- 自动读取活动标签页、全站浏览内容、历史、标签、书签或剪贴板。
- 自动爬取 Luogu 用户的提交历史，或依赖未经确认的非官方提交历史 API。
- OJ 登录、代替用户提交、GitHub 写操作、代码执行或自动修改用户代码。
- AI 自主浏览 URL、调用任意工具、扩展权限或追加上下文。
- 长期用户画像、默认保存的上下文/对话、云端同步或后台常驻 Agent。
- 多 AI Provider 运行时、通用 Adapter/Executor/Registry 或插件系统。

## 3. 用户流程

```text
新标签页输入 ai <request>
        ↓
用户逐项添加题目、提交和 GitHub 代码
        ↓
确定性代码校验来源并读取已选资料
        ↓
展示完整上下文与目标 AI Provider
        ↓ 用户删减并明确确认
AI 诊断
        ↓
展示卡点判断、证据、缺口和最小下一步
        ↓
若继续补充资料，重新预览并再次确认
```

1. **显式触发。** Command Engine 将 `ai <request>` 分类为 Agent 请求；识别命令本身不产生网络请求。没有请求文本时沿用已批准的缺参错误行为。
2. **添加来源。** 用户在本次任务中逐项添加资料；输入 URL 不授权读取活动标签页或其他 URL。
3. **按来源边界取数。** 只读取用户选中的具体来源，展示来源标识、读取状态和获取到的内容。扩展需要的 host 权限应按来源在使用时申请，不申请 `<all_urls>`。
4. **上下文审阅。** 展示将发送的用户请求、题目/提交/代码片段、必要来源标识和目标 Provider。用户可移除任意来源或字段。
5. **单次外发确认。** 用户点击明确的发送操作后，才将预览中的内容发送到所显示的 Provider。取消、关闭或未确认都不得发送。修改上下文后必须重新确认。
6. **诊断。** 模型给出有来源依据的阶段判断、证据、尚缺的信息和下一步最小帮助。结果不触发后续读取或外部副作用。
7. **继续交互（产品方向；后续增量，未纳入本次实现）。** 产品方向上，用户可以追加来源、回答追问或要求更深一层提示；任何新增上下文都重新审阅、重新确认。**当前实现边界：** `DiagnosticDraft` 仅支持单次发送，无多轮对话、无追问历史；编辑上下文会使旧结果失效，需重新审阅并重新确认后再发送。本节描述的是后续增量，未纳入本次已落地实现，详见 §11。

## 4. 来源、读取和授权

| 来源 | V1 提供方式 | 读取边界与回退 |
| --- | --- | --- |
| 洛谷题目 | 用户粘贴题目 URL 或题面文本。只有用户明确点击“读取此题面”时，才可读取该条 `https://www.luogu.com.cn/problem/...` 公共题目页；只处理该精确来源，不检查活动标签页。 | 仅允许固定 HTTPS 主机和题目页路径；读取/解析失败时让用户粘贴题面。不遍历其他页面。 |
| 近期提交 | 用户手动选定并粘贴单条或少量提交记录，包括可选链接、代码、Verdict/反馈及用户认为相关的说明。 | V1 不读取账户级提交历史，不静默抓取，不依赖本轮未确认的非官方 API。若后续发现正式、适用的只读接口，先修订 Spec 再改变数据路径。 |
| GitHub 公开代码 | 用户指定公开仓库/文件 URL；通过 GitHub 固定 HTTPS API 读取其明确选中的文件。 | 只取所选仓库和文件；验证服务、owner/repo、路径和响应大小。不可从模型输出或文件内容派生新 URL。失败时可粘贴片段或移除来源。 |
| GitHub 私有代码 | 可选能力。用户明确连接 GitHub 并选择可访问的仓库/文件；仅在 GitHub App 授权、安全存储和撤销流程通过实现前安全审核后启用。 | 只申请读取 `Contents` 所需权限，不申请写权限，不使用宽泛的经典 OAuth `repo` scope。扩展是公开客户端，client secret 不得视作秘密；授权流使用 `state` 和 PKCE。令牌不得进入 AI payload、遥测或同步。若回调/令牌处理无法通过审核，私有 API 读取保持关闭，用户仍可粘贴代码；不因此自行增加后端服务。 |

GitHub App 用户访问受 App 与用户双方许可限制；实际集成还必须验证仓库安装范围能否收敛到用户选择的仓库。私有仓库令牌的生命周期、扩展本地存储和撤销行为是 implementation plan 的安全验收项，不得在实现中默认为长期明文持久化。

用户提供的所有来源引用都必须经过确定性校验：只接受预期的 HTTPS 服务和资源类型；不把 `javascript:`、`data:`、任意 scheme、任意 hostname 或模型返回的 URL 解释为导航或取数指令。浏览器 host permission 不等同于用户对该任务的读取许可，更不等同于 AI 外发许可。

## 5. AI 上下文与隐私

- 上下文按单次任务即时组装，仅包含用户所选来源中预览可见的字段/片段和本次请求。
- 审阅界面明确显示目标 Provider、模型 ID、完整请求正文和实际发送的文本/代码内容；不能用“将发送相关上下文”之类笼统描述替代内容预览。
- 只有用户确认后才发出该次请求。Provider 未配置时不得尝试其他 Provider。
- Provider key 与模型配置分开保存：OpenRouter key 仅在用户明确保存后放入当前浏览器会话内存；模型 ID 是本机偏好，不同步。key 不进入请求正文、日志、遥测或上下文。
- 原始题面、提交、代码、请求和响应默认不进入长期历史、遥测、同步或用户画像。任务结束后不保存其原始上下文；保存/导出能力不在本 Spec 范围内。
- Provider 可能按自身政策处理或保留收到的数据；发送前需显示实际 Provider、所选模型和清楚的数据外发提示。若 Provider 会把输入转交给模型服务商，还需明确提示服务商政策可能不同。
- Provider 认证凭据与 GitHub 访问令牌彼此分离，均不得进入模型上下文、诊断日志或分析事件。

## 6. 诊断行为

判断阶段沿用学习链路：

```text
题意理解 → 建模 → 算法选择 → 复杂度 → 实现 → 调试 → 提交反馈
```

每次诊断应尽量包含：

- **可能的卡点阶段**，用“较像/目前证据指向”等措辞表达推断，不伪装成确定事实；
- **来源依据**，关联到用户选择的题面、提交反馈或代码片段；
- **缺失或矛盾信息**，说明哪些证据不足以作出判断；
- **一个最小下一步**，优先给出启发式反问、最小提示或相关概念解释。

默认不直接给完整解法。只有用户明确要求时才进入完整解法；更深帮助仍受用户当前请求约束。若现有上下文不足，先指出不足并追问或让用户补充，不编造提交状态、运行结果或代码内容。

AI 输出是诊断和建议，不具有读取、联网、执行、提交或写入权限。所有来源读取由确定性代码对用户选中的来源执行；模型不能要求扩大授权。

## 7. 失败处理

| 失败 | 系统行为 |
| --- | --- |
| 单个来源无法读取、格式变化或无权限 | 将错误限定到该来源；说明失败原因和影响；提供粘贴、移除或在用户修正后重试。其他已选来源保持可用。 |
| GitHub 私有授权取消、过期或未通过安全门槛 | 不读取私有内容；不扩大 scope；提供粘贴代码片段或移除来源。 |
| 证据缺失/互相冲突 | 在诊断中标记不确定性；询问用户补充或确认，不替用户挑选未授权来源。 |
| AI Provider 未配置、超时或拒绝请求 | 保留当前页面中的用户输入供其决定重试或放弃；不静默切换 Provider、不后台重试、不把未发送上下文持久化。 |
| 用户取消外发确认 | 不产生 AI 请求；结束或返回上下文编辑状态。 |

## 8. 架构边界

- Preact UI 负责输入、来源选择、状态、预览、确认和结果呈现；不包含服务 URL、认证流程、权限策略或 Agent 决策。
- Command Engine 仍负责显式命令分类；普通搜索路径不改变。
- OpenRouter 固定端点、请求构造和响应解析位于 `src/integrations/ai/openrouter.ts`；API key 的会话生命周期及模型本机设置见 [ADR-0002](../../decisions/ADR-0002-openrouter-diagnostic-integration.md)。在有第二个真实 Provider 之前不预建通用 Provider registry。
- 来源读取只通过面向本用例的窄函数/适配器完成。首版最多实现具体的洛谷题面读取、选定提交的用户输入、GitHub 选定文件读取；不为尚不存在的第二种能力预建通用 registry、Executor、plugin runtime 或大而全 Adapter interface。
- Context 只表示本任务经过选择和裁剪后的资料；默认不沉淀为跨任务画像。
- AI 请求只能携带已预览且已确认的 payload。模型返回普通诊断结果或受限诊断字段，不接收可执行代码、任意函数名或工具调用授权。
- 本工作流不需要常驻 Agent、自动监听浏览器状态或为读取活动标签页增加 content script。若未来确有页面内“选中后发送”需求，需单独评估并修订权限与 UX 设计。

## 9. 验收要求

后续 implementation plan 必须把下列项落实为具体测试或浏览器验收，而不是只留作原则：

1. 普通文本及 `g`、`gh`、`lg` 确定性搜索永不触发 AI 请求；显式 `ai` 的解析本身也不发网络请求。
2. 未点击确认、取消确认或预览后修改内容，均不得发送旧 payload；发送 payload 与最后确认的预览一致。
3. 来源读取仅针对用户明确选择的固定 HTTPS host/resource；拒绝任意 scheme、hostname、重定向越界和模型生成 URL。
4. 不读取活动标签页、历史、书签或 Luogu 账户提交历史；没有未经确认的 Luogu API 调用。
5. GitHub 公共读取仅限所选仓库/文件；私有读取需仓库选择、只读 `Contents` 权限、PKCE/`state` 和令牌安全审核；任一门槛失败则关闭私有 API 路径并保留粘贴回退。
6. 移除来源后，其内容不出现在 AI payload；AI payload/遥测/同步中不出现 GitHub 或 Provider 凭据。
7. 单来源失败不阻断其他来源；AI 故障不自动更换 Provider、后台重试或扩大读取范围。
8. 默认诊断覆盖学习阶段、引用证据、说明不确定性并给最小下一步；完整解法需要明确请求。
9. 首屏在离线、AI 未配置或服务不可用时仍能使用确定性 Command Center。
10. 生产包除存储 API 所需的 `storage` permission 外，不声明所选主机为 required host permission；`https://openrouter.ai/*` 与已批准来源保持 optional。不得包含 background worker 或 content script。

## 10. 待核验项（2026-11-04 核对）

以下是本节初稿列出、需在写 implementation plan 前明确决定/证据的事项。现依据已落地实现与验收记录逐项核对，如实标注「已解决／已实现／仍未实现／已验收」及边界，不夸大：

1. **OpenRouter key 已解决（决策层面），但真实 key 的成功 live 推理仍未验证。** 用户于 2026-09-29 选择 OpenRouter API key；固定 endpoint、会话内存 key、本机模型 ID、按需 host 权限和服务商数据政策提示见 [ADR-0002](../../decisions/ADR-0002-openrouter-diagnostic-integration.md)。实现与 unit/浏览器回归测试已落地（见 §11）。但截至 2026-11-04，harness 用的是哨兵 key（`sk-or-browser-test-only`），只验证到**真实端点** `https://openrouter.ai/api/v1/chat/completions` 返回 **HTTP 401**；没有真实 key，也没有成功的付费 API 推理。真实 key 的成功 live 推理仍待用户本机填写 key 后显式触发，详见 [验收记录](../../testing/diagnostic-local-context-acceptance.md)「Live host-permission prompt and real-endpoint verification」。
2. **GitHub 私有仓库访问仍未实现。** 当前仅实现 GitHub **公开**文件读取（固定 `https://api.github.com/*`、仅 40 位提交 SHA 永久链接）与粘贴代码回退；私有仓库读取所需的 GitHub App + PKCE + `state` + 令牌安全存储/刷新/撤销与安全审核均**未实现、未通过审核**。按 §4 与 §9 第 5 项，任一门槛未过前该路径保持关闭，用户仍可粘贴代码。此项保持为后续增量，不得视为本次已落地。
3. **洛谷单题读取已实现 + 粘贴回退。** `readLuoguProblem` 仅接受固定 `https://www.luogu.com.cn/problem/<id>` 公开题目页（无 credentials/query/fragment，抽取 `lentille-context`），读取/解析失败时回退到用户粘贴题面；近期提交路径不依赖个人提交历史 API，见 [实现 plan](../plans/2026-09-27-astertab-diagnostic-local-context.md) Task 2 与 [验收记录](../../testing/diagnostic-local-context-acceptance.md)。
4. **Chrome/Edge 按需 host 权限已验收。** 生产 Manifest 仅 `storage` 为 required；Luogu、GitHub API、OpenRouter 三处为 `optional_host_permissions`，无 required host permission、background worker 或 content script。Chrome 与 Edge 生产构建及 10 项浏览器 harness 检查通过；live 模式下真实原生 host-permission 弹窗由人工批准、`chrome.permissions.contains` 返回 true，且权限在 profile 中持久化。详见 [验收记录](../../testing/diagnostic-local-context-acceptance.md)。注意：live 验收用的是哨兵 key，只验证到权限与真实端点 401，不是成功推理。

如以上核验导致用户可见范围、权限或外发行为变化，必须先修订并重新审核本 Spec；不能由执行 Agent 临时选择。

## 11. 实现与验收现状（2026-11-04）

本节如实记录截至 2026-11-04 的已落地实现与验收证据，引用下列事实来源（相对路径）：

- 实现 plan：[`2026-09-27-astertab-diagnostic-local-context.md`](../plans/2026-09-27-astertab-diagnostic-local-context.md)（Task 1–4 全部完成）
- 验收记录：[`diagnostic-local-context-acceptance.md`](../../testing/diagnostic-local-context-acceptance.md)（多轮验收）
- 决策：[`ADR-0002-openrouter-diagnostic-integration.md`](../../decisions/ADR-0002-openrouter-diagnostic-integration.md)、[`ADR-0001-wxt-preact-extension-stack.md`](../../decisions/ADR-0001-wxt-preact-extension-stack.md)

**已落地范围（与 §1–§9 产品方向一致，不扩大范围）：**

- 实现 plan 的 4 个 Task 全部完成：纯上下文预览、固定公开来源读取（洛谷单题 + GitHub 公开文件）、本地草稿 UI、浏览器与 Manifest 验收。
- 测试与构建门禁（以最终一轮「OpenRouter response handling and browser regression follow-up」为准，见验收记录）：`npm test` **9 files / 65 tests 通过**；`npm run typecheck` 0 diagnostics；`npm run build` 与 `npm run build:edge` 双构建均 Exit 0。上述为验收记录中的历史观察；本工作区定稿时另跑只读 `npm test` / `npm run typecheck` 复核（不跑 build，避免写共享 `.wxt`）。
- **生产 Manifest 权限：** Chrome 与 Edge 生产包均仅 required `storage` API permission；**三处** `optional_host_permissions` —— `https://www.luogu.com.cn/*`、`https://api.github.com/*`、`https://openrouter.ai/*`；无 required `host_permissions`、无 background service worker、无 content script（符合 §9 第 10 项；「仅生产必需权限」的工程依据见 ADR-0001 决策第 10 条）。
- **OpenRouter 集成（ADR-0002）：** 固定 `POST https://openrouter.ai/api/v1/chat/completions`，Bearer key 仅在 `Authorization` header，不进 JSON 正文；预览与发送共用同一序列化正文；**单次发送**，需用户显式勾选确认 + 按钮点击才在该点击处理中申请 optional host 权限并外发；请求/上下文/模型变更会使旧确认与旧结果失效，需重新审阅、重新确认再发。
- **请求边界：** 上下文上限 50,000 字符、`max_tokens` 1,200、`stream: false`、响应正文上限 1,000,000 bytes；**60 秒超时中止，不自动重试、不切换模型、不切换 Provider**；错误不暴露服务端原始错误正文；响应作为普通文本显示，不解析为动作、不执行 HTML、不给模型配置 tools/function calling。
- **密钥与设置生命周期：** API key 仅存 `browser.storage.session`（会话内存，不落盘、不同步）；模型 ID 存 `storage.local` 本机偏好；key 不进入请求正文、日志、遥测或上下文；两者分离（符合 §5；凭据处理的项目安全约束见 `AGENTS.md` §26 Security）。Chrome 与 Edge 生产 UI 各 10 项浏览器检查通过；live 模式验证真实原生权限弹窗与真实端点返回 401。

**仍未实现 / 未验证（如实标注，不夸大）：**

- 真实 OpenRouter key 的**成功 live 推理**未验证：harness 用哨兵 key，只验证到真实端点返回 401（见 §10 第 1 项）。
- GitHub **私有**仓库读取未实现（见 §10 第 2 项）。
- §3 第 7 步「继续交互」的多轮对话 / 追问历史 / 追加来源后延续同一会话，属**后续增量，未纳入本次实现**（见 §3 第 7 步）。
- 生产 Chrome/Edge 构建与浏览器验收均为验收记录中的历史观察；本定稿未重跑 `build` / `build:edge`（会写共享 `.wxt`，由 lead 统一跑）。

## 12. 参考资料

- [GitHub REST API：Repository contents](https://docs.github.com/en/rest/repos/contents)
- [Choosing permissions for a GitHub App](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app)
- [Generating a user access token for a GitHub App](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)
- [Best practices for creating a GitHub App](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/best-practices-for-creating-a-github-app)
- [GitHub OAuth App scopes](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)
- [Luogu Open Platform documentation](https://docs.lgapi.cn/open)（本次核验未确认适用于个人近期提交历史的正式只读接口；本 Spec 不依赖该类接口。）

---

## 修订记录

- 2026-09-25：初稿（Draft），§1–§9 产品方向定稿讨论。
- 2026-11-04：Baseline 定稿 —— 状态改为「Implemented / 待产品复核」；按已落地实现与验收记录核对 §10 四项；补注 §3 第 7 步「继续交互」的当前单次发送边界（标为后续增量）；新增 §11「实现与验收现状（2026-11-04）」；原 §11「参考资料」顺延为 §12。§1–§9 产品方向、产品决策与范围未改动。
