// Sirkay LinkedIn MCP — servidor MCP mínimo en Cloudflare Workers
// Rutas:
//   GET  /                      -> estado simple
//   GET  /login?key=SECRET      -> inicia OAuth con LinkedIn
//   GET  /callback              -> LinkedIn devuelve aquí el código
//   POST /mcp/SECRET            -> endpoint MCP (Streamable HTTP, JSON-RPC)

const LI_AUTH = "https://www.linkedin.com/oauth/v2/authorization";
const LI_TOKEN = "https://www.linkedin.com/oauth/v2/accessToken";
const LI_USERINFO = "https://api.linkedin.com/v2/userinfo";
const LI_REST = "https://api.linkedin.com/rest";
const SCOPES = "openid profile email w_member_social";
const TOKEN_KEY = "linkedin_token";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    try {
      if (path === "/") return text("Sirkay LinkedIn MCP activo.");
      if (path === "/login") return login(url, env);
      if (path === "/callback") return callback(url, env);
      if (path === `/mcp/${env.MCP_SECRET}`) return mcp(request, env, url);
      return text("No encontrado", 404);
    } catch (err) {
      return text(`Error: ${err.message}`, 500);
    }
  },
};

// ---------- OAuth ----------

async function login(url, env) {
  if (url.searchParams.get("key") !== env.MCP_SECRET) return text("No autorizado", 401);
  const state = crypto.randomUUID();
  await env.KV.put(`state:${state}`, "1", { expirationTtl: 600 });
  const auth = new URL(LI_AUTH);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("client_id", env.LINKEDIN_CLIENT_ID);
  auth.searchParams.set("redirect_uri", `${url.origin}/callback`);
  auth.searchParams.set("state", state);
  auth.searchParams.set("scope", SCOPES);
  return Response.redirect(auth.toString(), 302);
}

