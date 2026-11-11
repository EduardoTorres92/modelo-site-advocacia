// Servidor Node.js para hospedar o site fora da Netlify/Vercel (ex.: Hostinger).
// - Entrega os arquivos da pasta site/.
// - GET /api/processo: mesma consulta ao DataJud, no formato da Netlify (a página pergunta de novo até o
//   resultado chegar). A busca lenta (30–60 s) roda em segundo plano dentro do próprio processo e o
//   resultado fica na memória: 15 min se deu certo ou "não encontrado", 20 s se deu erro.
// Iniciar: npm start (porta em PORT, padrão 3000).
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { buscar, numeroValido, tribunalDe, VALIDADE_MS, PENDENTE_MS, ERRO_MS } from "./netlify/lib/datajud.mjs";

const RAIZ = fileURLToPath(new URL("./site/", import.meta.url));
const PORTA = Number(process.env.PORT) || 3000;

const TIPOS = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif",
  ".gif": "image/gif", ".ico": "image/x-icon", ".mp4": "video/mp4", ".webm": "video/webm",
  ".woff": "font/woff", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml",
};
const SEGURANCA = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

// ---------- /api/processo ----------
const memoria = new Map(); // digitos -> { em, pendente?, out? }

function guarda(digitos, valor) {
  memoria.set(digitos, valor);
  if (memoria.size > 300) memoria.delete(memoria.keys().next().value);
}

async function processo(url) {
  const digitos = (url.searchParams.get("numero") || "").replace(/\D/g, "");
  if (digitos.length !== 20) return [400, { status: 400, erro: "O número do processo tem 20 dígitos (formato 0000000-00.0000.0.00.0000)." }];
  if (!numeroValido(digitos)) return [400, { status: 400, erro: "Esse número não é válido. Confira os dígitos." }];
  const tribunal = tribunalDe(digitos.slice(13, 14), digitos.slice(14, 16));
  if (!tribunal) return [400, { status: 400, erro: "Este tribunal não está disponível na consulta pública do CNJ." }];

  const salvo = memoria.get(digitos);
  const idade = salvo ? Date.now() - salvo.em : Infinity;
  const valeAte = salvo?.out && (salvo.out.status === 200 || salvo.out.status === 404) ? VALIDADE_MS : ERRO_MS;
  if (salvo?.out && idade < valeAte) { const { detalhe, ...out } = salvo.out; return [200, out]; }
  if (salvo?.pendente && idade < PENDENTE_MS) return [202, { status: 202, pendente: true }];

  guarda(digitos, { em: Date.now(), pendente: true });
  buscar(digitos, tribunal)
    .catch((e) => { console.error("Falha inesperada:", e); return { status: 500, erro: "Não foi possível consultar agora. Tente de novo em alguns minutos." }; })
    .then((out) => { if (out.detalhe) console.error("DataJud:", out.detalhe); guarda(digitos, { em: Date.now(), out }); });
  return [202, { status: 202, pendente: true }];
}

// ---------- arquivos estáticos ----------
async function arquivo(caminho) {
  let rel = decodeURIComponent(caminho);
  if (rel.endsWith("/")) rel += "index.html";
  const alvo = normalize(join(RAIZ, rel));
  if (!alvo.startsWith(RAIZ.endsWith(sep) ? RAIZ : RAIZ + sep)) return null;
  for (const tentativa of [alvo, `${alvo}.html`, join(alvo, "index.html")]) {
    const info = await stat(tentativa).catch(() => null);
    if (info?.isFile()) return { caminho: tentativa, info };
  }
  return null;
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/api/processo") {
      if (req.method !== "GET") { res.writeHead(405, SEGURANCA).end(); return; }
      const [status, corpo] = await processo(url);
      res.writeHead(status, { ...SEGURANCA, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(JSON.stringify(corpo));
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405, SEGURANCA).end(); return; }
    const achado = await arquivo(url.pathname);
    if (!achado) { res.writeHead(404, { ...SEGURANCA, "content-type": "text/plain; charset=utf-8" }).end("Página não encontrada."); return; }
    const tamanho = achado.info.size;
    const cabecalhos = {
      ...SEGURANCA,
      "content-type": TIPOS[extname(achado.caminho).toLowerCase()] || "application/octet-stream",
      "cache-control": url.pathname.startsWith("/assets/") ? "public, max-age=604800" : "no-cache",
      "accept-ranges": "bytes",
    };
    // Range (o Safari só toca vídeo se o servidor entregar pedaços do arquivo)
    const faixa = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
    if (faixa && (faixa[1] || faixa[2])) {
      let ini = faixa[1] ? Number(faixa[1]) : Math.max(0, tamanho - Number(faixa[2]));
      let fim = faixa[1] && faixa[2] ? Math.min(Number(faixa[2]), tamanho - 1) : tamanho - 1;
      if (ini > fim || ini >= tamanho) { res.writeHead(416, { ...cabecalhos, "content-range": `bytes */${tamanho}` }).end(); return; }
      res.writeHead(206, { ...cabecalhos, "content-range": `bytes ${ini}-${fim}/${tamanho}`, "content-length": fim - ini + 1 });
      if (req.method === "HEAD") { res.end(); return; }
      createReadStream(achado.caminho, { start: ini, end: fim }).pipe(res);
      return;
    }
    res.writeHead(200, { ...cabecalhos, "content-length": tamanho });
    if (req.method === "HEAD") { res.end(); return; }
    createReadStream(achado.caminho).pipe(res);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.writeHead(500, SEGURANCA);
    res.end();
  }
}).listen(PORTA, () => console.log(`Site no ar na porta ${PORTA}`));
