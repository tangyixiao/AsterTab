import type { DiagnosticSource } from "./context-preview";

export type SubmissionDraft = {
  id: number;
  url: string;
  label: string;
  text: string;
  included: boolean;
};

export function createSubmissionDraft(id: number): SubmissionDraft {
  return { id, url: "", label: "选定提交与评测反馈", text: "", included: true };
}

export function updateSubmissionDraft(
  drafts: readonly SubmissionDraft[],
  id: number,
  update: Partial<Omit<SubmissionDraft, "id">>,
): SubmissionDraft[] {
  return drafts.map(draft => draft.id === id ? { ...draft, ...update } : draft);
}

export function removeSubmissionDraft(drafts: readonly SubmissionDraft[], id: number): SubmissionDraft[] {
  return drafts.filter(draft => draft.id !== id);
}

export function getSelectedSubmissionSources(drafts: readonly SubmissionDraft[]): DiagnosticSource[] {
  return drafts
    .filter(draft => draft.included && draft.text.trim())
    .map(draft => ({
      id: `submission-${draft.id}`,
      kind: "submission",
      label: draft.label,
      text: draft.text,
      ...(draft.url.trim() ? { url: draft.url } : {}),
    }));
}
