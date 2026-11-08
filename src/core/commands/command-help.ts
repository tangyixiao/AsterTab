export type CommandHelpEntry = { command: string; description: string };

export const COMMAND_HELP: readonly CommandHelpEntry[] = [
  { command: "<查询>", description: "使用默认搜索引擎搜索" },
  { command: "g <查询>", description: "使用 Google 搜索" },
  { command: "gh <查询>", description: "在 GitHub 上搜索仓库" },
  { command: "lg <查询>", description: "在洛谷搜索题目" },
  { command: "cf <题号或用户名>", description: "打开 Codeforces 题目（如 cf 1234A）或用户主页（如 cf tourist）" },
  { command: "= <表达式>", description: "本地计算数学表达式（如 = 2^10）" },
  { command: "ai <请求>", description: "打开学习诊断草稿" },
  { command: "help", description: "显示命令帮助" },
];
