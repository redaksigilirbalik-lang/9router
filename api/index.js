// GET / — halaman status sederhana.
import { proxyKeyOk, readUpstreams } from "../lib/upstreams.js";

const html = (body) => `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>9Router — AI Router (Vercel)</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: #0b0f14; color: #e6edf3; }
  main { max-width: 760px; margin: 0 auto; padding: 48px 20px 80px; }
  .logo { font-size: 13px; letter-spacing: .14em; text-transform: uppercase; color: #7ee787; font-weight: 700; }
  h1 { font-size: 34px; margin: 10px 0 6px; }
  .sub { color: #8b949e; margin: 0 0 28px; line-height: 1.55; }
  .card { background: #12181f; border: 1px solid #232d38; border-radius: 12px; padding: 18px 20px; margin-bottom: 16px; }
  .card h2 { font-size: 15px; margin: 0 0 12px; color: #79c0ff; }
  table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid #1c2733; }
  th { color: #8b949e; font-weight: 600; }
  code { background: #1c2733; border: 1px solid #2a3744; border-radius: 6px; padding: 2px 7px; font-size: 12.5px; color: #ffd7a8; }
  pre { background: #0d141b; border: 1px solid #232d38; border-radius: 10px; padding: 14px 16px; overflow-x: auto; font-size: 12.5px; line-height: 1.6; }
  .ok { color: #7ee787; font-weight: 600; }
  .warn { color: #f2cc60; }
  .muted { color: #8b949e; }
</style>
</head>
<body>
<main>
  <div class="logo">9Router &middot; Lite</div>
  <h1>AI Router (Vercel)</h1>
  <p class="sub">Router OpenAI-compatible dengan fallback multi-provider &mdash; versi ringan dari
  <a href="https://github.com/decolua/9router" style="color:#79c0ff">9Router</a> untuk serverless.
  Endpoint utama: <code>/v1/chat/completions</code> (streaming), <code>/v1/responses</code>, <code>/v1/models</code>.</p>
  ${body}
</main>
</body>
</html>`;

export default function handler(req, res) {
  const base = `https://${req.headers.host || "your-app.vercel.app"}`;
  const upstreams = readUpstreams();

  const rows = upstreams.length
    ? upstreams
        .map(
          (u) =>
            `<tr><td><code>${u.id}</code></td><td>${u.name}</td><td><code>${u.prefix}/&lt;model&gt;</code></td><td class="ok">aktif</td></tr>`
        )
        .join("")
    : `<tr><td colspan="4" class="muted">Belum ada upstream — isi env API key (mis. <code>OPCODE_API_KEY</code>) lalu redeploy.</td></tr>`;

  const authNote = process.env.PROXY_API_KEY
    ? `<p class="ok">PROXY_API_KEY terpasang — endpoint /v1 aman.</p>`
    : `<p class="warn">⚠️ PROXY_API_KEY belum di-set — endpoint /v1 terbuka untuk siapa pun. Set env PROXY_API_KEY di Vercel.</p>`;

  const body = `
  <div class="card">
    <h2>Status upstream</h2>
    <table>
      <tr><th>ID</th><th>Nama</th><th>Model prefix</th><th>Status</th></tr>
      ${rows}
    </table>
  </div>
  <div class="card">
    <h2>Keamanan</h2>
    ${authNote}
  </div>
  <div class="card">
    <h2>Contoh pemakaian (curl)</h2>
    <pre>curl ${base}/v1/chat/completions \\
  -H "Authorization: Bearer &lt;PROXY_API_KEY&gt;" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"oc/claude-opus-4-8","messages":[{"role":"user","content":"Halo"}]}'</pre>
    <p class="muted" style="font-size:12.5px">Model ber-prefix (mis. <code>oc/&lt;model&gt;</code> untuk OpenCode Free) di-route ke upstream-nya;
    tanpa prefix, request dicoba ke semua upstream secara urut (fallback otomatis saat rate-limit/error).</p>
  </div>
  <div class="card">
    <h2>Konfigurasi tools AI</h2>
    <table>
      <tr><th>Setting</th><th>Nilai</th></tr>
      <tr><td>Base URL</td><td><code>${base}/v1</code></td></tr>
      <tr><td>API Key</td><td><code>&lt;PROXY_API_KEY&gt;</code> (dari env Vercel)</td></tr>
      <tr><td>Model</td><td><code>oc/claude-opus-4-8</code>, <code>or/&lt;model&gt;</code>, <code>glm/&lt;model&gt;</code>, ...</td></tr>
    </table>
  </div>`;

  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html(body));
}
