/* Consulta processual: /api/processo (função do Netlify → DataJud/CNJ).
   Mostra as últimas movimentações no cartão [data-processo], cada uma explicada em uma frase.
   A explicação é geral: não substitui a orientação do advogado. */
(() => {
  const form = document.querySelector(".consulta-form");
  const cartao = document.querySelector("[data-processo]");
  if (!form || !cartao) return;
  const campo = form.querySelector("input");
  const erro = form.querySelector(".field__error");
  const botao = form.querySelector("button");
  const status = document.querySelector(".consulta-status");

  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const lower = (t) => String(t || "").toLowerCase();

  // Nomes que o CNJ manda incompletos (só o complemento do movimento)
  const NOMES = { 246: "Arquivamento definitivo", 245: "Arquivamento provisório", 898: "Suspensão por decisão do juiz",
    12066: "Fim da suspensão", 12068: "Fim da suspensão", 1059: "Recurso recebido sem efeito suspensivo", 581: "Documento juntado" };

  // Explicação simples por código da Tabela Processual Unificada do CNJ
  const POR_CODIGO = {
    26: "O processo foi registrado e enviado para uma vara.",
    36: "O processo passou para outra vara.",
    60: "O cartório emitiu um documento, como ofício, carta, mandado ou certidão.",
    1051: "Terminou um prazo que corria no processo.",
    85: "Uma das partes entrou com um pedido ou uma manifestação.",
    1061: "Uma decisão ou intimação saiu no Diário da Justiça Eletrônico.",
    92: "A decisão ou intimação foi publicada. Em geral, os prazos contam a partir daqui.",
    132: "O processo chegou a um setor ou instância.", 979: "O processo chegou a um setor ou instância.",
    123: "O processo foi enviado para outro setor ou instância.", 980: "O processo foi enviado para outro setor ou instância.", 982: "O processo foi enviado para outro setor ou instância.",
    11010: "O juiz deu um despacho de rotina para o processo seguir.",
    493: "O processo ficou disponível para uma das partes ou para o Ministério Público.",
    11383: "O cartório fez um ato de rotina para o processo seguir.",
    848: "A decisão ficou definitiva: não cabe mais recurso.",
    22: "O processo foi encerrado nesta instância.",
    246: "O processo foi arquivado de vez.",
    245: "O processo foi arquivado por enquanto e pode voltar a andar.",
    893: "O processo saiu do arquivo e voltou a andar.",
    219: "Sentença: o juiz aceitou os pedidos.", 221: "Sentença: o juiz aceitou parte dos pedidos.", 220: "Sentença: o juiz não aceitou os pedidos.",
    196: "A fase de cobrança do que foi decidido terminou.",
    466: "O juiz aprovou um acordo entre as partes.",
    787: "Houve decisão sobre o pedido de justiça gratuita.", 334: "Houve decisão sobre o pedido de justiça gratuita.",
    11384: "Começou o cálculo do valor devido.",
    11385: "Começou a fase de cumprir o que foi decidido.",
    581: "Um documento entrou no processo.",
    14736: "O processo passou para o Juízo 100% Digital.", 14737: "O processo saiu do Juízo 100% Digital.",
    14732: "O processo em papel foi digitalizado.",
    417: "O processo entrou na pauta de julgamento.",
    898: "O juiz suspendeu o processo.",
    12066: "O processo voltou a andar depois de suspenso.", 12068: "O processo voltou a andar depois de suspenso.",
    12164: "O juiz deu uma decisão.",
    200: "O juiz respondeu a um pedido de esclarecimento da decisão e não o aceitou.",
    871: "O juiz respondeu a um pedido de esclarecimento da decisão e aceitou em parte.",
    135: "Este processo foi reunido a outro relacionado.", 137: "Este processo foi separado de outro.",
    106: "Houve movimento de um mandado, a ordem do juiz cumprida por oficial de justiça.",
    985: "Houve movimento de um mandado, a ordem do juiz cumprida por oficial de justiça.",
    849: "O processo foi reativado.",
    785: "Houve decisão sobre um pedido urgente.",
  };

  function explicar(m) {
    const comp = (m.complementos || []).map(lower);
    if (m.codigo === 51 || m.codigo === 15101 || /^conclus/i.test(m.nome)) {
      const para = comp.find((c) => c.startsWith("para ")) || "";
      const alvo = para.includes("sentença") ? "a sentença" : para.includes("despacho") ? "um despacho" : para.includes("decisão") ? "uma decisão" : "uma manifestação";
      return `O processo foi para o juiz, que vai dar ${alvo}.`;
    }
    if (m.codigo === 970 || /audi[eê]ncia/i.test(m.nome)) {
      const tipo = comp.find((c) => /instru|concilia|julgamento|media|una|inicial/.test(c));
      const sit = comp.find((c) => /designada|realizada|cancelada|redesignada|não-realizada|convertida/.test(c));
      return `Audiência${tipo ? ` de ${tipo}` : ""}${sit ? `: ${sit}` : ""}.`;
    }
    if (POR_CODIGO[m.codigo]) return POR_CODIGO[m.codigo];
    const n = lower(m.nome);
    if (n.includes("sentença") || n.includes("julgamento")) return "Houve um julgamento no processo.";
    if (n.includes("recurso")) return "Houve um movimento ligado a um recurso.";
    if (n.includes("citação")) return "A outra parte foi avisada oficialmente do processo.";
    if (n.includes("intimação")) return "Uma das partes recebeu um aviso oficial.";
    if (n.includes("decisão")) return "O juiz deu uma decisão.";
    return "";
  }

  const mascara = (v) => {
    const d = v.replace(/\D/g, "").slice(0, 20);
    const partes = [d.slice(0, 7), d.slice(7, 9), d.slice(9, 13), d.slice(13, 14), d.slice(14, 16), d.slice(16, 20)];
    const seps = ["", "-", ".", ".", ".", "."];
    return partes.reduce((s, p, i) => (p ? s + seps[i] + p : s), "");
  };
  campo.addEventListener("input", () => { campo.value = mascara(campo.value); });

  const data = (iso) => {
    if (!iso) return ["", ""];
    const s = String(iso);
    const d = /^\d{14}$/.test(s) ? new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T12:00:00`) : new Date(s);
    if (isNaN(d)) return ["", ""];
    return [d.toISOString().slice(0, 10), d.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" }).replace(" de ", " ").replace(" de ", " ")];
  };

  const LIMITE = 6;
  const linha = (m) => {
    const [iso, txt] = data(m.data);
    const exp = explicar(m);
    return `<li><span class="rows__name">${esc(NOMES[m.codigo] || m.nome)}${exp ? `<small>${esc(exp)}</small>` : ""}</span><time class="rows__value" datetime="${iso}">${esc(txt)}</time></li>`;
  };

  function desenhar(r) {
    cartao.classList.remove("is-apagado");
    const reg = r.registros[0];
    const outros = r.registros.length > 1 ? ` · mais ${r.registros.length - 1} ${r.registros.length > 2 ? "instâncias" : "instância"}` : "";
    cartao.innerHTML = `
      <div class="processo__head">
        <p class="processo__meta">${esc(r.tribunal)} · ${esc(reg.grau)} · ${esc(reg.orgao)}${esc(outros)}</p>
        <h3>${esc(reg.classe)}</h3>
      </div>
      <ul class="rows">${reg.movimentos.slice(0, LIMITE).map(linha).join("")}</ul>
      ${reg.movimentos.length > LIMITE ? `<button type="button" class="btn btn--secondary processo__mais">Ver as ${reg.movimentos.length} movimentações</button>` : ""}`;
    const mais = cartao.querySelector(".processo__mais");
    if (mais) mais.addEventListener("click", () => { cartao.querySelector(".rows").innerHTML = reg.movimentos.map(linha).join(""); mais.remove(); });
  }

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const digitos = campo.value.replace(/\D/g, "");
    if (digitos.length !== 20) {
      erro.hidden = false; campo.setAttribute("aria-invalid", "true"); campo.focus();
      return;
    }
    erro.hidden = true; campo.removeAttribute("aria-invalid");
    botao.disabled = true;
    status.textContent = "Consultando o CNJ. Pode levar até um minuto.";
    try {
      // A busca no CNJ roda em segundo plano (30–60 s, com novas tentativas se o CNJ falhar): pergunta a cada 4 s, por até 4 min.
      const inicio = Date.now(), limite = inicio + 240000;
      let avisou = false;
      let j = {};
      for (;;) {
        const r = await fetch(`/api/processo?numero=${digitos}`, { cache: "no-store" });
        j = await r.json().catch(() => ({}));
        if (!(j.pendente || r.status === 202)) { if (!r.ok && !j.erro) j.erro = "Não foi possível consultar agora."; break; }
        if (Date.now() > limite) { j = { erro: "O CNJ está demorando mais que o normal. Tente de novo em alguns minutos." }; break; }
        if (!avisou && Date.now() - inicio > 60000) { status.textContent = "O CNJ está lento agora. Continuamos tentando; pode levar alguns minutos."; avisou = true; }
        await new Promise((ok) => setTimeout(ok, 4000));
      }
      if ((j.status && j.status !== 200) || !j.registros) throw new Error(j.erro || "Não foi possível consultar agora. Tente de novo em alguns minutos.");
      status.textContent = "";
      desenhar(j);
    } catch (e) {
      status.textContent = e.message;
      cartao.classList.add("is-apagado");
    } finally {
      botao.disabled = false;
    }
  });
})();
