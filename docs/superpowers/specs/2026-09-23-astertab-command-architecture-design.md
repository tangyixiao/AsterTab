# AsterTab 命令架构设计 Spec

> **状态：Approved（2026-09-24，用户审核通过）。** 本文定义产品核心模块的职责、数据流和约束；批准 Spec 不代表批准 implementation plan 或授权开始实现。

- 日期：2026-09-24（adversarial self-review 修订）
- 范围：Command Center 确定性核心及其通往未来 Agent 工作流的边界
- 产品依据：[`PROJECT.md`](../../../PROJECT.md)、[`AGENTS.md`](../../../AGENTS.md)
- 技术栈决策：已采纳的 [`ADR-0001`](../../decisions/ADR-0001-wxt-preact-extension-stack.md)
- 待审实施计划：[`2026-09-23-astertab-command-foundation.md`](../plans/2026-09-23-astertab-command-foundation.md)

## 1. 目标与设计原则

AsterTab 是连接既有服务的浏览器命令工作区。Command Center 是入口；搜索和简单动作先走确定性路径；Agent 只理解用户明确交给它的语义任务，并在授权范围内请求上下文、提出建议。外部服务、AI 和浏览器能力都不可成为新标签页首屏的前置条件。

本 Spec 采用以下边界原则：

1. **确定性默认。** 普通搜索和已知命令不经过 AI。
2. **Agent 显式触发。** 无法识别的文本本身不是调用 AI 的授权。
3. **理解与执行分离。** AI 只能返回受限的结构化意图或结果；浏览器/API 副作用由确定性代码执行。
4. **先授权、再读取或外发。** 访问上下文与把上下文发送给 AI 是两个可分别拒绝的决定。
5. **权限分层。** 浏览器授予的 API 能力不等于 AsterTab 对某一数据用途或外部写操作的产品授权。
6. **先有用例、再抽象。** 模块是逻辑职责，不自动对应 package、service、registry 或后台进程。
7. **V1 只证明一条真实路径。** 首个工程切片只做确定性 Command Center；未来 Agent 纵向流程另行设计。

本文中的 **Agent workflow** 指用户明确提出、需要语义理解或跨来源上下文的任务；**Agent Orchestrator** 是执行确定性校验和流程协调的产品逻辑；AI 模型只承担受限的意图解释或诊断。三者不等同，也不意味着模型拥有工具执行权。

## 2. 模块职责与边界

| 模块 | 负责 | 不负责 | 当前是否独立部署/拆包 |
| --- | --- | --- | --- |
| Command Engine | 规范化输入；将空输入、普通搜索、已知确定性命令、显式 Agent 请求和已知语法错误分类 | 调用 AI、访问浏览器 API、拼任意 URL、执行集成副作用 | 否。首版是纯 TypeScript 逻辑；目录和接口随真实用例形成 |
| Search 路由 | 把确定性搜索请求映射到固定服务及安全查询 URL；对查询做编码 | 抓取或索引互联网、重建搜索服务、隐式读取历史/标签页、解释任意自然语言 | 是一个职责，不要求成为独立 Search Engine package。首版可以是 Command Engine 下的一个 handler |
| Intent Interpreter | 仅在显式 Agent 请求无法由确定性 workflow 识别时，将请求解释为有限意图或提出澄清问题；不执行 | 任意挑选函数、访问服务、直接调用浏览器/API、扩大已授权范围 | 是 Agent workflow 内的可选解释步骤；不要求独立常驻模块或每次额外调用模型 |
| Agent Orchestrator | 接收已分类/已解释的意图；校验受支持 workflow；生成本次有界 Context Request；按授权组织读取、诊断和错误恢复 | 给模型任意工具权限、绕过 Permission Policy、把所有搜索都改成聊天 | 首版不创建 Agent runtime；实际 Agent 阶段再按一个端到端用例实现 |
| Context Engine | 执行已批准的 Context Request：通过具体 adapter 读取、裁剪并标注来源和时间；呈现待外发内容；按用户决定构造最小上下文 | 自行决定新增数据源、静默收集、保存所有上下文、默认上传完整历史、替各适配器抹平不兼容数据 | 当前只定义约束，不实现通用上下文平台 |
| Permission Policy | 根据功能授权、数据用途、风险等级、浏览器权限、服务认证和用户确认作准入判断 | 替代 Chrome/Edge 的权限系统，或把安装扩展当成所有集成的授权 | 先作为清晰的策略边界；只有实际出现多个调用点后再决定是否抽为独立模块 |
| Action Executor | 未来对有副作用的类型化 action 做最终校验并调用确定性 handler/adapter；返回结构化结果 | 执行模型生成的任意代码或未审核 URL；让模型跳过确认 | 第一切片不创建通用 Executor；固定搜索 URL 经校验后由新标签入口导航 |
| Integration Adapter | 对一个既有服务的一项明确能力封装请求、认证、服务数据映射与错误 | 重建 GitHub/OJ/AI；定义所有服务必须实现的大而全 CRUD 或统一上下文模型 | 有具体调用用例时再为该服务增加窄函数 |

