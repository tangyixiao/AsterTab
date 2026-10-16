import { describe, expect, it } from "vitest";
import { isCurrentConfirmedRequest } from "../../src/core/diagnostic/confirmed-request";

describe("confirmed diagnostic request gate", () => {
  it("allows only the active payload that is still explicitly confirmed", () => {
    expect(isCurrentConfirmedRequest("body A", "body A", "body A", true)).toBe(true);
  });

  it("rejects a payload changed while the permission prompt was open", () => {
    expect(isCurrentConfirmedRequest("body A", "body B", "body A", true)).toBe(false);
  });

  it("rejects a confirmation the user unchecked while the permission prompt was open", () => {
    expect(isCurrentConfirmedRequest("body A", "body A", "", true)).toBe(false);
  });

  it("rejects a request after the draft was closed", () => {
    expect(isCurrentConfirmedRequest("body A", "body A", "body A", false)).toBe(false);
  });
});
