import { describe, expect, it, vi } from "vitest";
import { parseGitHubFileUrl, parseLuoguProblemUrl, readGitHubFile, readLuoguProblem } from "../../src/core/diagnostic/public-sources";

const luoguPage = (problem: object) => `<html><script id="lentille-context" type="application/json">${JSON.stringify({ template: "problem.show", data: { problem } })}</script></html>`;
const SHA = "a".repeat(40);
const githubFile = (path: string) => `https://github.com/a/b/blob/${SHA}/${path}`;

describe("selected public source readers", () => {
  it("accepts only canonical Luogu problem pages", () => {
    expect(parseLuoguProblemUrl("https://www.luogu.com.cn/problem/P1001").pid).toBe("P1001");
    for (const url of [
      "http://www.luogu.com.cn/problem/P1001",
      "https://evil.example/problem/P1001",
      "https://www.luogu.com.cn.evil.example/problem/P1001",
      "https://www.luogu.com.cn/problem/P1001?foo=1",
      "https://www.luogu.com.cn/problem/P1001#x",
      "https://www.luogu.com.cn/problem/list",
      "javascript:alert(1)",
    ]) expect(() => parseLuoguProblemUrl(url)).toThrow();
  });

  it("reads exactly the selected public Luogu problem without credentials or redirects", async () => {
    const fetcher = vi.fn(async () => new Response(luoguPage({
      pid: "P1001", name: "A+B Problem", content: { description: "求和", formatI: "两个数", formatO: "一个数", hint: "小心范围" },
      samples: [["1 2", "3"]],
    }), { status: 200, headers: { "Content-Type": "text/html" } }));

    const source = await readLuoguProblem("https://www.luogu.com.cn/problem/P1001", fetcher);
    expect(fetcher).toHaveBeenCalledExactlyOnceWith("https://www.luogu.com.cn/problem/P1001", { credentials: "omit", redirect: "error" });
    expect(source.kind).toBe("problem");
    expect(source.label).toContain("P1001");
    expect(source.text).toContain("题目描述\n求和");
    expect(source.text).toContain("样例输入 1\n1 2");
    expect(source.text).toContain("样例输出 1\n3");
  });

  it("rejects a wrong Luogu problem response and redirect", async () => {
    const wrong = vi.fn(async () => new Response(luoguPage({ pid: "P1002", name: "wrong", content: { description: "wrong" } })));
    await expect(readLuoguProblem("https://www.luogu.com.cn/problem/P1001", wrong)).rejects.toThrow();
    const redirect = vi.fn(async () => Response.redirect("https://evil.example/other"));
    await expect(readLuoguProblem("https://www.luogu.com.cn/problem/P1001", redirect)).rejects.toThrow();
  });

  it("accepts a selected GitHub blob URL and rejects other resources", () => {
    expect(parseGitHubFileUrl(`https://github.com/preactjs/preact/blob/${SHA}/README.md`).path).toBe("README.md");
    for (const url of [
      `https://evil.example/preactjs/preact/blob/${SHA}/README.md`,
      "https://github.com/preactjs/preact/tree/main/src",
      `https://github.com/preactjs/preact/blob/${SHA}/README.md?raw=1`,
      `https://github.com/preactjs/preact/blob/${SHA}/../secret`,
      "https://github.com/preactjs/preact/blob/main",
      "https://github.com/preactjs/preact/blob/main/README.md",
      "https://github.com/preactjs/preact/blob/feature/foo/file.cpp",
    ]) expect(() => parseGitHubFileUrl(url)).toThrow();
  });

  it("loads only the selected public GitHub file through the fixed API endpoint", async () => {
    const content = btoa("int main() {}\n");
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ type: "file", size: 14, encoding: "base64", content }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const source = await readGitHubFile(githubFile("src/main.cpp"), fetcher);
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(`https://api.github.com/repos/a/b/contents/src/main.cpp?ref=${SHA}`, { credentials: "omit", redirect: "error", headers: { Accept: "application/vnd.github+json" } });
    expect(source.kind).toBe("code");
    expect(source.text).toBe("int main() {}\n");
  });

  it("rejects directories, redirects, and oversized remote bodies", async () => {
    const directory = vi.fn(async () => new Response(JSON.stringify({ type: "dir" }), { status: 200 }));
    await expect(readGitHubFile(githubFile("src/file.ts"), directory)).rejects.toThrow();
    const redirect = vi.fn(async () => Response.redirect("https://raw.githubusercontent.com/a/b/main/file.ts"));
    await expect(readGitHubFile(githubFile("src/file.ts"), redirect)).rejects.toThrow();
    const huge = vi.fn(async () => new Response("x".repeat(1_000_001), { status: 200 }));
    await expect(readLuoguProblem("https://www.luogu.com.cn/problem/P1001", huge)).rejects.toThrow();
  });

  it("explains a public GitHub API limit without trying another endpoint", async () => {
    const limited = vi.fn(async () => new Response("rate limit exceeded", { status: 403 }));
    await expect(readGitHubFile(githubFile("src/file.ts"), limited)).rejects.toThrow(/GitHub.*403.*受限/);
    expect(limited).toHaveBeenCalledTimes(1);
  });

  it("adds the PAT as a bearer header only for the GitHub API request", async () => {
    const content = btoa("int main() {}\n");
    const fetcher = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ type: "file", size: 14, encoding: "base64", content }), { status: 200 }));
    const source = await readGitHubFile(githubFile("src/main.cpp"), fetcher, "github_pat_secret");
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(`https://api.github.com/repos/a/b/contents/src/main.cpp?ref=${SHA}`, {
      credentials: "omit", redirect: "error",
      headers: { Accept: "application/vnd.github+json", Authorization: "Bearer github_pat_secret" },
    });
    expect(source.kind).toBe("code");
    expect(source.text).toBe("int main() {}\n");
    for (const value of [source.id, source.label, source.url, source.text]) expect(value).not.toContain("github_pat_secret");
    expect(String(fetcher.mock.calls[0]?.[0])).not.toContain("github_pat_secret");
  });

  it("sends no Authorization header when the PAT is missing or blank", async () => {
    const content = btoa("int main() {}\n");
    for (const pat of [undefined, "   "]) {
      const fetcher = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ type: "file", size: 14, encoding: "base64", content }), { status: 200 }));
      await readGitHubFile(githubFile("src/main.cpp"), fetcher, pat);
      expect(fetcher).toHaveBeenCalledExactlyOnceWith(`https://api.github.com/repos/a/b/contents/src/main.cpp?ref=${SHA}`, {
        credentials: "omit", redirect: "error",
        headers: { Accept: "application/vnd.github+json" },
      });
    }
  });

  it("never echoes the PAT in a failing GitHub response", async () => {
    const denied = vi.fn(async () => new Response("no access", { status: 404 }));
    const error = await readGitHubFile(githubFile("src/file.ts"), denied, "github_pat_secret").then(() => undefined, value => value as Error);
    expect(error?.message).toContain("404");
    expect(error?.message).not.toContain("github_pat_secret");
  });
});
