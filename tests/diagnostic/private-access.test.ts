import { describe, expect, it, vi } from "vitest";
import { createGitHubPrivateAccess, GITHUB_PAT_KEY, type TokenStorage } from "../../src/core/diagnostic/private-access";

function memoryStorage(): TokenStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    async get(key) { return values.get(key); },
    async set(key, value) { values.set(key, value); },
    async remove(key) { values.delete(key); },
  };
}

describe("GitHub private access", () => {
  it("keeps the PAT in the injected session storage under a single key", async () => {
    const session = memoryStorage();
    const access = createGitHubPrivateAccess(session);

    await access.save("  github_pat_secret  ");

    expect(session.values.get(GITHUB_PAT_KEY)).toBe("github_pat_secret");
    expect(session.values.size).toBe(1);
    expect(await access.read()).toBe("github_pat_secret");
  });

  it("rejects blank, oversized, and whitespace-containing PATs without writing", async () => {
    const session = memoryStorage();
    const access = createGitHubPrivateAccess(session);

    await expect(access.save("   ")).rejects.toThrow(/PAT/);
    await expect(access.save("x".repeat(501))).rejects.toThrow(/PAT/);
    await expect(access.save("with space")).rejects.toThrow(/PAT/);
    expect(session.values.size).toBe(0);
    expect(await access.read()).toBe("");
  });

  it("removes only its own key", async () => {
    const session = memoryStorage();
    session.values.set("unrelated", "keep");
    const access = createGitHubPrivateAccess(session);
    await access.save("github_pat_secret");

    await access.remove();

    expect(await access.read()).toBe("");
    expect(session.values.get("unrelated")).toBe("keep");
    expect(session.values.has(GITHUB_PAT_KEY)).toBe(false);
  });
});
