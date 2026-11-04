# ADR-0001：扩展平台与 UI 技术栈

- 状态：已采纳
- 决策日期：2026-09-23
- 决策来源：用户明确指定
- 适用范围：AsterTab V1 工程基础

## 背景

AsterTab 是浏览器新标签工作区。首版要让命令中心足够轻，同时后续会加入 Workspace、模块化组件、命令面板和 Agent 交互。项目 brief 仍要求核心保持服务无关、默认克制、优先确定性执行，并避免过早拆包或建设通用插件市场。

## 决策

1. 浏览器扩展采用 **Manifest V3**，以 **Chrome 和 Edge** 为 V1 第一目标。构建和业务代码不得无必要地依赖某个浏览器专属 API；后续 Chromium 浏览器的适配通过验证具体 API 能力来完成。
2. 扩展工程采用 **WXT**。用 WXT 管理扩展入口、Manifest 生成、目标浏览器构建、开发热更新和分发压缩包。
3. 应用代码采用 **TypeScript**。
4. 新标签页 UI 采用 **Preact** 和函数组件。状态先由 Preact 自带能力承载，不预装全局状态管理器。
5. WXT 内部使用 Vite。WXT 负责扩展构建约定，Vite 负责底层前端转换和打包；项目不另造一套 MV3 构建与 Manifest 管道。
6. Preact 通过 WXT 的 Vite 插件接口接入。先评估 `@preact/preset-vite`；关闭默认 React 别名，除非某个已批准的依赖确实要求 Preact compat。
7. 暂不引入大型 UI 组件库、路由器、通用插件运行时或独立共享包。保持单仓库、单扩展应用，按实际边界分目录。
8. 第一阶段只需要新标签页入口，不加后台 service worker、content script、登录或远程 API。确有事件驱动需求时，再单独设计后台入口。
9. 第一阶段搜索和导航逻辑在扩展本地完成。首屏渲染不依赖网络、外部配置或 AI；执行搜索时打开现有服务页面，不抓取或重建其内容。
10. 生产包仅声明当期功能必需的权限。WXT 为开发热更新自动加入的权限必须与生产构建分开检查。

## 建议目录边界

```text
entrypoints/
  newtab/                 WXT 新标签入口与 Preact 启动代码
src/
  app/                    Command Center 与后续 Workspace UI
  core/commands/          纯 TypeScript 输入解析、意图和动作类型
  core/search/            与浏览器 API 无关的搜索路由规则
  integrations/           逐步添加 GitHub、OJ、AI 适配器
  platform/               只有确实用到扩展 API 时再增加窄接口
```

WXT 默认只发现 `entrypoints/` 根目录或其下一层的入口文件。入口相关文件放在对应目录内，避免被误识别为另一个扩展入口。纯业务模块不得导入 WXT 构建 API 或直接调用 `chrome.*`。

## WXT 与 Vite + 原生 DOM 的取舍

| 关注点 | TypeScript + Vite + 原生 DOM | WXT + TypeScript + Preact |
| --- | --- | --- |
| MV3 工程职责 | 裸 Vite 只提供通用前端构建；项目需自行组织 Manifest、扩展入口、浏览器目标和扩展热更新 | WXT 按入口配置生成 Manifest，提供扩展目标构建、开发重载和 ZIP 构建 |
| UI 状态与组件生命周期 | 项目自行约定 DOM 创建、事件绑定、更新和卸载；随着 Workspace 与弹层增长，需维护自己的组件/状态约定 | Preact 提供组件、生命周期和状态更新模型，组件可按 Command Center、Workspace、面板拆分 |
| 初始成本 | 更少依赖，单静态页最快 | WXT、Vite、TypeScript、Preact 及 Preact Vite 适配增加了工具链 |
| 长期维护 | 扩展脚手架和 UI 复用模式逐步由项目自己维护 | 扩展基础由 WXT 处理，交互 UI 由 Preact 处理，项目聚焦命令、上下文、权限与集成 |
| 性能责任 | 没有框架运行时，但 DOM 与状态边界由项目维护 | 有 Preact 运行时；所有脚本打入本地扩展包，实际包大小和首屏耗时仍需测量 |

### WXT 是否减少自维护基础设施

