import { describe, expect, it } from "vitest";
import { createOpenRouterSettings, type SettingsStorage } from "../../src/integrations/ai/openrouter-settings";

function memoryStorage(): SettingsStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    async get(key) { return values.get(key); },
    async set(key, value) { values.set(key, value); },
    async remove(key) { values.delete(key); },
  };
}

describe("OpenRouter settings", () => {
  it("keeps the API key in session storage and never returns it in the settings summary", async () => {
    const local = memoryStorage();
    const session = memoryStorage();
    const settings = createOpenRouterSettings(local, session);

    await settings.saveApiKey("sk-or-test-secret");

    expect(session.values.get("openrouterApiKey")).toBe("sk-or-test-secret");
    expect(local.values.has("openrouterApiKey")).toBe(false);
    expect(await settings.load()).toEqual({ modelId: "", hasApiKey: true });
    expect(await settings.readApiKey()).toBe("sk-or-test-secret");
  });

  it("keeps the selected model in local settings storage without syncing it", async () => {
    const local = memoryStorage();
    const session = memoryStorage();
    const settings = createOpenRouterSettings(local, session);

    await settings.saveModelId("  provider/model  ");

    expect(local.values.get("openrouterModelId")).toBe("provider/model");
    expect(session.values.has("openrouterModelId")).toBe(false);
    expect(await settings.load()).toEqual({ modelId: "provider/model", hasApiKey: false });
  });

  it("removes only the session API key and rejects blank keys", async () => {
    const local = memoryStorage();
    const session = memoryStorage();
    const settings = createOpenRouterSettings(local, session);
    await settings.saveApiKey("sk-or-test-secret");
    await settings.saveModelId("provider/model");

    await settings.removeApiKey();

    expect(await settings.readApiKey()).toBe("");
    expect(local.values.get("openrouterModelId")).toBe("provider/model");
    await expect(settings.saveApiKey("  ")).rejects.toThrow(/API key/);
  });
});
