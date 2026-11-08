import { describe, expect, it } from "vitest";
import { evaluateExpression } from "../../src/core/commands/calc";

describe("evaluateExpression", () => {
  it.each([
    ["1+2", { kind: "ok", value: 3, display: "3" }],
    ["2^10", { kind: "ok", value: 1024, display: "1024" }],
    ["-2^2", { kind: "ok", value: -4, display: "-4" }],
    ["2^-3", { kind: "ok", value: 0.125, display: "0.125" }],
    ["10%3", { kind: "ok", value: 1, display: "1" }],
    ["0.1+0.2", { kind: "ok", value: 0.30000000000000004, display: "0.3" }],
    ["1/3", { kind: "ok", value: 0.3333333333333333, display: "0.333333333333" }],
    ["sqrt(2)", { kind: "ok", value: Math.sqrt(2), display: "1.41421356237" }],
    ["pi", { kind: "ok", value: Math.PI, display: "3.14159265359" }],
    ["PI", { kind: "ok", value: Math.PI, display: "3.14159265359" }],
    ["e", { kind: "ok", value: Math.E, display: "2.71828182846" }],
    ["min(3,1,2)", { kind: "ok", value: 1, display: "1" }],
    ["max(3,1,2)", { kind: "ok", value: 3, display: "3" }],
    ["ln(e)", { kind: "ok", value: 1, display: "1" }],
    ["log(100)", { kind: "ok", value: 2, display: "2" }],
    ["(1+2)*3", { kind: "ok", value: 9, display: "9" }],
    ["2^3^2", { kind: "ok", value: 512, display: "512" }],
    ["  12  ", { kind: "ok", value: 12, display: "12" }],
  ] as const)("evaluates %s", (expression, expected) => {
    expect(evaluateExpression(expression)).toEqual(expected);
  });
  it.each([
    ["", "Empty expression"],
    ["   ", "Empty expression"],
    ["2+", "Invalid expression"],
    ["2^", "Invalid expression"],
    ["(1+2", "Invalid expression"],
    ["1+2)", "Invalid expression"],
    ["1..2", "Invalid expression"],
    ["1 # 2", "Invalid character: #"],
    ["foo", "Unknown identifier: foo"],
    ["foo(1)", "Unknown function: foo"],
    ["sqrt(1,2)", "sqrt() expects 1 argument"],
    ["min(1)", "min() expects at least 2 arguments"],
    ["1/0", "Cannot divide by zero"],
    ["5%0", "Cannot divide by zero"],
    ["1e999", "Invalid expression"],
  ] as const)("rejects %s", (expression, message) => {
    expect(evaluateExpression(expression)).toEqual({ kind: "error", message });
  });
});
