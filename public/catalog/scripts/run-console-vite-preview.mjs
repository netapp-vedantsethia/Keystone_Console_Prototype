/**
 * Serves the built Console with Vite's preview server (correct MIME + SPA behavior).
 * Run from Gartner updated repo: node scripts/run-console-vite-preview.mjs
 * Then open http://127.0.0.1:4173/ and optionally set window.NETAPP_CONSOLE_URL in sales-dashboard.
 */
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const vit = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "console-module",
  "Console_Figma_Prototype_v2",
);

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["vite", "preview", "--host", "127.0.0.1", "--port", "4173", "--strictPort"],
  {
    cwd: vit,
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);

child.on("exit", (code) => process.exit(code ?? 0));
