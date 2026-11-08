export type SearchTarget = "default" | "google" | "github" | "luogu" | "codeforces";

export type SearchCommand = {
  kind: "search";
  target: SearchTarget;
  query: string;
};

export type ParsedCommand =
  | { kind: "empty" }
  | SearchCommand
  | { kind: "agent"; request: string }
  | { kind: "help" }
  | { kind: "calc"; expression: string }
  | { kind: "error"; code: "missing_query"; command: "g" | "gh" | "lg" | "cf" }
  | { kind: "error"; code: "missing_agent_request"; command: "ai" }
  | { kind: "error"; code: "missing_expression" };

export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim();
  if (!trimmed) return { kind: "empty" };
  if (trimmed.startsWith("=")) {
    const expression = trimmed.slice(1).trim();
    return expression ? { kind: "calc", expression } : { kind: "error", code: "missing_expression" };
  }
  const [, rawToken, rawRest = ""] = /^([^\s]+)(?:\s+([\s\S]*))?$/.exec(trimmed)!;
  const token = rawToken!.toLowerCase();
  const query = rawRest.trim();
  if ((token === "help" || token === "?") && !query) {
    return { kind: "help" };
  }
  if (token === "ai") {
    return query ? { kind: "agent", request: query } : { kind: "error", code: "missing_agent_request", command: "ai" };
  }
  if (token === "calc") {
    return query ? { kind: "calc", expression: query } : { kind: "error", code: "missing_expression" };
  }
  const target: SearchTarget | undefined = token === "g" ? "google" : token === "gh" ? "github" : token === "lg" ? "luogu" : token === "cf" ? "codeforces" : undefined;
  if (target) {
    return query ? { kind: "search", target, query } : { kind: "error", code: "missing_query", command: token as "g" | "gh" | "lg" | "cf" };
  }
  return { kind: "search", target: "default", query: trimmed };
}
