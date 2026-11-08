export type CodeforcesQuery =
  | { kind: "problem"; contest: string; index: string }
  | { kind: "handle"; handle: string };

const PROBLEM_PATTERN = /^(\d{1,6})\/?([A-Za-z]\d{0,2})$/;

export function parseCodeforcesQuery(query: string): CodeforcesQuery {
  const trimmed = query.trim();
  const problem = PROBLEM_PATTERN.exec(trimmed);
  if (problem) {
    return { kind: "problem", contest: problem[1]!, index: problem[2]!.toUpperCase() };
  }
  return { kind: "handle", handle: trimmed };
}