**Command Engine 与 Search Engine 的结论：逻辑职责分开，物理结构暂不拆。** Command Engine 负责“用户输入表达什么”；Search handler 负责“确定性搜索去哪个固定目的地、如何编码”。首版没有本地索引、排序或跨来源检索服务，因此“Search Engine”不应被解释成需要预建的独立引擎。

## 3. 主调用链：确定性优先，Agent 受控

### 3.1 输入分类

```text
用户输入
   ↓
Command Engine 分类
   ├─ 普通文本 / 确定性命令 → Search 或本地 handler → 固定目的地校验 → 新标签入口执行
   ├─ 空 / 已知语法错误 ───→ UI 给出本地提示，不执行
   └─ 用户明确进入 Agent ──→ 确定性 workflow 匹配
                                ├─ 匹配成功 → 类型化任务意图
                                └─ 仍需语义理解 → 明示 AI provider；用户提交只授权发送本条任务文本
                                                     → Intent Interpreter → 类型化意图或澄清
                                                                          ↓
                                                       Agent Orchestrator 校验意图
                                                                          ↓
                                                  生成有界 Context Request（来源/字段/用途）
                                                                          ↓
                                      分别检查本地读取、外部读取和服务认证授权
                                                                          ↓
                                            Context Engine 通过只读 Adapter 读取并裁剪
                                                                          ↓
                                            用户审阅上下文、任务文本及 AI 目的地
                                                                          ↓
                                         用户提交授权该 payload 发往指定 AI provider
                                                                          ↓
                                          AI 生成诊断或建议（不执行副作用）
                                                                          ↓
                                                        展示结果 / 失败恢复
```

普通文本无条件走默认搜索；识别到的搜索前缀走对应搜索；只有显式 Agent 入口能进入语义路径。沿用 `PROJECT.md` 已列出的 `ai <request>` 作为命令式 Agent 入口；以后若提供模式按钮，也必须明确选中 Agent 并映射到同一个 Agent 请求，不形成第二套隐式路由。第一切片识别 `ai` 请求并本地提示 Agent 尚未接入，不发网络请求，也不把它降级成网页搜索。已知前缀缺少查询时显示本地语法提示。其他普通词句不会因解析置信度低、搜索失败或 provider 不可用而改走 Agent。

### 3.2 解释、规划与执行

