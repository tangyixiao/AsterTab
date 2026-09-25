import { render } from "preact";
import { CommandCenter } from "../../src/app/command-center/CommandCenter";

const root = document.getElementById("app");
if (!root) throw new Error("Missing #app mount node");
render(<CommandCenter onNavigate={url => window.location.assign(url.href)} />, root);
