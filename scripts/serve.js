/**
 * Dev server lokal — memetakan route sama persis seperti vercel.json
 * (tanpa perlu Vercel CLI). Jalankan: npm run dev
 */
import http from "node:http";

const handlers = {
  "/": (await import("../api/index.js")).default,
  "/v1/chat/completions": (await import("../api/v1/chat/completions.js")).default,
  "/v1/responses": (await import("../api/v1/responses.js")).default,
  "/v1/models": (await import("../api/v1/models.js")).default,
};

const PORT = Number(process.env.PORT || 9100);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const handler = handlers[url.pathname];
  if (!handler) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { message: `Route tidak dikenal: ${url.pathname}` } }));
    return;
  }
  try {
    await handler(req, res);
  } catch (e) {
    console.error("[9router] handler error:", e);
    if (!res.headersSent) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { message: String(e?.message || e) } }));
    } else {
      res.end();
    }
  }
});

server.listen(PORT, "0.0.0.0", () => {
  const ups = Object.keys(process.env).filter((k) => /_API_KEY$/.test(k) && process.env[k]);
  console.log(`[9router] dev server  ->  http://localhost:${PORT}`);
  console.log(`[9router] upstream env -> ${ups.length ? ups.join(", ") : "(belum ada — isi .env dari .env.example)"}`);
});