- 语义解释的输出只能是有限意图、参数、候选数据范围或待澄清问题。输出按 schema 和产品支持列表校验；模型不能返回可执行 JavaScript、任意函数名或任意目标 URL。
- Intent Interpreter 的输出先交给 Orchestrator；Orchestrator 以确定性规则将意图映射到已实现的 workflow，并生成明确的 Context Request。遇到不支持、缺字段或低置信度意图时，向用户澄清；不猜测目标、不静默扩大数据范围。
- Intent Interpreter 是一项**可选的语义能力**，不是固定的第二个 AI 层。已明确的诊断 workflow 可跳过独立解释调用；只有需要语义归类时才请求解释。远程解释调用前必须明确显示目标 provider；提交 Agent 请求只授权把当前任务文本发给该 provider，不包含其他上下文。若解释结果与授权/能力不符，拒绝该计划。
- 若任务语义已明确，优先先收集获准上下文，再由一次明确展示 payload 的 AI 请求完成诊断，避免仅为分层而多发一次模型请求。任何 AI 请求都不得包含尚未过相应外发关口的数据。
- AI 的诊断文本是结果，不是 action。任何将来会改变个人数据或外部服务状态的操作，都要转成有类型、目标明确的 action proposal，再由策略层检查、界面预览/确认，最后由确定性执行代码重新校验并调用 adapter。第一切片没有写入 action，也不需要通用 Executor。

### 3.3 读取授权与写入确认是不同关口

“Permission / Confirmation”不能只放在 adapter 调用之后。读取私有数据前必须先过读取授权；外发给 AI 前必须展示并确认数据范围和目的地；外部写入必须在执行前预览与确认。建议区分：

1. **浏览器能力关口：** Chrome/Edge 是否授予所需 API 或具体 host access。缺失时仅在用户触发相应功能后说明并申请可选权限。
2. **本地上下文读取关口：** 对历史、标签页或用户配置等本地数据，检查 AsterTab 对该数据类别/用途的授权；若浏览器 API 另需权限，也必须同时具备。读本地数据不代表可外发。
3. **外部服务读取关口：** 检查用户是否启用该 integration、服务认证是否有效、所需 host/API 权限是否存在，以及这次读取是否在用户允许的范围内。打开一个公开服务网页不等于读取其账号数据。
4. **AI 外发关口：** 若需远程 Intent Interpretation，Agent 入口必须先显示 provider；用户提交明确的 Agent 请求只授权发送本条任务文本，不授权发送上下文。若随后要发送 Context，Context Engine 先展示任务文本、来源、数据类别和目的 provider，用户可移除不想包含的来源；确认后才发送。读取许可或 AI provider 已配置都不自动包含上下文外发许可。
5. **外部写入关口：** AI/用户提出写入意图后，展示具体服务、目标对象和拟变更内容；用户确认后，确定性执行代码再检查权限是否仍有效、确认是否对应同一 action，之后才调用写入能力。确认前不得调用写入 adapter。

搜索/导航属于 L0，通常可直接执行；L2 个人数据变更和 L3 外部服务写入按 `AGENTS.md` 的风险原则展示变更并确认。语义模型不改变 action 风险等级。

## 4. Context Engine：收集、裁剪、存储和外发

Context Engine 采用**按本次任务即时组装**，不维护一个默认持续扩大的“用户上下文”。它执行以下边界：

1. Orchestrator 说明本次 workflow 需要的来源、字段和用途；只引用该 workflow 已明确支持的读取操作，不自动发现或注册新工具。
2. Permission Policy 先检查该读取所需的产品授权、浏览器能力及服务认证。任何一项缺失都不得调用对应来源；后续按来源是必要输入还是可选补充决定暂停或部分继续。
3. Context Engine 仅在检查通过后调用具体 Adapter 读取完成任务需要的数据。每项数据附带来源、获取时间和读取范围等来源信息；各服务的业务字段保持各自类型。
4. Context Engine 删除不相关字段、限定记录数量/文本长度并保留出处。具体数量和 token 上限由未来实际的 Luogu/GitHub/AI workflow 测量后设定；本 Spec 不臆造数值，也不引入通用向量库或检索服务。
5. AI 请求前展示将外发的来源与目的地。默认不把完整浏览历史、其他标签页内容、未选仓库代码或凭证放入 payload。拒绝外发时仍可打开相应 OJ/GitHub 页面，或仅在本地显示已读来源。
6. 当前上下文和 AI payload 默认只存在于本次会话内存；不作为搜索索引、同步数据或长期日志。若未来某项恢复体验确实需要持久缓存，单独定义保留期、删除入口和外发策略。
7. 来源超时、缺授权或服务异常仅使该来源不可用。其他已获准来源仍可用，但结果要明确标出缺失来源，不把缺失解释为“没有相关数据”。

