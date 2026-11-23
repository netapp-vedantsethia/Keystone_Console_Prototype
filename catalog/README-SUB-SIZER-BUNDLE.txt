Subscription Engine — Sub Sizer + HW Configurator bundle
========================================================

1. Unzip this folder anywhere on your computer.

2. Start a local web server from INSIDE this folder (required for iframes and some features):

   npx http-server "." -p 3000 -c-1

   (If you do not have Node.js, install it from https://nodejs.org/ — or use any static file server.)

3. Open in your browser:

   http://localhost:3000/sizing.html

4. HW Configurator: use “Review hardware” (or the integrated flow) — it loads hw-configurator.html in a modal iframe.

Notes
-----
- Do not open these HTML files directly with file:// — use http:// as above.
- Optional Keystone Console static files live under console/ if included in this zip.
