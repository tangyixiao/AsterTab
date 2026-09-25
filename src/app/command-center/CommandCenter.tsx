import type { JSX } from "preact";
import { useState } from "preact/hooks";
import { parseCommand } from "../../core/commands/parse-command";
import { buildSearchUrl } from "../../core/search/build-search-url";
import "./command-center.css";

export type CommandCenterProps = {
  onNavigate: (url: URL) => void;
};

export function CommandCenter({ onNavigate }: CommandCenterProps): JSX.Element {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("");

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
          setStatus("AI 尚未接入。");
          return;
        }
        if (result.kind === "error") {
          setStatus(result.code === "missing_query" ? "请输入搜索内容。" : "请输入 AI 请求内容。");
          return;
        }
        setStatus("");
      }}>
        <label for="command-input">搜索或输入命令</label>
        <input id="command-input" value={input} onInput={event => { setInput(event.currentTarget.value); setStatus(""); }} autoFocus />
        <button type="submit">搜索</button>
      </form>
      <p>g / gh / lg / ai</p>
      <p role="status">{status}</p>
    </main>
  );
}
