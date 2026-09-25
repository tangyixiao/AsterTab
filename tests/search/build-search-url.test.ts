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

  it.each(["javascript:alert(1)", "data:text/html,hello"])("treats %s as search data", query => {
    const url = buildSearchUrl({ kind: "search", target: "default", query });
    expect(url.origin).toBe("https://www.bing.com");
    expect(url.searchParams.get("q")).toBe(query);
  });

  it.each(["", "   "])("rejects empty query %j", query => {
    expect(() => buildSearchUrl({ kind: "search", target: "google", query })).toThrow(RangeError);
  });
});
