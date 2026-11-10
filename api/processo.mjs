// Consulta de andamento processual na Vercel (API pública do DataJud / CNJ).
// GET /api/processo?numero=0000000-00.0000.0.00.0000
//
// Na Vercel a função pode rodar até 300 s (vercel.json), então a busca é feita na própria requisição:
// a página espera a resposta (30–60 s, com novas tentativas se o CNJ falhar).
// Resultado bom ou "não encontrado" fica 15 min no cache da CDN da Vercel e na memória da instância;
// erro não fica guardado. Não guarda nada além do resultado público (sem dados das partes; sigilo é escondido).
// A versão da Netlify continua em netlify/functions (mesma biblioteca).
import { buscar, numeroValido, tribunalDe, VALIDADE_MS } from "../netlify/lib/datajud.mjs";

const memoria = new Map();
const json = (status, corpo, cache = "no-store") => new Response(JSON.stringify(corpo), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": cache },
});

export async function GET(req) {
  const digitos = (new URL(req.url).searchParams.get("numero") || "").replace(/\D/g, "");
  if (digitos.length !== 20) return json(400, { status: 400, erro: "O número do processo tem 20 dígitos (formato 0000000-00.0000.0.00.0000)." });
  if (!numeroValido(digitos)) return json(400, { status: 400, erro: "Esse número não é válido. Confira os dígitos." });
  const tribunal = tribunalDe(digitos.slice(13, 14), digitos.slice(14, 16));
  if (!tribunal) return json(400, { status: 400, erro: "Este tribunal não está disponível na consulta pública do CNJ." });

  const salvo = memoria.get(digitos);
  if (salvo && Date.now() - salvo.em < VALIDADE_MS) return json(200, salvo.out, "public, max-age=0, s-maxage=900");

  let out;
  try { out = await buscar(digitos, tribunal, 270000); }
  catch (e) { console.error("Falha inesperada:", e); out = { status: 500, erro: "Não foi possível consultar agora. Tente de novo em alguns minutos." }; }
  const { detalhe, ...publico } = out;
  if (detalhe) console.error("DataJud:", detalhe);
  if (out.status === 200 || out.status === 404) {
    memoria.set(digitos, { em: Date.now(), out: publico });
    if (memoria.size > 200) memoria.delete(memoria.keys().next().value);
    return json(200, publico, "public, max-age=0, s-maxage=900");
  }
  return json(200, publico);
}
