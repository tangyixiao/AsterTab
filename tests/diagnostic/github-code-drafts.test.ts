import { describe, expect, it } from "vitest";
import {
  createGitHubCodeDraft,
  getSelectedGitHubCodeSources,
  removeGitHubCodeDraft,
  updateGitHubCodeDraft,
} from "../../src/core/diagnostic/github-code-drafts";

describe("GitHub code drafts", () => {
  it("creates independently identifiable empty source drafts", () => {
    expect(createGitHubCodeDraft(3)).toEqual({
      id: 3,
      inputUrl: "",
      label: "相关代码",
      text: "",
      included: true,
      error: "",
      loading: false,
    });
  });

  it("updates only the matching draft without mutating the list", () => {
    const drafts = [createGitHubCodeDraft(1), createGitHubCodeDraft(2)];

    const updated = updateGitHubCodeDraft(drafts, 2, { label: "solver.cpp", text: "int main() {}" });

    expect(updated[0]).toEqual(drafts[0]);
    expect(updated[1]).toMatchObject({ id: 2, label: "solver.cpp", text: "int main() {}" });
    expect(drafts[1]?.text).toBe("");
  });

  it("keeps included code files in order and omits unchecked or empty files", () => {
    const drafts = [
      ...updateGitHubCodeDraft([createGitHubCodeDraft(1)], 1, {
        label: "solver.cpp",
        text: "int solve() {}",
        sourceUrl: "https://github.com/user/repo/blob/abc/solver.cpp",
      }),
      ...updateGitHubCodeDraft([createGitHubCodeDraft(2)], 2, { label: "notes", text: "先尝试贪心", included: false }),
      createGitHubCodeDraft(3),
      ...updateGitHubCodeDraft([createGitHubCodeDraft(4)], 4, { label: "check.cpp", text: "bool check() {}" }),
    ];

    expect(getSelectedGitHubCodeSources(drafts)).toEqual([
      {
        id: "github-1",
        kind: "code",
        label: "solver.cpp",
        text: "int solve() {}",
        url: "https://github.com/user/repo/blob/abc/solver.cpp",
      },
      { id: "github-4", kind: "code", label: "check.cpp", text: "bool check() {}" },
    ]);
  });

  it("removes only the requested file from the draft list", () => {
    const drafts = [createGitHubCodeDraft(1), createGitHubCodeDraft(2), createGitHubCodeDraft(3)];

    expect(removeGitHubCodeDraft(drafts, 2).map(draft => draft.id)).toEqual([1, 3]);
    expect(drafts.map(draft => draft.id)).toEqual([1, 2, 3]);
  });
});
