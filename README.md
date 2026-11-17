# 9Router Lite — AI Router untuk Vercel

> **Bukan OpenRouter.** Ini versi ringan dari [**9Router**](https://github.com/decolua/9router) (open-source AI router oleh decolua) yang diadaptasi supaya bisa di-deploy di **Vercel (serverless) tanpa masalah**: satu endpoint **OpenAI-compatible** `/v1` dengan **fallback multi-provider**, streaming (SSE), dan CORS — siap diarahkan dari Claude Code, Cursor, Cline, Codex, OpenClaw, dll.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FRyuSukaCMD%2F9router&env=PROXY_API_KEY)

---

## Fitur

- ⚡ **OpenAI-compatible** — `POST /v1/chat/completions` (non-streaming **dan** streaming SSE), `POST /v1/responses`, `GET /v1/models`.
- 🔀 **Fallback multi-provider** — request dicoba ke upstream secara urut; saat rate-limit (429), error server (5xx), atau gagal jaringan, otomatis pindah ke upstream berikutnya. Pola kerja khas 9Router (subscription → murah → gratis), versi serverless.
- 🏷️ **Model prefix routing** — model `oc/claude-opus-4-8` di-route ke upstream `opencode`; tanpa prefix, dicoba ke semua upstream.
- 🌐 **CORS lengkap** — bisa dipanggil dari browser/extension langsung.
- 🔒 **Auth opsional** — `PROXY_API_KEY` mengunci endpoint /v1.
- 📦 **Zero dependency** — murni Node.js fetch, tanpa npm install yang ribet → build di Vercel selalu mulus.
- 🧪 **Dev server lokal** — `npm run dev` untuk tes sebelum deploy.

## Kenapa versi ini? (hasil riset jujur)

9Router asli adalah aplikasi Next.js + LowDB/SQLite yang dirancang berjalan sebagai **proxy lokal** (`localhost:20128`) dengan fitur berat: OAuth/MITM untuk provider gratis (Kiro, iFlow), quota tracking real-time, RTK token saver, dsb. Di **serverless Vercel**:

| Kemampuan | 9Router asli (lokal/VPS) | Repo ini (Vercel) |
|---|---|---|
| Database file (LowDB/SQLite) | ✅ persist | ❌ tidak persist antar request |
| OAuth provider gratis (Kiro, dll.) | ✅ via MITM lokal | ❌ tidak mungkin di serverless |
| Proxy/port lokal (20128) | ✅ | ❌ (tidak relevan) |
| Quota tracking, RTK, caveman mode | ✅ | ❌ |
| Endpoint OpenAI-compatible + fallback | ✅ | ✅ (inti dari yang dibutuhkan tools) |
| Deploy 1-klik, gratis, tanpa kelola server | ❌ | ✅ |

Jadi repo ini mengambil **inti 9Router yang benar-benar dibutuhkan coding tools** (satu endpoint OpenAI-compatible + fallback otomatis) dan membuang bagian yang mustahil di serverless. Butuh fitur penuh (Kiro gratis, quota, RTK)? Pakai 9Router asli di VPS/Docker, atau jalan bareng: lokal untuk fitur penuh, Vercel untuk endpoint publik.

---

## Cara deploy

### Opsi A — Tombol 1-klik

Klik tombol **Deploy with Vercel** di atas → isi `PROXY_API_KEY` (wajib disarankan) → Deploy. Selesai.

### Opsi B — Manual

1. Import repo ini di [vercel.com/new](https://vercel.com/new) (hubungkan akun GitHub).
2. Di **Project → Settings → Environment Variables**, tambahkan:
   - `PROXY_API_KEY` — key untuk mengunci endpoint /v1 (dipakai tools AI-mu sebagai API key)
   - satu/beberapa key upstream, mis. `OPCODE_API_KEY` (OpenCode Free — model Claude/GPT gratis), `OPENROUTER_API_KEY`, `GLM_API_KEY`, `DEEPSEEK_API_KEY`, `GROQ_API_KEY`, dst.
3. Deploy. Base URL deployment-mu: `https://<nama-project>.vercel.app/v1`.

> Tidak ada build step khusus — project ini zero-dependency, jadi build di Vercel tidak akan gagal karena npm.

## Konfigurasi upstream

### Preset (paling gampang)

Isi env berikut, otomatis jadi upstream:

| Env var | Provider | Prefix model |
|---|---|---|
| `OPCODE_API_KEY` | OpenCode Free (zen) — Claude/GPT gratis | `oc/` |
| `OPENROUTER_API_KEY` | OpenRouter | `or/` |
| `GLM_API_KEY` | GLM (Zhipu AI) | `glm/` |
| `DEEPSEEK_API_KEY` | DeepSeek | `ds/` |
| `GROQ_API_KEY` | Groq | `groq/` |
| `SILICONFLOW_API_KEY` | SiliconFlow | `sf/` |
| `MISTRAL_API_KEY` | Mistral AI | `mistral/` |
| `XAI_API_KEY` | xAI (Grok) | `xai/` |
| `OPENAI_API_KEY` | OpenAI | `oa/` |

### Kustom

```env
# JSON array — kontrol penuh (id, name, prefix, baseUrl, apiKey, models opsional)
UPSTREAMS=[{"id":"kiro","prefix":"kr","name":"Kiro","baseUrl":"https://api.kiro.dev/v1","apiKey":"..."}]

# atau variabel bernomor (hingga 20)
UPSTREAM_1_URL=https://api.contoh.com/v1
UPSTREAM_1_API_KEY=sk-xxx
UPSTREAM_1_PREFIX=cus
UPSTREAM_1_NAME=Provider Kustom
UPSTREAM_1_MODELS=model-a,model-b

# prioritas fallback: "glm,opencode,openrouter"
UPSTREAM_ORDER=
```

### Perilaku fallback

| Kondisi upstream | Aksi |
|---|---|
| Sukses (2xx) | Respons diteruskan apa adanya (termasuk stream SSE) |
| `401` / `403` / `429` / `5xx` / gagal jaringan | Coba upstream berikutnya |
| `400` / `422` (request salah) | Dikembalikan ke client, fallback berhenti |
| `404` di `/responses` (upstream tidak mendukung Responses API) | Dilewati, lanjut fallback |
| Semua gagal | `502` dengan daftar error per upstream |

Header `x-9router-upstream` di respons menandakan upstream mana yang melayani.

---

## Pakai dari coding tools

Semua tool yang bisa diarahkan ke OpenAI-compatible endpoint bisa memakai ini:

| Setting | Nilai |
|---|---|
| **Base URL** | `https://<nama-project>.vercel.app/v1` |
| **API Key** | nilai `PROXY_API_KEY`-mu |
| **Model** | `oc/claude-opus-4-8` (OpenCode Free), `or/<model>` (OpenRouter), `glm/<model>`, `ds/<model>`, dst. |

Contoh per tool:

- **Cursor / Cline / Continue / Roo Code**: di pengaturan model/provider, pilih "OpenAI-compatible", isi Base URL + API Key + model di atas.
- **Codex CLI**: arahkan `--api-base-url` ke base URL di atas dengan model ber-prefix.
- **OpenClaw** (format `openai-completions`):

```json
{
  "agents": {
    "defaults": {
      "model": { "primary": "9router/oc/claude-opus-4-8" }
    }
  },
  "models": {
    "providers": {
      "9router": {
        "baseUrl": "https://<nama-project>.vercel.app/v1",
        "apiKey": "<PROXY_API_KEY>",
        "api": "openai-completions"
      }
    }
  }
}
```

- **Tes cepat dengan curl**:

```bash
curl https://<nama-project>.vercel.app/v1/chat/completions \
  -H "Authorization: Bearer <PROXY_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"model":"oc/claude-opus-4-8","messages":[{"role":"user","content":"Halo!"}]}'
```

Cek daftar model semua upstream: `GET /v1/models` (dengan header Authorization yang sama).

---

## Endpoint

| Method | Path | Fungsi |
|---|---|---|
| `GET` | `/` | Halaman status (jumlah upstream, contoh config) |
| `POST` | `/v1/chat/completions` | Chat completions, streaming & non-streaming |
| `POST` | `/v1/responses` | Responses API (passthrough) |
| `GET` | `/v1/models` | Daftar model semua upstream (ber-prefix) |

## Keamanan

- **Selalu set `PROXY_API_KEY`.** Tanpa itu, siapa pun yang tahu URL deployment bisa memakai upstream (dan key) milikmu — bisa jebol saldo.
- Jangan pernah commit `.env` (sudah di-`.gitignore`); key hanya lewat Environment Variables Vercel.
- Key upstream **tidak pernah** bocor ke client: hanya dipakai server-side, dan `/v1/models` tidak menampilkan key.

## Keterbatasan yang jujur (serverless)

- **Timeout**: di plan Hobby, fungsi punya batas waktu singkat. Karena itu **streaming adalah mode default** tools AI — Vercel Fluid Compute memperpanjang sesi selama data mengalir. Untuk plan Pro/Enterprise, `maxDuration` di `vercel.json` bisa dinaikkan (sampai 300 dtk di Pro).
- **Tanpa state**: tidak ada quota tracking, usage analytics, atau RTK token saver (butuh database persist).
- **Provider OAuth gratis** (Kiro, dll.) tidak bisa dipakai — hanya provider berbasis API key yang OpenAI-compatible.
- Model gratis/termurah bisa berubah kapan saja — cek situs provider masing-masing.

## Development lokal

```bash
cp .env.example .env   # isi key sesuai kebutuhan
npm run dev            # tanpa npm install — zero dependency
# server di http://localhost:9100, route sama persis dengan vercel.json
```

## Kredit & lisensi

Terinspirasi oleh [**9Router**](https://github.com/decolua/9router) (MIT) karya decolua — cek repo aslinya untuk fitur penuh (RTK token saver, quota tracking, OAuth provider gratis, dll.) yang dijalankan lokal/VPS/Docker. Repo ini adalah implementasi ulang ringan untuk serverless, lisensi **MIT**.
