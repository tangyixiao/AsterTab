export type SearchTarget = "default" | "google" | "github" | "luogu";

export type SearchCommand = {
  kind: "search";
  target: SearchTarget;
  query: string;
};

export type ParsedCommand =
  | { kind: "empty" }
  | SearchCommand
  | { kind: "agent"; request: string }
  | { kind: "error"; code: "missing_query"; command: "g" | "gh" | "lg" }
  | { kind: "error"; code: "missing_agent_request"; command: "ai" };

export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim();
  if (!trimmed) return { kind: "empty" };
  const [, rawToken, rawRest = ""] = /^([^\s]+)(?:\s+([\s\S]*))?$/.exec(trimmed)!;
  const token = rawToken!.toLowerCase();
  const query = rawRest.trim();
  if (token === "ai") {
    return query ? { kind: "agent", request: query } : { kind: "error", code: "missing_agent_request", command: "ai" };
  }
  const target: SearchTarget | undefined = token === "g" ? "google" : token === "gh" ? "github" : token === "lg" ? "luogu" : undefined;
  if (target) {
    return query ? { kind: "search", target, query } : { kind: "error", code: "missing_query", command: token as "g" | "gh" | "lg" };
  }
  return { kind: "search", target: "default", query: trimmed };
}