每个具体 workflow 必须声明哪些来源是**必要输入**、哪些是**可选补充**。必要来源缺失时暂停诊断并询问用户是否重试、补充或取消；只有可选来源缺失时才允许以清楚标注的部分上下文继续。首个 Agent workflow 再确定这份最小声明，不在这里定义通用 workflow 配置系统。

`Context Engine` 的核心价值是最小化、标注和控制**哪些数据以什么目的离开本机**；不是替所有 OJ/GitHub 数据定义一个虚构的通用 schema。

## 5. Permission Policy 与 Manifest V3 权限

### 5.1 两层授权模型

| 层 | 决定的问题 | 例子 |
| --- | --- | --- |
| AsterTab 产品授权 | 用户是否启用某项集成、允许为本次目的读取哪些数据、是否同意把哪些内容发送给哪个 AI、是否确认某次写操作 | “允许本次诊断读取这道题和最近提交”；“把以上三项发送给已配置的 AI” |
| 浏览器 MV3 权限 | 扩展进程是否被 Chrome/Edge 授予调用某个浏览器 API 或访问某些网站的能力 | `permissions`、`optional_permissions`、`host_permissions`、`optional_host_permissions`，以及 `content_scripts.matches` |

有效准入是所有适用条件的交集：**产品用途授权 ∧ 必要 MV3 权限/host access ∧ 服务认证 ∧ 对高风险 action 的本次确认**。浏览器授权不能代表用户同意外发 AI；产品 UI 同意也不能绕过浏览器拒绝的 API 权限。

