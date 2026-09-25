import type { JSX } from "preact";
import "./command-center.css";

export function CommandCenter(): JSX.Element {
  return <main><label for="command-input">搜索或输入命令</label><input id="command-input" autoFocus /><p>g / gh / lg / ai</p></main>;
}
