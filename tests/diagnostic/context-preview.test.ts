import { describe, expect, it } from "vitest";
import { buildContextPreview, type DiagnosticSource } from "../../src/core/diagnostic/context-preview";

describe("buildContextPreview", () => {
  it("shows the request and selected sources in order with their labels and URLs", () => {
    const sources: DiagnosticSource[] = [
      { id: "p", kind: "problem", label: "P1001", url: "https://www.luogu.com.cn/problem/P1001", text: "  题面内容  " },
      { id: "s", kind: "submission", label: "最近一次 WA", text: "  WA on test 2  " },
      { id: "c", kind: "code", label: "main.cpp", url: "https://github.com/a/b/blob/main/main.cpp", text: "int main() {}" },
    ];

    expect(buildContextPreview("  判断我卡在哪  ", sources)).toBe(
      "学习诊断请求\n判断我卡在哪\n\n已选资料\n[题目] P1001\n来源：https://www.luogu.com.cn/problem/P1001\n题面内容\n\n[提交] 最近一次 WA\nWA on test 2\n\n[代码] main.cpp\n来源：https://github.com/a/b/blob/main/main.cpp\nint main() {}",
    );
  });

  it("omits blank sources and anything removed from the selected list", () => {
    const sources: DiagnosticSource[] = [
      { id: "blank", kind: "problem", label: "blank", text: "   " },
      { id: "selected", kind: "submission", label: "feedback", text: "WA" },
    ];
    const preview = buildContextPreview("explain", sources);
    expect(preview).toContain("[提交] feedback\nWA");
    expect(preview).not.toContain("blank");
    expect(buildContextPreview("explain", sources.filter(source => source.id !== "selected"))).toContain("（未选择资料）");
  });

  it("leaves script-like source text as literal preview text", () => {
    expect(buildContextPreview("review", [{ id: "x", kind: "code", label: "snippet", text: "<script>alert(1)</script>" }]))
      .toContain("<script>alert(1)</script>");
  });
});
