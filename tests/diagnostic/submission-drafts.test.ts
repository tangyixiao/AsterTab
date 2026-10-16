import { describe, expect, it } from "vitest";
import {
  createSubmissionDraft,
  getSelectedSubmissionSources,
  removeSubmissionDraft,
  updateSubmissionDraft,
} from "../../src/core/diagnostic/submission-drafts";

describe("submission drafts", () => {
  it("creates an empty submission entry", () => {
    expect(createSubmissionDraft(3)).toEqual({
      id: 3,
      url: "",
      label: "选定提交与评测反馈",
      text: "",
      included: true,
    });
  });

  it("updates only the matching entry without mutating the list", () => {
    const drafts = [createSubmissionDraft(1), createSubmissionDraft(2)];

    const updated = updateSubmissionDraft(drafts, 2, { label: "第二次提交", text: "WA on test 5" });

    expect(updated[0]).toEqual(drafts[0]);
    expect(updated[1]).toMatchObject({ id: 2, label: "第二次提交", text: "WA on test 5" });
    expect(drafts[1]?.text).toBe("");
  });

  it("preserves selected submission links and omits unchecked or empty entries", () => {
    const drafts = [
      ...updateSubmissionDraft([createSubmissionDraft(1)], 1, {
        label: "第一次 WA",
        url: "https://www.luogu.com.cn/record/123456",
        text: "WA on test 2",
      }),
      ...updateSubmissionDraft([createSubmissionDraft(2)], 2, { label: "已排除", text: "TLE", included: false }),
      createSubmissionDraft(3),
      ...updateSubmissionDraft([createSubmissionDraft(4)], 4, { label: "本地调试", text: "边界数据未覆盖" }),
    ];

    expect(getSelectedSubmissionSources(drafts)).toEqual([
      {
        id: "submission-1",
        kind: "submission",
        label: "第一次 WA",
        text: "WA on test 2",
        url: "https://www.luogu.com.cn/record/123456",
      },
      { id: "submission-4", kind: "submission", label: "本地调试", text: "边界数据未覆盖" },
    ]);
  });

  it("removes only the requested submission entry", () => {
    const drafts = [createSubmissionDraft(1), createSubmissionDraft(2), createSubmissionDraft(3)];

    expect(removeSubmissionDraft(drafts, 2).map(draft => draft.id)).toEqual([1, 3]);
    expect(drafts.map(draft => draft.id)).toEqual([1, 2, 3]);
  });
});
