/* Abertura: o vídeo da biblioteca anda com a rolagem (160 quadros num <canvas>).
   - Os textos trocam por faixas de progresso (data-de / data-ate), com fade + blur curto.
   - No fim, a imagem dissolve na cor do papel, para a página clara começar sem corte.
   - Movimento reduzido: só o primeiro quadro e o primeiro texto, sem rolagem presa. */
(() => {
  const sec = document.querySelector(".abertura");
  if (!sec) return;
  const canvas = sec.querySelector(".abertura__canvas");
  const ctx = canvas.getContext("2d");
  const papel = sec.querySelector(".abertura__papel");
  const momentos = [...sec.querySelectorAll(".abertura__momento")];
  const reduzir = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const celular = matchMedia("(max-width: 760px)").matches;

  const TOTAL = 160;
  const pasta = celular ? "assets/frames/mobile" : "assets/frames/desktop";
  const src = (i) => `${pasta}/f_${String(i + 1).padStart(4, "0")}.webp`;
  const quadros = new Array(TOTAL);
  let alvo = 0, atual = 0, desenhado = -1;

  const carregar = (i) => {
    if (quadros[i]) return quadros[i];
    const img = new Image();
    img.decoding = "async";
    img.src = src(i);
    img.onload = () => { if (desenhado === -1 || Math.round(atual) === i) desenhar(i, true); };
    return (quadros[i] = img);
  };
  const pronto = (i) => quadros[i] && quadros[i].complete && quadros[i].naturalWidth;
  const proximo = (i) => { for (let d = 0; d < TOTAL; d++) { if (pronto(i - d)) return i - d; if (pronto(i + d)) return i + d; } return -1; };

  function desenhar(i, forcar) {
    const j = proximo(i);
    if (j < 0 || (j === desenhado && !forcar)) return;
    const img = quadros[j], cw = canvas.width, ch = canvas.height;
    const k = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const w = img.naturalWidth * k, h = img.naturalHeight * k;
    ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
    desenhado = j;
  }
  const ajustar = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    desenhar(Math.round(atual), true);
  };

  // o primeiro quadro já; o resto em passadas (1 a cada 8, depois 4, 2, 1) para cobrir o filme cedo
  carregar(0);
  if (!reduzir) {
    const fila = [];
    for (const passo of [8, 4, 2, 1]) for (let i = 0; i < TOTAL; i += passo) if (!fila.includes(i)) fila.push(i);
    let k = 0;
    const lote = () => { for (let n = 0; n < 6 && k < fila.length; n++) carregar(fila[k++]); if (k < fila.length) setTimeout(lote, 40); };
    lote();
  }

  const progresso = () => {
    const r = sec.getBoundingClientRect();
    const curso = sec.offsetHeight - innerHeight;
    return Math.min(1, Math.max(0, -r.top / (curso || 1)));
  };
  const marcar = (p) => {
    for (const m of momentos) {
      const de = parseFloat(m.dataset.de), ate = parseFloat(m.dataset.ate);
      m.classList.toggle("is-on", p >= de && p < ate);
    }
    // dissolve no papel nos últimos 16% da rolagem
    papel.style.opacity = String(Math.min(1, Math.max(0, (p - 0.84) / 0.16)));
    sec.classList.toggle("andou", p > 0.02);
  };

  addEventListener("resize", ajustar);
  ajustar();
  if (reduzir) { marcar(0); return; }
  const quadro = () => {
    const p = progresso();
    alvo = p * (TOTAL - 1);
    atual += (alvo - atual) * 0.16; // suaviza: a câmera anda, não salta quadro a quadro
    if (Math.abs(alvo - atual) < 0.05) atual = alvo;
    desenhar(Math.round(atual));
    marcar(atual / (TOTAL - 1));
    requestAnimationFrame(quadro);
  };
  requestAnimationFrame(quadro);
})();
