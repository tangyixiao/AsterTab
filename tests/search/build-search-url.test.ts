import { describe, expect, it } from "vitest";
import type { SearchCommand } from "../../src/core/commands/parse-command";
import { buildSearchUrl } from "../../src/core/search/build-search-url";

const cases: Array<[SearchCommand["target"], string, string, string, string]> = [
  ["default", "https://www.bing.com", "/search", "q", "hello world"],
  ["google", "https://www.google.com", "/search", "q", "hello world"],
  ["github", "https://github.com", "/search", "q", "hello world"],
  ["luogu", "https://www.luogu.com.cn", "/problem/list", "keyword", "hello world"],
];

describe("buildSearchUrl", () => {
  it.each(cases)("routes %s to its fixed HTTPS origin", (target, origin, path, key, query) => {
    const url = buildSearchUrl({ kind: "search", target, query });
    expect(url).toBeInstanceOf(URL);
    expect(url.origin).toBe(origin);
    expect(url.pathname).toBe(path);
    expect(url.searchParams.get(key)).toBe(query);
    expect(url.searchParams.get("type")).toBe(target === "github" ? "repositories" : null);
    expect(url.searchParams.get("page")).toBe(target === "luogu" ? "1" : null);
  });

  it("keeps Unicode, ampersands, and attempted filters inside one query value", () => {
    const google = buildSearchUrl({ kind: "search", target: "google", query: "矩阵 & 字符串" });
    const github = buildSearchUrl({ kind: "search", target: "github", query: "preact&type=code" });
    expect(google.searchParams.get("q")).toBe("矩阵 & 字符串");
    expect(google.searchParams.size).toBe(1);
    expect(github.searchParams.get("q")).toBe("preact&type=code");
    expect(github.searchParams.get("type")).toBe("repositories");
  });

  it.each([
    ["1234A", "https://codeforces.com/problemset/problem/1234/A"],
    ["tourist", "https://codeforces.com/profile/tourist"],
    ["chen jason", "https://codeforces.com/profile/chen%20jason"],
  ] as const)("builds %s Codeforces URLs", (query, href) => {
    const url = buildSearchUrl({ kind: "search", target: "codeforces", query });
    expect(url).toBeInstanceOf(URL);
    expect(url.href).toBe(href);
  });

  it("routes a Luogu problem id to the problem page", () => {
    const url = buildSearchUrl({ kind: "search", target: "luogu", query: "P1001" });
    expect(url).toBeInstanceOf(URL);
    expect(url.href).toBe("https://www.luogu.com.cn/problem/P1001");
  });

  it("keeps the Luogu list URL for keyword queries", () => {
    const url = buildSearchUrl({ kind: "search", target: "luogu", query: "动态规划" });
    expect(url.pathname).toBe("/problem/list");
    expect(url.searchParams.get("keyword")).toBe("动态规划");
    expect(url.searchParams.get("page")).toBe("1");
  });

  it.each(["javascript:alert(1)", "data:text/html,hello"])("treats %s as search data", query => {
    const url = buildSearchUrl({ kind: "search", target: "default", query });
    expect(url.origin).toBe("https://www.bing.com");
    expect(url.searchParams.get("q")).toBe(query);
  });

  it.each(["", "   "])("rejects empty query %j", query => {
    expect(() => buildSearchUrl({ kind: "search", target: "google", query })).toThrow(RangeError);
  });
});
