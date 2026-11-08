import { describe, expect, it } from "vitest";
import { parseCommand } from "../../src/core/commands/parse-command";

describe("parseCommand", () => {
  it.each([
    ["   ", { kind: "empty" }],
    ["how do I debug dynamic programming?", { kind: "search", target: "default", query: "how do I debug dynamic programming?" }],
    ["ghfoo preact", { kind: "search", target: "default", query: "ghfoo preact" }],
    ["git tutorial", { kind: "search", target: "default", query: "git tutorial" }],
    ["g matrix", { kind: "search", target: "google", query: "matrix" }],
    ["G matrix", { kind: "search", target: "google", query: "matrix" }],
    ["gh preact", { kind: "search", target: "github", query: "preact" }],
    ["GH preact", { kind: "search", target: "github", query: "preact" }],
    ["lg P1001", { kind: "search", target: "luogu", query: "P1001" }],
    ["LG P1001", { kind: "search", target: "luogu", query: "P1001" }],
    ["cf 1234A", { kind: "search", target: "codeforces", query: "1234A" }],
    ["CF tourist", { kind: "search", target: "codeforces", query: "tourist" }],
    ["cf 1234", { kind: "search", target: "codeforces", query: "1234" }],
    ["AI explain", { kind: "agent", request: "explain" }],
    ["= 2^10", { kind: "calc", expression: "2^10" }],
    ["=2+2", { kind: "calc", expression: "2+2" }],
    ["=", { kind: "error", code: "missing_expression" }],
    ["calc 1+1", { kind: "calc", expression: "1+1" }],
    ["calc", { kind: "error", code: "missing_expression" }],
    ["calculate x", { kind: "search", target: "default", query: "calculate x" }],
    ["g", { kind: "error", code: "missing_query", command: "g" }],
    ["gh   ", { kind: "error", code: "missing_query", command: "gh" }],
    ["lg", { kind: "error", code: "missing_query", command: "lg" }],
    ["cf", { kind: "error", code: "missing_query", command: "cf" }],
    ["ai", { kind: "error", code: "missing_agent_request", command: "ai" }],
    ["help", { kind: "help" }],
    ["?", { kind: "help" }],
    ["HELP", { kind: "help" }],
    ["help me", { kind: "search", target: "default", query: "help me" }],
    ["? x", { kind: "search", target: "default", query: "? x" }],
    ["  g  矩阵 &  字符串  ", { kind: "search", target: "google", query: "矩阵 &  字符串" }],
    ["javascript:alert(1)", { kind: "search", target: "default", query: "javascript:alert(1)" }],
    ["data:text/html,hello", { kind: "search", target: "default", query: "data:text/html,hello" }],
  ] as const)("classifies %s", (input, expected) => {
    expect(parseCommand(input)).toEqual(expected);
  });
});
