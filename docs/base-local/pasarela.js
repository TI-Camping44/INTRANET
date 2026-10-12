// Pasarela que imita las rutas de Supabase delante de PostgREST.
// Solo para sacar las capturas del manual en esta maquina.
//
//   /rest/v1/*     -> PostgREST
//   /auth/v1/user  -> la persona de demostracion
//   /storage/v1/*  -> vacio (los adjuntos no existen en la demostracion)
const http = require("http");

const POSTGREST = "http://127.0.0.1:3001";
const PUERTO = 8000;

const PERSONA = {
  id: process.env.DEMO_USUARIO_ID,
  aud: "authenticated",
  role: "authenticated",
  email: process.env.DEMO_USUARIO_CORREO,
  email_confirmed_at: "2026-01-02T12:00:00Z",
  phone: "",
  confirmed_at: "2026-01-02T12:00:00Z",
  last_sign_in_at: new Date().toISOString(),
  app_metadata: { provider: "google", providers: ["google"] },
  user_metadata: { full_name: process.env.DEMO_USUARIO_NOMBRE },
  identities: [],
  created_at: "2026-01-02T12:00:00Z",
  updated_at: new Date().toISOString(),
};

function json(res, codigo, cuerpo) {
  const texto = JSON.stringify(cuerpo);
  res.writeHead(codigo, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(texto),
  });
  res.end(texto);
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (url.pathname === "/auth/v1/user") return json(res, 200, PERSONA);
  if (url.pathname.startsWith("/auth/v1/")) return json(res, 200, {});
  if (url.pathname.startsWith("/storage/v1/")) return json(res, 404, { error: "sin archivos" });

  if (url.pathname.startsWith("/rest/v1/")) {
    const destino = POSTGREST + url.pathname.slice("/rest/v1".length) + url.search;
    const trozos = [];
    for await (const t of req) trozos.push(t);
    const cabeceras = { ...req.headers };
    delete cabeceras.host;
    delete cabeceras["content-length"];
    delete cabeceras["accept-encoding"];
    try {
      const r = await fetch(destino, {
        method: req.method,
        headers: cabeceras,
        body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(trozos),
      });
      const cuerpo = Buffer.from(await r.arrayBuffer());
      const salida = {};
      r.headers.forEach((v, k) => {
        if (!["content-encoding", "transfer-encoding", "content-length"].includes(k)) salida[k] = v;
      });
      salida["content-length"] = cuerpo.length;
      res.writeHead(r.status, salida);
      return res.end(cuerpo);
    } catch (e) {
      return json(res, 502, { message: String(e) });
    }
  }

  return json(res, 404, { message: "sin ruta" });
});

servidor.listen(PUERTO, "127.0.0.1", () =>
  console.log("pasarela de demostracion en http://127.0.0.1:" + PUERTO));
