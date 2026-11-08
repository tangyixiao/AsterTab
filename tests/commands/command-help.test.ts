import { describe, expect, it } from "vitest";
import { COMMAND_HELP } from "../../src/core/commands/command-help";

describe("COMMAND_HELP", () => {
  it("gives every entry a non-empty command and description", () => {
    for (const entry of COMMAND_HELP) {
      expect(entry.command.trim()).not.toBe("");
      expect(entry.description.trim()).not.toBe("");
    }
  });

  it("has no duplicate commands", () => {
    const commands = COMMAND_HELP.map(entry => entry.command);
    expect(new Set(commands).size).toBe(commands.length);
  });

  it.each(["g", "gh", "lg", "cf", "=", "ai", "help"] as const)("documents %s", token => {
    expect(COMMAND_HELP.some(entry => entry.command === token || entry.command.startsWith(`${token} `))).toBe(true);
  });
});
