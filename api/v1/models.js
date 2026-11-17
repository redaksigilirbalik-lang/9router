// GET /v1/models — daftar model semua upstream (dengan prefix).
import {
  CORS,
  handlePreflight,
  proxyKeyOk,
  readUpstreams,
  listModels,
} from "../../lib/upstreams.js";

export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;

  if (!proxyKeyOk(req)) {
    res.writeHead(401, { ...CORS, "content-type": "application/json" });
    res.end(
      JSON.stringify({
        error: { message: "Invalid proxy API key. Set PROXY_API_KEY di Vercel.", type: "auth_error" },
      })
    );
    return;
  }

  if (req.method !== "GET") {
    res.writeHead(405, { ...CORS, "content-type": "application/json" });
    res.end(
      JSON.stringify({ error: { message: "Method not allowed. Use GET.", type: "method_error" } })
    );
    return;
  }

  const upstreams = readUpstreams();
  const data = [];
  const now = Math.floor(Date.now() / 1000);

  for (const u of upstreams) {
    const ids = await listModels(u);
    for (const id of ids) {
      data.push({ id: `${u.prefix}/${id}`, object: "model", created: now, owned_by: u.id });
    }
  }

  res.writeHead(200, { ...CORS, "content-type": "application/json" });
  res.end(JSON.stringify({ object: "list", data }));
}
