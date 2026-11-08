export type LuoguQuery =
  | { kind: "problem"; pid: string }
  | { kind: "keyword"; keyword: string };

const PROBLEM_PATTERN = /^[PBTU]\d{1,7}$/i;

export function parseLuoguQuery(query: string): LuoguQuery {
  const trimmed = query.trim();
  if (PROBLEM_PATTERN.test(trimmed)) {
    return { kind: "problem", pid: trimmed.toUpperCase() };
  }
  return { kind: "keyword", keyword: trimmed };
}
