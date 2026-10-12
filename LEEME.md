# Sirkay LinkedIn MCP

Servidor MCP propio para que Claude publique en tu perfil de LinkedIn usando la API oficial. Corre gratis en Cloudflare Workers y se despliega solo desde este repositorio de GitHub.

## Herramientas que expone a Claude
- `estado_token`: si la conexión está activa y cuántos días le quedan.
- `publicar_post`: publica texto (máx. 3000 caracteres) con imagen opcional por URL.

## Despliegue desde GitHub (sin terminal, ~10 min)

1. Entra a dash.cloudflare.com (cuenta gratis) → **Workers & Pages** → **Create** → **Import a repository**.
2. Conecta GitHub, elige este repositorio (`sirkay-linkedin-mcp`) y pulsa **Deploy**. Cloudflare crea el KV automáticamente.
3. Abre el Worker → **Settings** → **Variables and Secrets** → **Add**, tipo **Secret**:
   - `LINKEDIN_CLIENT_SECRET` = el Secreto del cliente de LinkedIn.
   - `MCP_SECRET` = una clave larga inventada (32+ letras y números). Guárdala.
4. Copia la URL del Worker (`https://sirkay-linkedin-mcp.TU-USUARIO.workers.dev`).

Cada vez que se haga push a `main`, Cloudflare redespliega solo.

## Conectar LinkedIn
5. LinkedIn Developers → app → **Autenticación** → URLs de redireccionamiento → agrega:
   `https://sirkay-linkedin-mcp.TU-USUARIO.workers.dev/callback`
6. Abre en el navegador `https://sirkay-linkedin-mcp.TU-USUARIO.workers.dev/login?key=TU_MCP_SECRET` y acepta.

## Conectar a Claude
7. Claude → Configuración → Conectores → **Agregar conector personalizado**.
8. URL: `https://sirkay-linkedin-mcp.TU-USUARIO.workers.dev/mcp/TU_MCP_SECRET`

## Mantenimiento
El acceso de LinkedIn dura 60 días. Cuando venza (Claude avisa una semana antes), repite el paso 6.

## Seguridad
- Quien tenga `MCP_SECRET` puede publicar en tu perfil. No la compartas ni la subas al repo.
- Si se filtra: cámbiala en Cloudflare y actualiza la URL del conector.

## Problemas comunes
- `NONEXISTENT_VERSION`: cambia `LINKEDIN_VERSION` en `wrangler.toml` a un mes anterior.
- `redirect_uri does not match`: la URL del paso 5 debe ser exacta, con `/callback`.

## Alternativa por terminal
`npm install` → `npx wrangler login` → `npx wrangler secret put LINKEDIN_CLIENT_SECRET` → `npx wrangler secret put MCP_SECRET` → `npx wrangler deploy`.
