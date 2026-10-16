import type { DiagnosticSource } from "./context-preview";

export type GitHubCodeDraft = {
  id: number;
  inputUrl: string;
  label: string;
  text: string;
  sourceUrl?: string;
  included: boolean;
  error: string;
  loading: boolean;
};

export function createGitHubCodeDraft(id: number): GitHubCodeDraft {
  return { id, inputUrl: "", label: "相关代码", text: "", included: true, error: "", loading: false };
}

export function updateGitHubCodeDraft(
  drafts: readonly GitHubCodeDraft[],
  id: number,
  update: Partial<Omit<GitHubCodeDraft, "id">>,
): GitHubCodeDraft[] {
  return drafts.map(draft => draft.id === id ? { ...draft, ...update } : draft);
}

export function removeGitHubCodeDraft(drafts: readonly GitHubCodeDraft[], id: number): GitHubCodeDraft[] {
  return drafts.filter(draft => draft.id !== id);
}

export function getSelectedGitHubCodeSources(drafts: readonly GitHubCodeDraft[]): DiagnosticSource[] {
  return drafts
    .filter(draft => draft.included && draft.text.trim())
    .map(draft => ({
      id: `github-${draft.id}`,
      kind: "code",
      label: draft.label,
      text: draft.text,
      ...(draft.sourceUrl ? { url: draft.sourceUrl } : {}),
    }));
}
