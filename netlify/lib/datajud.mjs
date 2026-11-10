// Busca no DataJud (API pública do CNJ), usada pela função em segundo plano.
// - Não guarda dados das partes (a API pública não os traz); processos com sigilo são escondidos.
// - A chave abaixo é a chave PÚBLICA divulgada pelo CNJ (https://datajud-wiki.cnj.jus.br/api-publica/acesso).
//   Se o CNJ trocar, defina DATAJUD_API_KEY nas variáveis do Netlify.

const CHAVE_PUBLICA = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";

// Ordem oficial dos códigos TR da Justiça Estadual/Eleitoral (01 = AC … 27 = TO)
const UFS = ["ac", "al", "ap", "am", "ba", "ce", "dft", "es", "go", "ma", "mt", "ms", "mg", "pa", "pb", "pr", "pe", "pi", "rj", "rn", "rs", "ro", "rr", "sc", "se", "sp", "to"];

export function tribunalDe(j, tr) {
  const n = Number(tr);
  switch (j) {
    case "3": return "stj";
    case "4": return n >= 1 && n <= 6 ? `trf${n}` : null;
    case "5": return n === 0 ? "tst" : n <= 24 ? `trt${n}` : null;
    case "6": return n === 0 ? "tse" : UFS[n - 1] ? `tre-${UFS[n - 1] === "dft" ? "df" : UFS[n - 1]}` : null;
    case "7": return "stm";
    case "8": return UFS[n - 1] ? `tj${UFS[n - 1]}` : null;
    case "9": return { 13: "tjmmg", 21: "tjmrs", 26: "tjmsp" }[n] || null;
    default: return null; // 1 = STF e 2 = CNJ não estão no DataJud
  }
}

// Dígito verificador do número CNJ (Resolução 65/2008, módulo 97)
export function numeroValido(d) {
  const nnnnnnn = d.slice(0, 7), dv = d.slice(7, 9), resto = d.slice(9);
  const base = BigInt(nnnnnnn + resto + "00");
  return String(98n - (base % 97n)).padStart(2, "0") === dv;
}

const GRAUS = { G1: "1º grau", G2: "2º grau (recurso)", JE: "Juizado Especial", TR: "Turma Recursal", SUP: "Tribunal superior", TRU: "Turma Regional de Uniformização", TNU: "Turma Nacional de Uniformização" };

// Resultados guardados no Netlify Blobs (loja "processos"): consultas repetidas respondem na hora.
export const VALIDADE_MS = 15 * 60 * 1000;   // resultado fresco por 15 min
export const PENDENTE_MS = 6 * 60 * 1000;    // uma busca "em andamento" vale por 6 min (até 4 tentativas)
export const ERRO_MS = 20 * 1000;           // um erro do CNJ só fica guardado 20 s (a próxima consulta tenta de novo)

export async function buscar(digitos, tribunal, limite = 300000) {
  // limite: tempo total da busca (Netlify em segundo plano: 5 min; Vercel: abaixo do maxDuration da função)
  // Busca exata no campo "keyword" (bem mais rápida que "match": ~30 s contra 50–60 s em nov/2026).
  // Se não achar, tenta o "match" uma vez. Roda na função em segundo plano (limite de 15 min).
  const inicio = Date.now();
  const consulta = async (query, ms) => {
    const r = await fetch(`https://api-publica.datajud.cnj.jus.br/api_publica_${tribunal}/_search`, {
      method: "POST",
      headers: { Authorization: `APIKey ${process.env.DATAJUD_API_KEY || CHAVE_PUBLICA}`, "Content-Type": "application/json" },
      body: JSON.stringify({ size: 10, query }),
      signal: AbortSignal.timeout(ms),
    });
    if (!r.ok) throw new Error(`DataJud ${r.status}`);
    return r.json();
  };
  // O DataJud às vezes devolve 504 aos 60 s (o tempo limite do próprio servidor deles) e na tentativa seguinte
  // responde em ~45 s. Por isso: até 4 tentativas, dentro de 5 minutos.
  let dados = null, ultimoErro = "";
  for (let tentativa = 1; tentativa <= 4 && !dados; tentativa++) {
    const resta = limite - (Date.now() - inicio);
    if (resta < 20000) break;
    try {
      dados = await consulta({ term: { "numeroProcesso.keyword": digitos } }, Math.min(90000, resta));
    } catch (e) {
      ultimoErro = e.message;
      console.error(`DataJud, tentativa ${tentativa}:`, e.message);
      // 429 (muitas consultas): espera mais antes de tentar de novo
      await new Promise((ok) => setTimeout(ok, /429/.test(e.message) ? 6000 * tentativa : 2000));
    }
  }
  if (!dados) return { status: 502, erro: "A consulta pública do CNJ não respondeu agora. Tente de novo em alguns minutos.", detalhe: ultimoErro };
  if (!(dados.hits?.hits || []).length && limite - (Date.now() - inicio) > 30000) {
    try { dados = await consulta({ match: { numeroProcesso: digitos } }, Math.min(90000, limite - (Date.now() - inicio))); } catch (e) { console.error("DataJud (match):", e.message); }
  }

  const registros = (dados.hits?.hits || [])
    .map((h) => h._source)
    .filter((s) => !s.nivelSigilo) // sigilo/segredo de justiça: não exibir
    .map((s) => ({
      grau: GRAUS[s.grau] || s.grau || "",
      classe: s.classe?.nome || "",
      orgao: s.orgaoJulgador?.nome || "",
      assuntos: (s.assuntos || []).flat().map((a) => a?.nome).filter(Boolean),
      ajuizamento: s.dataAjuizamento || "",
      atualizado: s.dataHoraUltimaAtualizacao || "",
      movimentos: (s.movimentos || [])
        .map((m) => ({
          data: m.dataHora || "",
          codigo: m.codigo,
          nome: m.nome || "",
          complementos: (m.complementosTabelados || []).map((c) => c?.nome).filter(Boolean),
        }))
        .sort((a, b) => (a.data < b.data ? 1 : -1)),
    }));

  if (!registros.length) {
    return { status: 404, erro: "Não encontramos este processo na base pública do CNJ. Ele pode estar em segredo de justiça, ser muito recente ou ainda não ter sido enviado pelo tribunal." };
  }
  return { status: 200, numero: digitos, tribunal: tribunal.toUpperCase(), registros };
}
