// POST /v1/responses — OpenAI Responses API, passthrough + fallback multi-provider.
// (Dipakai Codex CLI & beberapa tools 2026; upstream yang tidak mendukung akan
//  dikembalikan 404/400 dan dilewati saat fallback.)
import { Readable } from "node:stream";
import {
  CORS,
  handlePreflight,
  proxyKeyOk,
  readBody,
  resolveCandidates,
  tryUpstream,
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

  if (req.method !== "POST") {
    res.writeHead(405, { ...CORS, "content-type": "application/json" });
    res.end(
      JSON.stringify({ error: { message: "Method not allowed. Use POST.", type: "method_error" } })
    );
    return;
  }

  let payload;
  try {
    payload = await readBody(req);
  } catch {
    res.writeHead(400, { ...CORS, "content-type": "application/json" });
    res.end(
      JSON.stringify({
        error: { message: "Request body bukan JSON valid.", type: "invalid_request_error" },
      })
    );
    return;
  }

  const model = payload.model || process.env.DEFAULT_MODEL || "";
  const stream = payload.stream === true;
  const candidates = resolveCandidates(model);

  if (!candidates.length) {
    res.writeHead(503, { ...CORS, "content-type": "application/json" });
    res.end(
      JSON.stringify({
        error: {
          message: "Tidak ada upstream terkonfigurasi. Isi env API key dulu (lihat README).",
          type: "no_upstream",
        },
      })
    );
    return;
  }

  const controller = new AbortController();
  req.on("close", () => controller.abort());

  const errors = [];

  for (const { upstream, model: m } of candidates) {
    const body = { ...payload, model: m };
    const r = await tryUpstream(upstream, "/responses", body, {
      stream,
      signal: controller.signal,
    });

    if (r.ok) {
      res.setHeader("x-9router-upstream", upstream.id);
      if (!stream) {
        const text = await new Response(r.body).text();
        res.writeHead(r.status, { ...CORS, "content-type": r.contentType || "application/json" });
        res.end(text);
        return;
      }
      res.writeHead(r.status, {
        ...CORS,
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });
      res.flushHeaders?.();
      Readable.fromWeb(r.body).pipe(res);
      return;
    }

    // 404 = upstream tidak punya /responses -> lewati, lanjut fallback.
    if ([400, 422].includes(r.status)) {
      res.setHeader("x-9router-upstream", upstream.id);
      res.writeHead(r.status, { ...CORS, "content-type": "application/json" });
      res.end(
        r.errorText ||
          JSON.stringify({
            error: { message: `Upstream ${upstream.id} menolak request.`, type: "upstream_error" },
          })
      );
      return;
    }

    errors.push(
      `${upstream.id} -> HTTP ${r.status || "network error"} ${r.errorText ? r.errorText.slice(0, 160) : ""}`.trim()
    );
  }

  res.writeHead(502, { ...CORS, "content-type": "application/json" });
  res.end(
    JSON.stringify({
      error: {
        message: `Semua upstream gagal. [${errors.join(" | ")}]`,
        type: "all_upstreams_failed",
      },
    })
  );
}