**是，且对 AsterTab 的目标形态有实际价值。** WXT 会从配置和入口自动生成 Manifest；`newtab` 入口会注册新标签覆盖；同一代码可按浏览器输出构建；它也处理扩展开发热更新及 ZIP 打包。这样能减少团队自己维护的 Manifest 拼装、入口映射、目标目录和打包脚本。

**WXT 不会替项目承担浏览器扩展产品决策。** 项目仍需决定每项 API 是否必要、管理权限与 host permissions、核对 Edge/其他 Chromium API 支持、处理 MV3 生命周期、保护认证数据、遵守商店审核规则，并实际验证生成物。WXT 是建立在 Vite 之上的扩展框架，不是对 Vite 能力的替代；WXT 当前版本还要求项目提供兼容的 Vite peer dependency。

所以这里使用 WXT 不是为了多一层框架：它接手重复的扩展工程工作；Preact 接手计划内不断增长的交互 UI；AsterTab 自己只维护产品独有的命令、上下文、权限和集成逻辑。若未来目录和入口很少、扩展目标被缩减成单个静态页，再重新评估这项成本。

## 约束与注意点

- WXT 的开发热更新会在开发 Manifest 中加入 `tabs` 和 `scripting` 权限。代码审查和发布前要检查 `.output/<target>/manifest.json`，确认生产包没有只为开发所需的权限。
- WXT 会在构建时导入入口文件以读取入口配置；扩展 API 调用必须留在运行时入口回调中，不能在模块加载顶层执行。
- Preact 只进入实际使用组件 UI 的入口。不要因为已选择 Preact，就在后台或纯业务模块中引入组件运行时。
- WXT 入口本身是构建边界；通用命令解析、意图和搜索策略应保持可独立测试。
- Chrome 无痕窗口不能由扩展覆盖新标签页；这是平台行为，不应误判为 AsterTab 渲染故障。
- MV3 扩展必须把可执行逻辑打包在扩展中。首屏和命令运行代码不得从 CDN 加载。
- 以 2026-09-23 查阅的官方文档为准，WXT 0.21 系列要求 Node.js 22+、Vite 6.3.4+、TypeScript 5.4+；Vitest 5 要求 Node.js 22.12+、Vite 6.4+。开始实际 scaffold 时重新核对兼容矩阵并锁定单一 lockfile。

## 官方依据

- [WXT entrypoints](https://wxt.dev/guide/essentials/entrypoints)：文件入口、`newtab` 自动生成覆盖项及目录约定。
- [WXT Manifest](https://wxt.dev/guide/essentials/config/manifest)：从配置与入口生成 Manifest；开发热更新权限。
- [WXT + Vite](https://wxt.dev/guide/essentials/config/vite)：WXT 的 Vite 底层与插件接口。
- [WXT 前端框架](https://wxt.dev/guide/essentials/frontend-frameworks)：WXT 对任意 Vite 插件框架开放。
- [WXT 浏览器目标](https://wxt.dev/guide/essentials/target-different-browsers)：按目标浏览器构建。
- [WXT 发布与打包](https://wxt.dev/guide/essentials/publishing)：`wxt zip` 的打包能力。
- [WXT 升级说明](https://wxt.dev/guide/resources/upgrading)：当前 peer dependency 与最低版本信息。
- [Preact TypeScript 指南](https://preactjs.com/guide/v10/typescript/) 与 [Preact Vite preset](https://github.com/preactjs/preset-vite)：TSX 配置、Preact HMR 插件能力。
- [Chrome 新标签覆盖](https://developer.chrome.com/docs/extensions/develop/ui/override-chrome-pages)：Manifest V3 新标签入口、快速加载和无痕行为。
- [Chrome 权限说明](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)：权限和 host permission 的配置边界。
- [Chrome MV3 扩展安全](https://developer.chrome.com/docs/extensions/develop/migrate/improve-security)：扩展逻辑必须随包发布。
- [Microsoft Edge 扩展移植](https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/developer-guide/port-chrome-extension)：Chrome API 与 Edge API 的兼容性检查要求。
- [Vitest 入门](https://vitest.dev/guide/)：当前 Node.js 与 Vite 最低版本及共享 Vite 配置。