Chrome 建议可选功能优先采用 `optional_permissions` / `optional_host_permissions`，在功能触发时说明原因并由用户操作申请；运行时通过 Permissions API 检查/请求/撤销。任何 host pattern 和 API permission 都需按具体功能审查，不能为“以后可能用”预先全域授权。见 [Chrome 权限声明](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions) 与 [Permissions API](https://developer.chrome.com/docs/extensions/reference/api/permissions)。

### 5.2 各数据操作对应的授权检查

| 操作 | AsterTab 产品授权 | MV3 / 服务侧检查 | 允许后做什么 |
| --- | --- | --- | --- |
| 本地固定配置/本地 command parse | 不读取敏感用户数据 | 无需额外扩展 API 权限 | 使用内存或打包默认值完成确定性命令 |
| 读取本地敏感上下文（例如历史派生数据） | 针对数据类别和用途单独 opt-in | 需要时检查 `history`、`tabs`、`storage` 等 API permission；不得仅靠产品开关 | 只构建本次批准的最小本地上下文 |
| 读取外部 GitHub/OJ 数据 | 用户启用该来源并允许本次读取用途 | 检查服务认证/最小 scopes；若从扩展上下文直接请求，则检查相应 host access | 只调用该 adapter 的只读能力 |
| 仅将任务文本发送给 AI 做 Intent Interpretation | 显式 `ai <request>`；提交前显示 provider；只授权本条输入文本外发 | 检查 provider 配置及必要请求能力/host access | 只解释该文本，不读取或附加其他上下文 |
| 向 AI provider 发送上下文 | 展示本次来源、数据类别和目的地，用户同意 | 检查 provider 配置及必要请求能力/host access；MV3 host access 本身不是外发同意 | 发送裁剪后的本次 payload |
| 写入 GitHub/OJ 或其他外部服务 | 用户查看并确认具体变更 | 再检查服务认证、写入 scopes 和必要 host access | 只执行已确认的那一个 action |

MV3 是否需要某一项权限取决于选定的数据路径和 API，必须在具体功能/adapter spec 中核定；产品授权不能替代 MV3 权限，MV3 权限也不能替代产品授权。

### 5.3 对当前确定性切片的约束

- WXT 新标签覆盖、Preact UI、纯本地解析和跳转到固定 HTTPS 搜索 URL 不需要额外扩展 API 权限；该切片不使用 `chrome.*`，不需要 `storage`、`tabs`、history 或 host permissions。
- 如果首版新增偏好持久化，Chrome `storage` API 本身需在 manifest 声明 `storage` 权限；这是明确功能需要后再加入的权限，而非默认常量。
- GitHub/OJ API 请求、读取当前页、查询历史/标签页属于不同能力，可能分别需要 host/API permission、服务认证或用户触发。不能用“已装扩展”替代这些授权，也不能把第三方 OAuth 登录等同于 MV3 permission。
- 开发热更新带来的 WXT 开发权限和生产 manifest 分开审计。生产权限应匹配最终功能；检查器不应把“权限永远为空”写成产品不变量，而应断言权限清单符合已批准的该版需求。

### 5.4 凭证不是浏览器权限

GitHub OAuth、OJ 登录态、AI provider 凭证分别属于对应 integration 的认证与密钥处理边界。它们不由 MV3 permission 自动提供，也不能复用一个笼统的“已连接”布尔值。认证方式、OAuth scopes、token 生命周期、存储威胁模型需在对应 adapter/AI provider 规格中单独决定。

## 6. Adapter 最小公共面与明确不抽象的内容

首条 GitHub/OJ/AI workflow 只需要**按用例定义的窄函数**：Luogu 读取题目/提交、GitHub 读取用户选定的代码来源、一个 AI provider 接收批准的上下文并返回诊断。每个函数有自己的类型化输入/输出；需要给 Context Engine 的读取结果携带来源和时间信息；错误至少能让调用方区分未授权/未登录、网络失败和无效响应。

目前没有要求所有 adapter 实现统一的业务接口。Orchestrator 直接依赖这几项已知能力；权限要求、认证和参数范围写在对应 integration 规格中，由 Permission Policy 在调用前核验。这里的 “capability” 是描述某项能力的概念，不要求建立运行时 capability catalog、稳定 ID 注册表、通用 adapter 描述对象或插件发现机制。只有第二个真实实现证明可复用时，才抽取共同的错误/来源外壳。

GitHub 的 repository/file/commit，Luogu 的 problem/submission/verdict，AI 的诊断结果保持各自业务类型，不并为统一对象或 CRUD 接口。V1 可先接一个配置好的 AI provider；Provider abstraction 保持窄且只隔离真实 provider 差异，不预建多 provider 路由、模型能力矩阵或最低公分母协议。具体 endpoint、授权 scopes、字段映射和函数名留到对应 integration spec。

## 7. MV3 运行时职责

| 运行上下文 | 适合承担 | 不应承担 |
| --- | --- | --- |
| New Tab Preact 页面 | 首屏、输入/建议、模式标识、来源预览、授权/确认交互、结果和可恢复错误 | 业务策略唯一实现、任意集成初始化、静默后台收集；UI 组件直接拥有 OAuth/API 副作用 |
| 纯 TypeScript Core | command 分类、固定搜索路由、workflow 校验、Context/Permission/Executor 的产品规则 | 直接导入 Preact/WXT；在无必要时依赖浏览器全局对象 |
| MV3 service worker | 只有确有事件型后台需求时，接收浏览器事件、处理需要扩展后台权限的短任务、对消息做窄路由 | 常驻进程、保存关键状态于全局变量、运行持久在线 Agent 循环、作为首屏依赖 |
| Content script | 未来如确需读取当前 OJ 页面，在受限站点与用户触发条件下提取少量页面数据，发送受限的可序列化消息 | 全站注入、独立发 AI 请求、保存凭证、决定授权、执行外部写操作或持有 Agent 主循环 |
| Integration adapter | 调用一个明确的外部服务能力，隔离服务协议与失败 | 让 UI 构造服务请求；一个 provider 故障破坏主页面 |

**首个确定性切片不需要 service worker 或 content script。** 若未来实现“这个洛谷题”的当前页读取，必须单独决定入口 UX 和 API 路径（如用户主动从题目页触发、显式选择当前 tab，或手动提供链接）；不得先行假设 `tabs`、`activeTab` 或站点 host permission 的组合。Content script 应仅注入获准的具体页面，按消息 schema 返回必要字段。浏览器官方说明 content script 运行在隔离 world、可读页面 DOM，其他扩展 API 需通过消息转交；service worker 可被终止且全局变量会丢失，因此后台逻辑必须事件驱动、可重入并将需要保存的状态放到明确的存储中。参见 [Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)、[Message passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)、[service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)。

## 8. 本地数据分类

| 数据 | 首个确定性切片 | 后续建议边界 |
| --- | --- | --- |
| 默认搜索、快捷键、Workspace 配置 | 不为无必要偏好加存储；无配置时用本地默认值 | 需要持久化时优先本地；跨设备 sync 仅承载用户明确选择的非敏感偏好 |
| 搜索索引 | 不建立索引 | 只有搜索现有本地/获准浏览器数据成为已验证需求时才建立；默认本地、可重建、可清除，并限定数据来源/保留期 |
| 浏览历史派生上下文 | 不读取 | 独立 opt-in 和 history API 权限；本地最小派生、可清除；不默认同步或发给 AI |
| 本次 Context / prompt | 不适用 | 默认仅会话内存，来源可见；除非用户明确保存，不持久化和同步 |
| OAuth / API token | 不配置 | 与偏好、索引、上下文隔离；最小 scope、不记日志、不送入 AI。浏览器 `storage.local` 是持久化 API，不应宣传为加密保险箱；如评估使用，检查其对 content script 的访问级别并设置合适边界。对 API key 的 BYOK 和 OAuth token 存储策略须先写清威胁模型 |

Chrome `storage.local` 需要 `storage` 权限；官方文档指出该区域默认可由 content scripts 访问，且可通过访问级别限制。它适合明确的扩展本地数据，而不是未经分析就存放 secret。需跨上下文或 service worker 使用的数据应优先评估扩展 Storage API；选用具体存储实现时再结合体量、可查询性和保留需求决定，不预建数据库层。参考 [Chrome storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)。

## 9. 首屏性能与故障降级

- 新标签本地 HTML/JS/样式和默认 command route 随扩展包交付。挂载 UI 不等待网络、AI、登录、远程配置或大块集成初始化。
- 先渲染轻量命令输入，再按用户操作加载可选数据。V1 搜索构造是本地同步计算，离线仍可输入、解析和查看帮助；只有跳转后的第三方页面依赖网络。
- 后续 Agent/API 调用按需开始；单个 provider 失败、超时或被拒绝时显示受影响来源和恢复方式（重试、连接服务、移除该来源、打开原服务），不清空或锁死 Command Center。
- 缺少 AI 时不把确定性命令升级为错误，也不假称完成诊断；缺少某个 OJ/GitHub 来源时明确降低诊断依据，不推断未返回的事实。
- 不在首屏读取全部 storage、查询全部标签页、预热 AI SDK 或连接远程服务。冷启动、包体积和实际浏览器渲染在后续实现验收中测量；该 Spec 不指定无证据的阈值。

## 10. V1 第一纵向切片与边界

“第一刀”指 **Command Center 确定性核心**，不是完整 V1，也不触及 AI：

### 纳入

- WXT + MV3 + TypeScript + Preact 新标签入口（技术栈已由 ADR 决定）；
- 轻量本地输入 UI；纯逻辑将输入分类；候选首批搜索路由 `g` / `gh` / `lg`，无前缀时走默认网页搜索；`ai <request>` 仅识别为显式 Agent 请求并显示“尚未接入”，不发网络请求、不转成搜索；
- 将查询编码到固定、经过核验的 HTTPS 搜索目的地；导航由新标签页面的薄入口完成；
- 空输入不执行，已识别前缀缺查询时给出可恢复提示；类 URL 的危险 scheme 字符串作为搜索数据，不能成为任意导航目标；
- Chrome 与 Edge 生产构建及生成 manifest 审计；无网络首屏、键盘与查询编码行为的人工浏览器验收。

首批命令和 URL 仍属计划候选，在 Spec 批准和实施前应核验真实搜索目标、浏览器行为与语法；不因出现在 Draft plan 而自动固化。

### 切片验收和价值边界

它应当成为一个可日常试用的本地搜索入口：空输入不导航；普通文本和 `g`/`gh`/`lg` 输入分别得到预期的固定搜索目标；危险 scheme 只作为查询内容；`ai` 请求得到本地未接入提示；离线打开仍可输入、解析、查看帮助并使用本地确定性逻辑。以上可独立验证 Command Center 的确定性和低摩擦；代码验收本身不能证明长期留存，日常使用价值仍需之后由真实使用观察验证。

### 不纳入

Agent / LLM / provider SDK；service worker；content script；浏览历史、标签页或 bookmarks 读取；GitHub/OJ 登录与 API；权限申请界面；Context Engine 持久化；API 凭证管理；外部写操作；通用工具注册/runtime；Workspace、widget、同步服务。

### 后续 V1 价值验证路径

在确定性 Command Center 已工作后，单独设计并实现一个显式触发、只读的学习诊断 workflow：用户当前 Luogu 题目 + 近期提交 + 用户选定的 GitHub 代码 + 用户批准外发的上下文 → AI 先诊断卡点，再给适度提示。第一轮只需一种 OJ、一种 GitHub 只读场景和一个已配置 AI provider；不先做多 OJ 统一数据平台，不默认提供完整解答，不做外部写入或后台自动 Agent。入口、当前页获取路径、认证、来源选择和 AI 外发规则须另经对应 Spec 确认。

扩展路径保持加法式：未来在纯 Command Engine 中启用已识别的 Agent 请求分支，由 Orchestrator 处理该 workflow；现有 Search handler、URL 构造和新标签导航分支继续独立工作。首切片不为此创建 Agent/Tool registry、通用 Adapter interface 或后台 runtime，因此后续只需增加经过批准的 workflow 与其窄服务调用，不需推翻 Command/Search 边界。

## 11. 对现有 implementation plan 的审查

| 计划部分 | 当前依据是否足够 | Spec 获批后如何处理 |
| --- | --- | --- |
| Task 1：WXT/Preact/MV3 新标签基础 | 技术栈与“单一轻入口”已有 ADR 依据 | 可保留；实现时重新核验 WXT/Vite/TS/Vitest 兼容版本、package manager 和生成目录。manifest 检查应匹配当前已批准功能的权限，不把空权限写成永久目标 |
| Task 2：命令解析类型与语法 | 确定性优先、`g`/`gh`/`lg` 示例和默认搜索均有依据 | 可保留方向，但 parser 结果需反映显式 Agent 请求和 unsupported/invalid 状态；普通未知自然语言仍默认搜索，不自动 AI fallback。最终联合类型和命令语法在实现计划修订时确定 |
| Task 3：搜索 URL 构造 | 固定目的地、安全编码、搜索与导航效果分开有依据 | 可保留方向；核验每个 provider 的实际 URL/hostname；不创建过度通用的搜索注册平台。导航是否需要 platform wrapper 以实现实际浏览器 API 为准 |
| Task 4：Preact Command Center | Preact UI、键盘优先、纯 core 无 UI 依赖均有依据 | 可保留骨架；焦点、Escape、错误提示等具体交互由跨浏览器行为决定；不假设必须创建 `open-url` 包装层 |
| Task 5：浏览器、权限、性能验收 | Chrome/Edge 目标、least privilege、首屏本地可用有依据 | 保留生产 manifest、离线渲染、键盘和包体测量；仅断言本切片实际需要的权限。Chrome 无痕限制作为浏览器行为记录，而不是扩展功能承诺 |
| Tasks 中 Vitest/jsdom/Testing Library、npm scripts、锁文件和脚本路径 | 属于工程细节，尚未由产品/架构决定 | 可在实现计划阶段选择并核对版本；不在本 Spec 固定依赖清单或目录 |
| 后续 Context Adapter、AI Provider、Agent | 项目有目标场景，但数据和授权细节尚不充分 | 不能按当前 plan 直接展开；先补当前页来源路径、各服务 scopes、上下文外发、凭证存储和失败策略的专项设计 |

### 现在有充分依据的决定

- 已采纳 WXT + Manifest V3 + TypeScript + Preact；
- 单一扩展应用，新标签入口优先；不加大型 UI/state/router/plugin 框架；
- 第一刀只做本地确定性 Command Center，不碰 AI 或服务认证；
- 解析与安全 URL 构造保持纯逻辑，UI 不承载 service API 规则；
- 首屏不依赖远端，扩展/集成权限按功能加入。

### 必须等待 Spec 审核或专项决策

- Command Parser 最终类型细节；Agent 请求已固定为显式 `ai <request>` 语义，具体 UI 表现（是否另加模式按钮）在 Agent UX Spec 决定；
- Search 路由最终 provider 清单、默认搜索、Luogu URL 及导航行为；
- Permission Policy 如何表达功能授权、外发同意与确认生命周期；
- Luogu 当前题/提交和 GitHub 代码的具体获取、认证、host/API permissions；
- AI provider 请求、token/API key 存储、外发 payload 和删除/保留规则；
- 有真实事件需求前是否增加 service worker/content script；
- 具体存储介质、测试依赖及性能回归阈值。

### 有意延后的决定及其闸门

- 默认搜索服务、Luogu 搜索目标和固定 URL 域名：在确定性切片实施计划获批前核验；输入始终只是查询数据，不能提供导航 origin。
- 当前 Luogu 题目/提交从何处获取、是否需要 content script 或其他 browser API：在 Agent integration spec 中，基于用户入口和最小 API 路径决定后再申请权限。
- GitHub/OJ 授权 scopes、AI provider 认证/凭证存储：在对应服务 adapter spec 中，写清读取与写入范围、token 生命周期和威胁模型后决定。
- Context 的具体长度/记录预算与任何缓存保留期：在真实来源数据和诊断 workflow 可测后设定；默认不持久化。
- WXT/Vite/TS/Test 工具版本、测试环境和性能阈值：在实施前按当时兼容矩阵和测量结果确认。

这些是带有明确决策时机的延后项，不改变本 Spec 已确定的安全路径；当前不存在允许普通文本自动进入 Agent、允许模型执行 action 或默认外发上下文的待定分支。

## 12. 审批记录与下一阶段闸门

本 Spec 于 2026-09-24 获用户审核通过，状态为 Approved。批准确认了普通文本确定性搜索、Agent 显式触发、AI 与 action 执行分离、权限分层，以及首切片仅包含确定性 Command Center 等边界。

本次 Spec 批准不等于 implementation plan 获批，也不授权开始实现。修订后的 implementation plan 仍待用户审核；开始 scaffold、安装依赖或编码前，必须另行收到用户明确授权。

以下意见不阻塞本 Spec，但约束后续设计：

1. Permission UX 应按场景区分一次性、会话级、持续授权和高风险逐次确认，避免无必要的确认打扰。
2. ai 命令是当前显式语义入口，不将长期产品概念固定为 AI 等于 Agent。
3. 首切片不添加为未来 Agent 准备的占位接口、通用框架或 runtime。

## 参考资料## 参考资料

- [Chrome：Declare permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)
- [Chrome：`chrome.permissions` API](https://developer.chrome.com/docs/extensions/reference/api/permissions)
- [Chrome：Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Chrome：Message passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)
- [Chrome：Extension service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [Chrome：`chrome.storage` API](https://developer.chrome.com/docs/extensions/reference/api/storage)
