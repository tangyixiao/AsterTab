# ADR-0002：学习诊断首个 AI Provider 采用 OpenRouter

- 状态：已采纳
- 决策日期：2026-09-29
- 决策来源：用户选择“OpenRouter API key”
- 适用范围：显式 `ai <request>` 的一次性学习诊断

## 背景

学习诊断本地草稿、资料选择和预览已经实现。接入 AI 会将用户请求及选中的题面、提交和代码发送到外部服务，因此必须固定目标服务、明确密钥生命周期和发送确认。本决策只建立一个可用的 OpenRouter 路径，不预建多 Provider runtime。

## 决策

1. **固定请求目标。** 只向 `https://openrouter.ai/api/v1/chat/completions` 发送 JSON POST。使用 Bearer API key；不采用 SDK，不开放自定义 API endpoint。`HTTP-Referer` 等文档标为可选的头不发送。
2. **按需申请主机权限。** Manifest 只把 `https://openrouter.ai/*` 加为 optional host。新标签页、配置、预览和输入期间不访问 OpenRouter；仅用户勾选确认并点击“确认并发送诊断”后，在该点击处理中申请权限，再执行固定端点请求。
3. **API key 仅保存在浏览器会话存储。** 用户输入后需明确点击“保存到当前会话”。只用 `browser.storage.session`；不写入 `storage.local`、`storage.sync`、页面上下文、模型请求正文或日志。浏览器关闭、扩展重载、停用或更新后需要重新输入。扩展代码运行期间仍能读取此 key，因此 UI 明确说明其生命周期。
4. **模型 ID 是本机配置。** 用户从 OpenRouter 模型目录选择并输入 `provider/model` ID，点击保存后写入 `browser.storage.local`，不写入同步存储。AsterTab 不设默认模型、不自动挑选或切换模型。
5. **预览与发送共用序列化正文。** 预览显示完整请求 JSON，包括 system/user messages、模型 ID、最大输出 token 数及非流式参数。网络请求直接发送同一序列化字符串；Authorization header 显示为说明，不显示 key 本身。资料或模型改变后，旧确认不再有效。
6. **每次发送都需显式同意。** 确认文案说明内容会送往 OpenRouter，并由所选模型服务商处理。界面链接 OpenRouter 隐私政策并提示服务商的数据保留/训练做法可能不同。用户应查看其所选模型的数据政策。
7. **能力保持受限。** 请求只含已预览的学习诊断提示和用户选中的资料。不给模型配置 tools/function calling；无自动重试、模型回退、追加来源、对话历史或后台调用。响应作为普通文本显示，不解析为动作、不执行 HTML。
8. **控制请求和响应范围。** 输入上下文最多 50,000 个 JavaScript 字符，最大输出设为 1,200 tokens，响应正文最多读取 1,000,000 bytes；请求在 60 秒超时后中止。错误不显示服务端原始错误正文；重试由用户重新审阅并确认。
9. **集成边界。** OpenRouter HTTP 与设置逻辑位于 `src/integrations/ai/`。在出现第二个真实 Provider 之前，不创建通用 Provider registry、Executor 或 Agent runtime。

## 权限

生产 Manifest 增加无 host 范围的 `storage` API 权限，以使用 `storage.session` 和本机模型设置；OpenRouter host 保持 optional。保留现有 Luogu/GitHub optional host。实现不增加 background service worker、content script、OAuth、页面历史或标签读取权限。

## 数据流

```text
用户选中的资料 + 本次请求
          ↓ 完整正文预览
用户勾选并点击发送
          ↓ 按需申请 openrouter.ai 主机权限
固定 Chat Completions endpoint + Authorization header
          ↓
OpenRouter → 用户选择的模型服务商
          ↓
普通文本诊断（只留在当前页面内存）
```

上下文和响应不写入存储、遥测或用户画像；关闭诊断草稿会卸载结果与资料。模型 ID 是非敏感本机偏好，key 只活在扩展会话存储中。

## 已知限制

- OpenRouter 会把输入转给用户选定的模型服务商；模型服务商的数据处理、保留和训练政策存在差异。AsterTab 只能提示并链接政策，不能替用户保证这些服务商不保留或不训练。
- 会话存储降低了磁盘持久化风险，但不构成硬件安全边界；运行中的扩展代码需要读取 key 才能发请求。
- 开发和自动测试不使用真实 key；Live API 行为需由用户在本机填写 key 后显式触发。

## 依据

- [OpenRouter Quickstart](https://openrouter.ai/docs/quickstart)：固定 API endpoint、Bearer key 和模型 ID。
- [OpenRouter Chat Completions API](https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request)：请求格式及响应结构。
- [OpenRouter Privacy Policy](https://openrouter.ai/privacy/)：输入会转交所选/自动路由的模型服务商，数据做法因服务商而异。
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)：session storage 仅驻留内存，不落盘，并在浏览器重启或扩展重载/更新时清空。
- [Chrome Permissions API](https://developer.chrome.com/docs/extensions/reference/api/permissions)：在可选主机权限功能被使用时按需请求权限。
