export type SettingsStorage = {
  get(key: string): Promise<unknown>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
};

export type OpenRouterSettingsSummary = {
  modelId: string;
  hasApiKey: boolean;
};

const MODEL_ID_KEY = "openrouterModelId";
const API_KEY_KEY = "openrouterApiKey";

export function createOpenRouterSettings(local: SettingsStorage, session: SettingsStorage) {
  return {
    async load(): Promise<OpenRouterSettingsSummary> {
      const [modelValue, keyValue] = await Promise.all([
        local.get(MODEL_ID_KEY),
        session.get(API_KEY_KEY),
      ]);
      return {
        modelId: typeof modelValue === "string" ? modelValue : "",
        hasApiKey: typeof keyValue === "string" && keyValue.trim().length > 0,
      };
    },

    async saveModelId(modelId: string): Promise<void> {
      const value = modelId.trim();
      if (!value || value.length > 200 || /[\s\u0000-\u001f]/.test(value)) {
        throw new Error("请填写有效的 OpenRouter 模型 ID。");
      }
      await local.set(MODEL_ID_KEY, value);
    },

    async saveApiKey(apiKey: string): Promise<void> {
      const value = apiKey.trim();
      if (!value || value.length > 500 || /\s/.test(value)) {
        throw new Error("请填写有效的 OpenRouter API key。");
      }
      await session.set(API_KEY_KEY, value);
    },

    async readApiKey(): Promise<string> {
      const value = await session.get(API_KEY_KEY);
      return typeof value === "string" ? value : "";
    },

    async removeApiKey(): Promise<void> {
      await session.remove(API_KEY_KEY);
    },
  };
}
