/**
 * Copies the Vite React build from console-module into ./console/ so static
 * servers (e.g. http-server) serve the same bundle Vite produced.
 *
 * Run from repo root (this folder's parent):
 *   node scripts/sync-console-from-vite.mjs
 *
 * Prerequisite: built dist in console-module:
 *   cd ../../../console-module/Console_Figma_Prototype_v2 && npm ci && npm run build
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gartnerRoot = path.resolve(__dirname, "..");
const srcDist = path.resolve(
  gartnerRoot,
  "..",
  "..",
  "console-module",
  "Console_Figma_Prototype_v2",
  "dist",
);
const destConsole = path.resolve(gartnerRoot, "console");

if (!fs.existsSync(path.join(srcDist, "index.html"))) {
  console.error(
    "[sync-console] Missing dist. Build it first:\n" +
      "  cd console-module/Console_Figma_Prototype_v2\n" +
      "  npm ci && npm run build",
  );
  process.exit(1);
}

fs.mkdirSync(destConsole, { recursive: true });
fs.cpSync(srcDist, destConsole, { recursive: true, force: true });

const indexPath = path.join(destConsole, "index.html");
let html = fs.readFileSync(indexPath, "utf8");
html = html.replace(/\s+crossorigin/g, "");

const cssMatch = html.match(
  /<link[^>]+rel="stylesheet"[^>]*href="(\.\/assets\/[^"]+\.css)"[^>]*>/i,
);
let cssRel = "assets/index-C1ope1MW.css";
if (cssMatch) {
  html = html.replace(cssMatch[0], "");
  cssRel = cssMatch[1].replace(/^\.\//, "");
}

const modMatch = html.match(
  /<script\s+type="module"[^>]*src="(\.\/assets\/[^"]+)"[^>]*>\s*<\/script>/i,
);
let bundleRel = "assets/index-C7mOTlDT.js";
if (modMatch) {
  html = html.replace(modMatch[0], "");
  bundleRel = modMatch[1].replace(/^\.\//, "");
}

// Load CSS + JS from absolute URLs derived from this page (no <base>, no fragile ./ in head).
const bootScript = `    <script type="module">
      (function () {
        var root = document.getElementById("root");
        if (!root) {
          document.body.insertAdjacentHTML(
            "beforeend",
            "<p style=\\"padding:24px;font-family:system-ui\\">Missing #root — index.html is malformed.</p>",
          );
          return;
        }
        if (location.protocol === "file:") {
          root.innerHTML =
            "<p style=\\"padding:24px;font-family:system-ui;line-height:1.6\\">This React Console must be opened over <strong>http://</strong> (not a <code>file://</code> path).<br/><br/>From the repo folder run: <code>npx http-server \\".\\" -p 3000 -c-1</code> then open <code>/console/index.html</code> under that server.</p>";
          return;
        }
        var pageBase = new URL(".", location.href).href;
        var cssUrl = new URL("${cssRel}", pageBase).href;
        var jsUrl = new URL("${bundleRel}", pageBase).href;
        var link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = cssUrl;
        document.head.appendChild(link);
        root.innerHTML =
          '<p style="padding:24px;font-family:system-ui;color:#666">Loading Console…</p>';
        import(jsUrl).catch(function (err) {
          console.error("[NetApp Console] bundle import failed", err);
          root.innerHTML =
            "<div style=\\"padding:24px;font-family:system-ui;max-width:640px\\"><h1 style=\\"color:#b91c1c;font-size:1.125rem;margin:0 0 12px\\">Console bundle did not run</h1><p style=\\"color:#444;margin:0 0 12px\\">Confirm Network shows <strong>200</strong> for the large <code>.js</code> file (and CSS). Try <code>npm run console:preview</code> on port <strong>4173</strong> and set <code>window.NETAPP_CONSOLE_URL = 'http://127.0.0.1:4173/'</code>.</p><pre style=\\"background:#f5f5f5;padding:12px;font-size:11px;overflow:auto;border:1px solid #e5e5e5\\">" +
            String((err && err.stack) || err).replace(/</g, "&lt;") +
            "</pre></div>";
        });
      })();
    </script>
`;
html = html.replace(/<\/body>/i, bootScript + "\n  </body>");

const returnStrip = `
    <div id="sub-sizer-console-return-bar" aria-label="Return to Subscription Engine" style="display:none;position:fixed;top:0;left:0;right:0;z-index:99999;box-sizing:border-box;background:#fff;border-bottom:1px solid #e0e0e0;padding:10px 20px;font-family:system-ui,sans-serif;font-size:14px">
      <a href="#" id="sub-sizer-console-return-link" style="color:#0067c5;font-weight:600;text-decoration:none">← Back to Subscription Engine</a>
    </div>
    <script>
      (function () {
        function fallbackReturnUrl() {
          var p = window.location.pathname || "/";
          var lower = p.toLowerCase();
          var idx = lower.indexOf("/console/");
          var basePath = idx >= 0 ? p.slice(0, idx + 1) : (p.replace(/[^/]*$/, "") || "/");
          if (basePath.slice(-1) !== "/") basePath += "/";
          return window.location.origin + basePath + "sales-dashboard.html";
        }
        try {
          var raw = sessionStorage.getItem("subSizerConsoleContext");
          if (!raw) return;
          var ctx = JSON.parse(raw);
          var returnUrl = (ctx && ctx.returnUrl) ? String(ctx.returnUrl) : fallbackReturnUrl();
          var bar = document.getElementById("sub-sizer-console-return-bar");
          var link = document.getElementById("sub-sizer-console-return-link");
          if (!bar || !link) return;
          link.setAttribute("href", returnUrl);
          bar.style.display = "flex";
          document.body.style.paddingTop = "48px";
        } catch (e) {}
      })();
    </script>
`;
html = html.replace("<body>", "<body>" + returnStrip);
fs.writeFileSync(indexPath, html, "utf8");

console.log("[sync-console] OK →", destConsole);
