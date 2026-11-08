import { describe, expect, it } from "vitest";
import { parseCodeforcesQuery } from "../../src/core/search/codeforces-query";

describe("parseCodeforcesQuery", () => {
  it.each([
    ["1234A", { kind: "problem", contest: "1234", index: "A" }],
    ["1234a", { kind: "problem", contest: "1234", index: "A" }],
    ["1234A1", { kind: "problem", contest: "1234", index: "A1" }],
    ["1900C2", { kind: "problem", contest: "1900", index: "C2" }],
    ["1234/A", { kind: "problem", contest: "1234", index: "A" }],
  ] as const)("parses %s as a problem", (input, expected) => {
    expect(parseCodeforcesQuery(input)).toEqual(expected);
  });

  it.each([
    ["1234", "1234"],
    ["tourist", "tourist"],
    ["Benq", "Benq"],
    ["12abc", "12abc"],
  ] as const)("parses %s as a handle", (input, expected) => {
    expect(parseCodeforcesQuery(input)).toEqual({ kind: "handle", handle: expected });
  });

  it("trims surrounding whitespace before matching a problem", () => {
    expect(parseCodeforcesQuery(" 1234A ")).toEqual({ kind: "problem", contest: "1234", index: "A" });
  });
});
