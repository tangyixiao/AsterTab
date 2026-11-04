export type DiagnosticSource = {
  id: string;
  kind: "problem" | "submission" | "code";
  label: string;
  text: string;
  url?: string;
};

const kindLabels: Record<DiagnosticSource["kind"], string> = {
  problem: "题目",
  submission: "提交",
  code: "代码",
};

export function buildContextPreview(request: string, sources: readonly DiagnosticSource[]): string {
  const selected = sources.filter(source => source.text.trim());
  const header = `学习诊断请求\n${request.trim()}\n\n已选资料`;
  if (selected.length === 0) return `${header}\n（未选择资料）`;

  return `${header}\n${selected.map(source => {
    const url = source.url ? `\n来源：${source.url}` : "";
    return `[${kindLabels[source.kind]}] ${source.label.trim()}${url}\n${source.text.trim()}`;
  }).join("\n\n")}`;
}
