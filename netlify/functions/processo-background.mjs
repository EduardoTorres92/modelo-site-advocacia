// Função em SEGUNDO PLANO (o sufixo -background dá até 15 min): faz a busca lenta no DataJud
// e guarda o resultado no Netlify Blobs para a /api/processo entregar à página.
import { getStore } from "@netlify/blobs";
import { buscar, numeroValido, tribunalDe } from "../lib/datajud.mjs";

export default async (req) => {
  const digitos = (new URL(req.url).searchParams.get("numero") || "").replace(/\D/g, "");
  if (digitos.length !== 20 || !numeroValido(digitos)) return;
  const tribunal = tribunalDe(digitos.slice(13, 14), digitos.slice(14, 16));
  if (!tribunal) return;
  const loja = getStore("processos");
  let out;
  try { out = await buscar(digitos, tribunal); }
  catch (e) { console.error("Falha inesperada:", e); out = { status: 500, erro: "Não foi possível consultar agora. Tente de novo em alguns minutos." }; }
  await loja.setJSON(digitos, { em: Date.now(), out });
};
