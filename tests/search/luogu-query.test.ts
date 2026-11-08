import { describe, expect, it } from "vitest";
import { parseLuoguQuery } from "../../src/core/search/luogu-query";

describe("parseLuoguQuery", () => {
  it.each([
    ["P1001", "P1001"],
    ["p1001", "P1001"],
    ["B1000", "B1000"],
    ["U123456", "U123456"],
    ["T123456", "T123456"],
    [" P1001 ", "P1001"],
  ] as const)("parses %s as a problem", (input, pid) => {
    expect(parseLuoguQuery(input)).toEqual({ kind: "problem", pid });
  });

  it.each([
    "P12345678",
    "动态规划",
    "1234",
    "CF1234A",
  ] as const)("parses %s as a keyword", input => {
    expect(parseLuoguQuery(input)).toEqual({ kind: "keyword", keyword: input });
  });
});
