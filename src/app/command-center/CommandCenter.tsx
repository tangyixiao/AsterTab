import type { JSX } from "preact";
import { useState } from "preact/hooks";
import { evaluateExpression } from "../../core/commands/calc";
import { COMMAND_HELP } from "../../core/commands/command-help";
import { parseCommand } from "../../core/commands/parse-command";
import { buildSearchUrl } from "../../core/search/build-search-url";
import { DiagnosticDraft } from "../diagnostic/DiagnosticDraft";
import "./command-center.css";

export type CommandCenterProps = {
  onNavigate: (url: URL) => void;
};

export function CommandCenter({ onNavigate }: CommandCenterProps): JSX.Element {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [agentRequest, setAgentRequest] = useState<string | null>(null);

  if (agentRequest !== null) {
    return <DiagnosticDraft request={agentRequest} onClose={() => { setAgentRequest(null); setInput(""); setStatus(""); setShowHelp(false); }} />;
  }

  return (
    <main>
      <form onSubmit={event => {
        event.preventDefault();
        const result = parseCommand(input);
        if (result.kind === "search") {
          onNavigate(buildSearchUrl(result));
          return;
        }
        if (result.kind === "agent") {
          setAgentRequest(result.request);
          return;
        }
        if (result.kind === "help") {
          setShowHelp(true);
          setStatus("");
          return;
        }
        if (result.kind === "calc") {
          setShowHelp(false);
          const outcome = evaluateExpression(result.expression);
          setStatus(outcome.kind === "ok" ? `${result.expression} = ${outcome.display}` : outcome.message);
          return;
        }
        if (result.kind === "error") {
          setShowHelp(false);
          setStatus(result.code === "missing_query" ? "请输入搜索内容。" : result.code === "missing_expression" ? "请输入要计算的表达式。" : "请输入 AI 请求内容。");
          return;
        }
        setStatus("");
      }}>
        <label for="command-input">搜索或输入命令</label>
        <input id="command-input" value={input} onInput={event => { setInput(event.currentTarget.value); setStatus(""); setShowHelp(false); }} autoFocus />
        <button type="submit">搜索</button>
      </form>
      <p>g / gh / lg / cf / = / ai / help</p>
      {showHelp && (
        <ul>
          {COMMAND_HELP.map(entry => (
            <li key={entry.command}><code>{entry.command}</code> — {entry.description}</li>
          ))}
        </ul>
      )}
      <p role="status">{status}</p>
    </main>
  );
}
