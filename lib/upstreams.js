/**
 * 9Router Lite untuk Vercel — konfigurasi upstream & utilitas bersama.
 * Zero-dependency: hanya memakai fetch (Node 18+) + modul bawaan Node.
 */

import crypto from "node:crypto";

/**
 * Preset provider OpenAI-compatible.
 * Sebuah preset aktif otomatis begitu env var kunci API-nya terisi.
 * Urutan di sini = urutan default fallback (bisa diubah lewat UPSTREAM_ORDER).
 */
const PRESETS = [
  { env: "OPCODE_API_KEY", upstream: { id: "opencode", prefix: "oc", name: "OpenCode Free (zen)", baseUrl: "https://opencode.ai/zen/v1" } },
  { env: "OPENROUTER_API_KEY", upstream: { id: "openrouter", prefix: "or", name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1" } },
  { env: "GLM_API_KEY", upstream: { id: "glm", prefix: "glm", name: "GLM (Zhipu AI)", baseUrl: "https://open.bigmodel.cn/api/paas/v4" } },
  { env: "DEEPSEEK_API_KEY", upstream: { id: "deepseek", prefix: "ds", name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1" } },
  { env: "GROQ_API_KEY", upstream: { id: "groq", prefix: "groq", name: "Groq", baseUrl: "https://api.groq.com/openai/v1" } },
  { env: "SILICONFLOW_API_KEY", upstream: { id: "siliconflow", prefix: "sf", name: "SiliconFlow", baseUrl: "https://api.siliconflow.cn/v1" } },
  { env: "MISTRAL_API_KEY", upstream: { id: "mistral", prefix: "mistral", name: "Mistral AI", baseUrl: "https://api.mistral.ai/v1" } },
  { env: "XAI_API_KEY", upstream: { id: "xai", prefix: "xai", name: "xAI (Grok)", baseUrl: "https://api.x.ai/v1" } },
  { env: "OPENAI_API_KEY", upstream: { id: "openai", prefix: "oa", name: "OpenAI", baseUrl: "https://api.openai.com/v1" } },
];

const stripSlash = (s) => (s || "").replace(/\/+$/, "");

/** Gabungkan semua sumber konfigurasi upstream: preset + UPSTREAMS + UPSTREAM_N_*. */
export function readUpstreams() {
  const byId = new Map();

  const add = (u) => {
    if (!u || !u.baseUrl) return;
    const clean = {
      id: String(u.id || u.name || "upstream").toLowerCase().replace(/[^a-z0-9_-]/g, "-"),
      name: u.name || u.id,
      prefix: (u.prefix || "").toLowerCase().replace(/[^a-z0-9_-]/g, "") || "up",
      baseUrl: stripSlash(u.baseUrl),
      apiKey: String(u.apiKey || ""),
      models: Array.isArray(u.models) ? u.models.filter((m) => typeof m === "string") : [],
    };
    if (!byId.has(clean.id)) byId.set(clean.id, clean);
  };

  // 1) Preset — aktif hanya kalau env key-nya diisi
  for (const { env, upstream } of PRESETS) {
    if (process.env[env]) add({ ...upstream, apiKey: process.env[env] });
  }

  // 2) UPSTREAMS — JSON array untuk kontrol penuh
  if (process.env.UPSTREAMS) {
    try {
      for (const u of JSON.parse(process.env.UPSTREAMS)) add(u);
    } catch {
      console.error("[9router] UPSTREAMS bukan JSON valid — dilewati.");
    }
  }

  // 3) UPSTREAM_N_URL / UPSTREAM_N_API_KEY / ... (hingga 20)
  for (let i = 1; i <= 20; i++) {
    const url = process.env[`UPSTREAM_${i}_URL`];
    if (!url) continue;
    add({
      id: process.env[`UPSTREAM_${i}_ID`] || `upstream-${i}`,
      name: process.env[`UPSTREAM_${i}_NAME`] || `Upstream ${i}`,
      prefix: process.env[`UPSTREAM_${i}_PREFIX`] || `u${i}`,
      baseUrl: url,
      apiKey: process.env[`UPSTREAM_${i}_API_KEY`] || "",
      models: (process.env[`UPSTREAM_${i}_MODELS`] || "")
        .split(",").map((s) => s.trim()).filter(Boolean),
    });
  }

  const list = [...byId.values()];

  // 4) UPSTREAM_ORDER — kontrol prioritas fallback, mis. "glm,opencode,openrouter"
  if (process.env.UPSTREAM_ORDER) {
    const order = process.env.UPSTREAM_ORDER.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    list.sort((a, b) => {
      const ia = order.indexOf(a.id);
      const ib = order.indexOf(b.id);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  }
  return list;
}

/**
 * Tentukan kandidat upstream untuk sebuah model.
 * - Model ber-prefix ("oc/claude-opus-4-8") -> upstream dengan prefix tsb
 *   DIUTAMAKAN; bila gagal, fallback tetap lanjut ke upstream lain
 *   (dengan nama model yang sudah di-strip prefix-nya).
 * - Tanpa prefix -> semua upstream sesuai urutan (fallback penuh).
 */
export function resolveCandidates(model) {
  const upstreams = readUpstreams();
  if (!upstreams.length) return [];
  const m = String(model || "").trim();
  if (m.includes("/")) {
    const idx = m.indexOf("/");
    const prefix = m.slice(0, idx).toLowerCase();
    const rest = m.slice(idx + 1);
    const hit = upstreams.find((u) => u.prefix === prefix);
    if (hit) {
      const others = upstreams.filter((u) => u.prefix !== prefix);
      return [{ upstream: hit, model: rest }, ...others.map((u) => ({ upstream: u, model: rest }))];
    }
  }
  return upstreams.map((upstream) => ({ upstream, model: m }));
}

/** Cek Authorization header terhadap PROXY_API_KEY (kalau di-set). */
export function proxyKeyOk(req) {
  const expected = process.env.PROXY_API_KEY;
  if (!expected) return true; // opsional — tapi baca README soal risikonya
  const auth = req.headers.authorization || "";
  const got = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  if (!got) return false;
  const a = crypto.createHash("sha256").update(got).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-request-id",
  "Access-Control-Max-Age": "86400",
};

/** Tangani preflight OPTIONS; return true kalau sudah ditangani. */
export function handlePreflight(req, res) {
  if (req.method !== "OPTIONS") return false;
  res.writeHead(204, CORS);
  res.end();
  return true;
}

/** Baca body JSON dari request. */
export function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

/**
 * Teruskan satu request ke satu upstream.
 * Return: { ok, status, errorText?, contentType?, body? } — body adalah web
 * ReadableStream kalau ok && stream=true.
 */
export async function tryUpstream(upstream, path, bodyJson, { stream = false, signal } = {}) {
  const url = upstream.baseUrl + path;
  const headers = { "content-type": "application/json" };
  if (upstream.apiKey) headers.authorization = `Bearer ${upstream.apiKey}`;
  if (stream) headers.accept = "text/event-stream";
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(bodyJson),
      signal,
    });
    if (!resp.ok) {
      const errorText = await resp.text().catch(() => "");
      return { ok: false, status: resp.status, errorText };
    }
    return {
      ok: true,
      status: resp.status,
      contentType: resp.headers.get("content-type") || "",
      body: resp.body,
    };
  } catch (e) {
    return { ok: false, status: 0, errorText: String(e && e.message ? e.message : e) };
  }
}

const modelsCache = new Map(); // upstreamId -> { ts, models: string[] }
const MODELS_TTL_MS = 5 * 60 * 1000;

/** Daftar model upstream (dari config eksplisit atau /models live, di-cache 5 menit). */
export async function listModels(upstream) {
  if (upstream.models.length) return upstream.models;
  const cached = modelsCache.get(upstream.id);
  if (cached && Date.now() - cached.ts < MODELS_TTL_MS) return cached.models;
  try {
    const headers = { accept: "application/json" };
    if (upstream.apiKey) headers.authorization = `Bearer ${upstream.apiKey}`;
    const resp = await fetch(upstream.baseUrl + "/models", { headers });
    if (!resp.ok) return [];
    const data = await resp.json();
    const ids = Array.isArray(data?.data)
      ? data.data.map((m) => m.id).filter((x) => typeof x === "string")
      : [];
    modelsCache.set(upstream.id, { ts: Date.now(), models: ids });
    return ids;
  } catch {
    return [];
  }
}
