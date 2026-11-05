export type TokenStorage = {
  get(key: string): Promise<unknown>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
};

export const GITHUB_PAT_KEY = "githubPrivatePat";

export function createGitHubPrivateAccess(session: TokenStorage) {
  return {
    async save(pat: string): Promise<void> {
      const value = pat.trim();
      if (!value || value.length > 500 || /\s/.test(value)) {
        throw new Error("请填写有效的 GitHub 细粒度 PAT。");
      }
      await session.set(GITHUB_PAT_KEY, value);
    },

    async read(): Promise<string> {
      const value = await session.get(GITHUB_PAT_KEY);
      return typeof value === "string" ? value : "";
    },

    async remove(): Promise<void> {
      await session.remove(GITHUB_PAT_KEY);
    },
  };
}