async function callback(url, env) {
  const error = url.searchParams.get("error");
  if (error) return html(`<h2>LinkedIn rechazó la autorización</h2><p>${esc(error)}: ${esc(url.searchParams.get("error_description") || "")}</p>`, 400);

  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (!state || !code || !(await env.KV.get(`state:${state}`))) return text("Estado inválido o vencido. Vuelve a /login.", 400);
  await env.KV.delete(`state:${state}`);

  const res = await fetch(LI_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${url.origin}/callback`,
      client_id: env.LINKEDIN_CLIENT_ID,
      client_secret: env.LINKEDIN_CLIENT_SECRET,
    }),
  });
  const tok = await res.json();
  if (!res.ok) return html(`<h2>No se pudo obtener el token</h2><pre>${esc(JSON.stringify(tok, null, 2))}</pre>`, 400);

  const me = await (await fetch(LI_USERINFO, { headers: { Authorization: `Bearer ${tok.access_token}` } })).json();
  const record = {
    access_token: tok.access_token,
    expires_at: Date.now() + tok.expires_in * 1000,
    person_urn: `urn:li:person:${me.sub}`,
    name: me.name || "",
  };
  await env.KV.put(TOKEN_KEY, JSON.stringify(record));
  const days = Math.floor(tok.expires_in / 86400);
  return html(`<h2>✅ Conectado como ${esc(record.name)}</h2><p>El acceso vence en ${days} días. Ya puedes cerrar esta pestaña.</p>`);
}

async function getToken(env) {
  const raw = await env.KV.get(TOKEN_KEY);
  if (!raw) return null;
  return JSON.parse(raw);
}

// ---------- MCP ----------

const TOOLS = [
  {
    name: "estado_token",
    description: "Indica si la conexión con LinkedIn está activa, a nombre de quién y cuántos días faltan para que venza el acceso.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "publicar_post",
    description: "Publica un post en el perfil personal de LinkedIn del usuario. Úsalo SOLO con un texto que el usuario aprobó explícitamente. Opcionalmente adjunta una imagen pública (PNG o JPG) por URL.",
    inputSchema: {
      type: "object",
      properties: {
        texto: { type: "string", description: "Texto del post (máx. 3000 caracteres)." },
        imagen_url: { type: "string", description: "URL pública de una imagen PNG o JPG (opcional)." },
        texto_alternativo: { type: "string", description: "Descripción de la imagen para accesibilidad (opcional)." },
        visibilidad: { type: "string", enum: ["PUBLIC", "CONNECTIONS"], description: "Por defecto PUBLIC." },
      },
      required: ["texto"],
      additionalProperties: false,
    },
  },
];

async function mcp(request, env, url) {
  if (request.method !== "POST") return new Response("Método no permitido", { status: 405, headers: { Allow: "POST" } });

  const body = await request.json();
  const messages = Array.isArray(body) ? body : [body];
  const responses = [];
  for (const msg of messages) {
    const r = await handleRpc(msg, env, url);
    if (r) responses.push(r);
  }
  if (responses.length === 0) return new Response(null, { status: 202 });
  return json(Array.isArray(body) ? responses : responses[0]);
}

async function handleRpc(msg, env, url) {
  const { id, method, params } = msg;
  if (id === undefined || id === null) return null; // notificación

  const ok = (result) => ({ jsonrpc: "2.0", id, result });
  const fail = (code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });

  switch (method) {
    case "initialize":
      return ok({
        protocolVersion: params?.protocolVersion || "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "sirkay-linkedin", version: "1.0.0" },
        instructions: "Publica en LinkedIn solo contenido aprobado explícitamente por el usuario.",
      });
    case "ping":
      return ok({});
    case "tools/list":
      return ok({ tools: TOOLS });
    case "tools/call":
      try {
        const out = await callTool(params?.name, params?.arguments || {}, env, url);
        return ok({ content: [{ type: "text", text: out }] });
      } catch (err) {
        return ok({ content: [{ type: "text", text: `Error: ${err.message}` }], isError: true });
      }
    default:
      return fail(-32601, `Método no soportado: ${method}`);
  }
}

async function callTool(name, args, env, url) {
  const loginUrl = `${url.origin}/login?key=${env.MCP_SECRET}`;
  const tok = await getToken(env);

  if (name === "estado_token") {
    if (!tok) return `No hay conexión con LinkedIn. El usuario debe abrir: ${loginUrl}`;
    const days = Math.floor((tok.expires_at - Date.now()) / 86400000);
    if (days < 0) return `El acceso VENCIÓ. El usuario debe volver a autorizar en: ${loginUrl}`;
    const warn = days <= 7 ? ` ⚠️ Vence pronto: renovar en ${loginUrl}` : "";
    return `Conectado como ${tok.name}. Faltan ${days} días para que venza el acceso.${warn}`;
  }

  if (name === "publicar_post") {
    if (!tok || tok.expires_at < Date.now()) throw new Error(`Sin acceso vigente a LinkedIn. Autoriza en: ${loginUrl}`);
    const texto = (args.texto || "").trim();
    if (!texto) throw new Error("El texto está vacío.");
    if (texto.length > 3000) throw new Error(`El texto tiene ${texto.length} caracteres; el máximo es 3000.`);

    const post = {
      author: tok.person_urn,
      commentary: escapeLittleText(texto),
      visibility: args.visibilidad === "CONNECTIONS" ? "CONNECTIONS" : "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    };

    if (args.imagen_url) {
      const imageUrn = await uploadImage(args.imagen_url, tok, env);
      post.content = { media: { id: imageUrn, altText: (args.texto_alternativo || "").slice(0, 4086) } };
    }

    const res = await liFetch(`${LI_REST}/posts`, tok, env, { method: "POST", body: JSON.stringify(post) });
    if (!res.ok) throw new Error(`LinkedIn respondió ${res.status}: ${await res.text()}`);
    const postUrn = res.headers.get("x-restli-id") || "";
    return `✅ Publicado. URL: https://www.linkedin.com/feed/update/${postUrn}`;
  }

  throw new Error(`Herramienta desconocida: ${name}`);
}

async function uploadImage(imageUrl, tok, env) {
  const img = await fetch(imageUrl);
  if (!img.ok) throw new Error(`No se pudo descargar la imagen (${img.status}).`);
  const bytes = await img.arrayBuffer();

  const init = await liFetch(`${LI_REST}/images?action=initializeUpload`, tok, env, {
    method: "POST",
    body: JSON.stringify({ initializeUploadRequest: { owner: tok.person_urn } }),
  });
  if (!init.ok) throw new Error(`Error al iniciar la subida (${init.status}): ${await init.text()}`);
  const { value } = await init.json();

  const put = await fetch(value.uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${tok.access_token}`, "Content-Type": img.headers.get("content-type") || "application/octet-stream" },
    body: bytes,
  });
  if (!put.ok) throw new Error(`Error al subir la imagen (${put.status}): ${await put.text()}`);
  return value.image;
}

function liFetch(url, tok, env, init = {}) {
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${tok.access_token}`,
      "LinkedIn-Version": env.LINKEDIN_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

// LinkedIn interpreta estos caracteres como sintaxis; sin escaparlos el post se corta.
function escapeLittleText(s) {
  return s.replace(/[\\|{}@\[\]()<>#*_~]/g, (c) => `\\${c}`);
}

// ---------- utilidades ----------

function text(body, status = 200) {
  return new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
function html(body, status = 200) {
  return new Response(`<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;max-width:560px;margin:60px auto">${body}</body>`, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
function json(obj) {
  return new Response(JSON.stringify(obj), { headers: { "Content-Type": "application/json" } });
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
