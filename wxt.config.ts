import preact from "@preact/preset-vite";
import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "AsterTab",
    description: "Don't replace your tools. Connect them.",
  },
  vite: () => ({ plugins: [preact({ reactAliasesEnabled: false })] }),
});
