// Consulta de andamento processual (API pública do DataJud / CNJ).
// GET /api/processo?numero=0000000-00.0000.0.00.0000
//
// O DataJud leva 30–60 s e a função síncrona do Netlify para em ~30 s. Então:
//  1. se o resultado já está no Netlify Blobs (menos de 15 min), devolve na hora;
//  2. senão, dispara a função em segundo plano (processo-background) e devolve { status: 202, pendente: true };
//  3. a página pergunta de novo a cada poucos segundos até o resultado chegar.
// Não guarda nada além do resultado público da consulta (sem dados das partes; sigilo é escondido).
import { getStore } from "@netlify/blobs";
import { numeroValido, tribunalDe, VALIDADE_MS, PENDENTE_MS, ERRO_MS } from "../lib/datajud.mjs";

const json = (status, corpo) => new Response(JSON.stringify(corpo), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});

export default async (req) => {
  const url = new URL(req.url);
  const digitos = (url.searchParams.get("numero") || "").replace(/\D/g, "");
  if (digitos.length !== 20) return json(400, { status: 400, erro: "O número do processo tem 20 dígitos (formato 0000000-00.0000.0.00.0000)." });
  if (!numeroValido(digitos)) return json(400, { status: 400, erro: "Esse número não é válido. Confira os dígitos." });
  if (!tribunalDe(digitos.slice(13, 14), digitos.slice(14, 16))) return json(400, { status: 400, erro: "Este tribunal não está disponível na consulta pública do CNJ." });

  const loja = getStore("processos");
  const salvo = await loja.get(digitos, { type: "json" }).catch(() => null);
  const idade = salvo ? Date.now() - salvo.em : Infinity;
  const valeAte = salvo && salvo.out && (salvo.out.status === 200 || salvo.out.status === 404) ? VALIDADE_MS : ERRO_MS;
  if (salvo && salvo.out && idade < valeAte) { const { detalhe, ...out } = salvo.out; return json(200, out); }
  if (salvo && salvo.pendente && idade < PENDENTE_MS) return json(202, { status: 202, pendente: true });

  await loja.setJSON(digitos, { em: Date.now(), pendente: true });
  // dispara a busca lenta; a função em segundo plano responde 202 na hora
  await fetch(new URL(`/.netlify/functions/processo-background?numero=${digitos}`, url.origin), { method: "POST" }).catch((e) => console.error("Não disparou:", e.message));
  return json(202, { status: 202, pendente: true });
};

export const config = { path: "/api/processo" };
