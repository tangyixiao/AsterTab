# 贡献指南 / Contributing to AsterTab

欢迎贡献。本指南只讲「怎么改 / 怎么验 / 怎么提」；产品方向与边界以 [PROJECT.md](PROJECT.md)、[AGENTS.md](AGENTS.md) 为准，快速入门见 [README.md](README.md)。贡献即同意按 [LICENSE](LICENSE)（Apache-2.0）授权改动。

## 0. Source of truth 与 V1 护栏

冲突时的优先级（[AGENTS.md](AGENTS.md) §3）：

```text
explicit user request
        > PROJECT.md
        > AGENTS.md
        > 仓库既有约定
        > agent preference
```

不要静默改写 [PROJECT.md](PROJECT.md) 的方向。改动前先对齐 V1 护栏：

- **确定性解析优先于 AI**：`parse → deterministic command/search → execute`，琐碎操作不经过 LLM。
- **最小权限**：模块化、显式、可撤销、按集成隔离；默认只 `storage`，其余为 optional host。
- **本地优先**：敏感索引与上下文默认存本地，不强制云登录即可用。
- **不做 super-app**：连接已有工具，不重做笔记 / Todo / Git 客户端 / 日历 / IDE / OJ / AI 平台。
- **YAGNI + 含糊先问**：不为假想需求建子系统；重大产品行为含糊时先问，不猜。

> 当前真实状态：Command Center 第一切片 + 一次性学习诊断工作流已实现；多轮诊断、GitHub 私有仓库、真实 key 的成功 live 推理仍未做。PR / 文档里不要写成「已实现」。

决策记录见 [docs/decisions/](docs/decisions/)（ADR-0001 扩展平台与 UI 技术栈、ADR-0002 诊断首个 AI Provider 采用 OpenRouter），计划见 [docs/superpowers/](docs/superpowers/)，验收见 [docs/testing/](docs/testing/)。

## 1. 开发环境与验证门禁

根目录执行（依赖已共享：node_modules/、.wxt/）：

```bash
npm ci                 # 安装依赖；postinstall 执行 wxt prepare
npm test               # vitest run
npm run typecheck      # tsc --noEmit
npm run build          # 产出 .output/chrome-mv3
npm run build:edge     # 产出 .output/edge-mv3
```

开 PR 前四条门禁全部跑通。`.output/`、`.wxt/`、`node_modules/` 被 [.gitignore](.gitignore) 忽略，不提交产物。

### 解包加载

build 之后：Chrome 开 `chrome://extensions`、Edge 开 `edge://extensions`，启用开发者模式，用「加载已解压的扩展程序」分别选 `.output/chrome-mv3` 与 `.output/edge-mv3`。生产 manifest 为 MV3，仅以 `chrome_url_overrides.newtab` 覆盖新标签页（见 [wxt.config.ts](wxt.config.ts)）。

## 2. 变更纪律

- Conventional Commits：`type(scope): short summary`，空行后写 what / why 正文；一个提交只回答一个问题，不混入格式化 / 依赖升级 / 无关重构（[AGENTS.md](AGENTS.md) §28）。
- 提交前 `git diff --check`，不留行尾空白或冲突标记。
- stage 前做 secret scan：不得提交 API key / token，也不写进日志（[AGENTS.md](AGENTS.md) §26）；OpenRouter key 只应存在于运行时 session storage。
- 不用 `git add -A` / `git add .`；只 `git add` 自己改动的文件，再 `git status` 复核。

## 3. PR 流程

- 每个关注点一条分支；diff 限定在该关注点；开 PR 前跑完第 1 节验证。
- 本仓库**目前没有 CI workflows**（`.github/workflows/` 为空），`gh pr checks` 会报 `no checks reported`。因此 PR 必须写 **Verification** 段，贴本地门禁结果。建议 body：

```markdown
## Summary
<改了什么、为什么>

## Verification
- npm test: <如 9 files / 65 tests passed>
- npm run typecheck: exit 0
- npm run build / build:edge: <结果>（如跑了）
- git diff --check: clean

## Scope
- 仅本次关注点相关文件；未改 README.md / spec / plan / 配置 / manifest 权限（如适用）

[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)
```

## 4. Windows 传输提示（实测痛点）

本机 `origin` 为 SSH `git@github.com:tangyixiao/AsterTab.git`；即使 `ssh -T git@github.com` 认证成功，git 的 ls-remote / push 仍可能被拦截报 `Connection closed by 198.18.0.132 port 443`。别在 SSH 上死磕：改用 **HTTPS + `gh auth token`（Basic header）** 推送，并用 `git ls-remote` 核对远程 sha 与本地 HEAD 一致。示例（token 只在内存变量取，绝不回显 / 写入文档 / 提交）：

```powershell
$tok = gh auth token
$b = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("x-access-token:$tok"))
git -c http.extraheader="AUTHORIZATION: basic $b" push https://github.com/tangyixiao/AsterTab.git HEAD:refs/heads/<your-branch>
git -c http.extraheader="AUTHORIZATION: basic $b" ls-remote https://github.com/tangyixiao/AsterTab.git refs/heads/<your-branch>
```

核对输出的 sha 与 `git rev-parse HEAD` 相同即生效；网络不稳可重试。绝不要打印 `$tok`。
