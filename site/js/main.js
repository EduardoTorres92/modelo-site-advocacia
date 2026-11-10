/* Cláusula · movimento da página (GSAP + ScrollTrigger + Lenis, sem build).
   Regras: pins criados antes do Lenis; texto entra por marco com tempo (nunca arrastado por scrub);
   scrub só em imagem, vídeo e véu; movimento reduzido = sem Lenis, sem pin, sem scramble. */
(() => {
  const { gsap, ScrollTrigger } = window;
  const raiz = document.documentElement;
  const reduzido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const desktop = matchMedia("(min-width: 901px)").matches;
  const mouse = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const EASE = "expo.out";

  /* ── Grão: um ladrilho de ruído de 180 px, desenhado uma vez ── */
  (() => {
    const c = $(".grao");
    if (!c) return;
    const t = document.createElement("canvas");
    t.width = t.height = 180;
    const x = t.getContext("2d"), d = x.createImageData(180, 180);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0);
    const pintar = () => {
      c.width = c.offsetWidth; c.height = c.offsetHeight;
      const g = c.getContext("2d");
      g.fillStyle = g.createPattern(t, "repeat");
      g.fillRect(0, 0, c.width, c.height);
    };
    pintar();
    let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(pintar, 200); });
  })();

  /* ── Scramble: cada letra passa por símbolos e trava da esquerda para a direita ── */
  const SIMBOLOS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&/+=<>";
  const textos = new WeakMap();
  function embaralha(el, dur = 700) {
    if (reduzido || !el) return;
    const nos = [];
    const andar = (n) => { for (const f of n.childNodes) { if (f.nodeType === 3 && f.textContent.trim()) nos.push(f); else if (f.nodeType === 1) andar(f); } };
    andar(el);
    nos.forEach((n) => {
      if (!textos.has(n)) textos.set(n, n.textContent);
      const final = textos.get(n);
      if (n._raf) cancelAnimationFrame(n._raf);
      const t0 = performance.now();
      let ultimo = 0;
      const passo = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        if (t - ultimo > 33 || p === 1) {
          ultimo = t;
          const travadas = Math.floor(p * final.length);
          let s = "";
          for (let i = 0; i < final.length; i++) {
            const ch = final[i];
            s += i < travadas || /[\s·.,\/—→↓↗-]/.test(ch) ? ch : SIMBOLOS[(Math.random() * SIMBOLOS.length) | 0];
          }
          n.textContent = s;
        }
        if (p < 1) n._raf = requestAnimationFrame(passo); else n.textContent = final;
      };
      n._raf = requestAnimationFrame(passo);
    });
  }
  function trocaTexto(el, novo) {
    if (!el) return;
    el.textContent = novo;
    embaralha(el, 600);
  }

  /* ── Formulário de contato (FormSubmit) ── funciona mesmo sem GSAP ── */
  (() => {
    const f = $(".formulario");
    if (!f) return;
    const status = $(".formulario__status", f);
    const botao = $("button[type=submit]", f);
    const obrig = $$("[required]", f);
    obrig.forEach((c) => c.addEventListener("input", () => c.removeAttribute("aria-invalid")));
    f.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const ruins = obrig.filter((c) => !c.value.trim() || (c.type === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.value)));
      obrig.forEach((c) => c.toggleAttribute("aria-invalid", ruins.includes(c)));
      ruins.forEach((c) => c.setAttribute("aria-invalid", "true"));
      if (ruins.length) { status.classList.add("erro"); status.textContent = `Confira os campos marcados (${ruins.length}).`; ruins[0].focus(); return; }
      status.classList.remove("erro");
      status.textContent = "Enviando…";
      botao.disabled = true;
      try {
        const r = await fetch(f.dataset.endpoint, { method: "POST", headers: { Accept: "application/json" }, body: new FormData(f) });
        if (!r.ok) throw new Error();
        f.reset();
        status.textContent = "Recebido. Respondemos por e-mail ou telefone para marcar a conversa.";
      } catch {
        status.classList.add("erro");
        status.textContent = "Não foi enviado: a conexão falhou. O que você escreveu continua aqui; tente de novo ou chame no WhatsApp.";
      } finally { botao.disabled = false; }
    });
  })();

  /* ── Menu do celular ── */
  const menu = $("#menu"), botaoMenu = $(".nav__menu");
  let lenis = null;
  const fecharMenu = () => { menu.hidden = true; botaoMenu.setAttribute("aria-expanded", "false"); botaoMenu.textContent = "Menu"; raiz.classList.remove("menu-aberto"); lenis && lenis.start(); };
  botaoMenu.addEventListener("click", () => {
    const abrir = menu.hidden;
    if (!abrir) return fecharMenu();
    menu.hidden = false; botaoMenu.setAttribute("aria-expanded", "true"); botaoMenu.textContent = "Fechar"; raiz.classList.add("menu-aberto");
    lenis && lenis.stop();
    if (!reduzido && gsap) gsap.from($$("a", menu), { yPercent: 40, opacity: 0, duration: .6, stagger: .05, ease: EASE });
  });
  $$("a", menu).forEach((a) => a.addEventListener("click", fecharMenu));
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) fecharMenu(); });

  if (!gsap || !ScrollTrigger) { $$(".dossies").forEach((s) => s.classList.add("pilha")); $(".folha")?.classList.add("em2", "em3", "ok"); return; }
  gsap.registerPlugin(ScrollTrigger);

  /* ── Movimento reduzido: tudo visível, folha já assinada ── */
  if (reduzido) {
    $(".dossies").classList.add("pilha");
    $$(".dossie").forEach((d) => d.classList.add("on"));
    const folha = $(".folha");
    folha.classList.add("em2", "em3", "ok");
    $(".folha__versao").textContent = "Versão final · Aceita pelas partes";
    $$(".passos li").forEach((l) => l.classList.add("on"));
    $(".areas__lista li")?.classList.add("on");
    iniciaNav(null);
    iniciaEscritorioSimples();
    return;
  }

  /* Prepara as máscaras de texto (escondidas até o marco) */
  $$(".titulo, .areas__palavra").forEach((t) => t.classList.add("sobe"));
  const sobeLinhas = (el, extra = {}) => gsap.to($$(".linha > span", el), { yPercent: 0, y: 0, duration: 1, stagger: .09, ease: EASE, overwrite: true, ...extra });
  gsap.set($$(".sobe .linha > span"), { yPercent: 112 });

  /* ── 1. Hero ── */
  (() => {
    const hero = $(".hero"), fundo = $(".hero__fundo"), video = $(".hero__video");
    const economia = navigator.connection && navigator.connection.saveData;
    if (desktop && !economia && video) {
      video.src = video.dataset.src;
      video.preload = "auto";
      const tocar = () => video.play().then(() => video.classList.add("toca")).catch(() => {});
      video.addEventListener("canplay", tocar, { once: true });
      ScrollTrigger.create({ trigger: hero, start: "top bottom", end: "bottom top", onToggle: (s) => (s.isActive ? tocar() : video.pause()) });
    }
    const tl = gsap.timeline({ defaults: { ease: EASE } });
    tl.from(fundo, { scale: 1.08, duration: 2.2 }, 0)
      .add(sobeLinhas($(".hero__titulo"), { duration: 1.2, stagger: .12 }), .25)
      .from($$(".hero__titulo .selo"), { rotate: -90, duration: 1.2 }, .4)
      .from($(".hero__pe .fio"), { scaleX: 0, duration: 1.4 }, .5)
      .from($(".hero__fiozinho"), { scaleX: 0, duration: .9 }, .7)
      .from($$(".hero__servicos p, .hero__pe p"), { opacity: 0, duration: .5, stagger: .08 }, .7)
      .add(() => $$("[data-embaralha]").forEach((el, i) => setTimeout(() => embaralha(el, 900), i * 90)), .7);
  })();

  /* ── 2. Dossiês (peça principal) ── */
  const dossies = (() => {
    const sec = $(".dossies"), palco = $(".dossies__palco"), itens = $$(".dossie"), botoes = $$(".dossies__nomes button");
    const barra = $(".dossies__progresso i"), veu = $(".dossies__veu");
    let atual = -1, st = null;

    function entra(d, de) {
      const img = $(".dossie__foto img", d);
      const tl = gsap.timeline({ defaults: { ease: EASE } });
      tl.fromTo($(".dossie__foto", d), { opacity: de === -1 ? 1 : 0 }, { opacity: 1, duration: .9 }, 0)
        .fromTo(img, { scale: de === -1 ? 1 : 1.06 }, { scale: 1, duration: 1.6 }, 0)
        .fromTo($$(".linha > span", d), { yPercent: 112 }, { yPercent: 0, duration: 1, stagger: .09 }, .15)
        .fromTo($(".dossie__n", d), { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .9 }, .1)
        .fromTo($(".fio-v", d), { scaleY: 0 }, { scaleY: 1, duration: 1.1 }, .1)
        .fromTo($$(".tabela div", d), { "--f": 0 }, { "--f": 1, duration: .9, stagger: .07 }, .2)
        .fromTo($$(".dossie__meio p, .dossie__meio .botao, .dossie__num .mono, .tabela", d), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .7, stagger: .05 }, .3)
        .add(() => { embaralha($(".tabela", d), 800); embaralha($(".dossie__num .mono", d), 700); }, .3);
      return tl;
    }
    function sai(d, desce) {
      return gsap.timeline({ defaults: { ease: "power2.in" }, onComplete: () => d.classList.remove("sai") })
        .to($$(".linha > span", d), { yPercent: desce ? -112 : 112, duration: .45, stagger: .04 }, 0)
        .to($$(".dossie__meio p, .dossie__meio .botao, .tabela, .dossie__num", d), { opacity: 0, duration: .35 }, 0)
        .to($(".dossie__foto", d), { opacity: 0, duration: .7, ease: "power1.inOut" }, .1);
    }
    function ir(i) {
      if (i === atual) return;
      const antes = atual;
      if (antes >= 0) { itens[antes].classList.remove("on"); itens[antes].classList.add("sai"); sai(itens[antes], i > antes); }
      atual = i;
      itens[i].classList.remove("sai"); itens[i].classList.add("on");
      gsap.set($(".dossie__num", itens[i]), { opacity: 1 });
      entra(itens[i], antes);
      botoes.forEach((b, k) => b.classList.toggle("on", k === i));
    }

    if (!desktop) {
      sec.classList.add("pilha");
      itens.forEach((d) => {
        d.classList.add("on");
        gsap.set($$(".linha > span", d), { yPercent: 112 });
        ScrollTrigger.create({ trigger: d, start: "top 70%", once: true, onEnter: () => entra(d, 0) });
      });
      gsap.fromTo(veu, { scaleY: 1 }, { scaleY: .3, ease: "none", scrollTrigger: { trigger: sec, start: "top bottom", end: "top top", scrub: 1 } });
      return null;
    }

    itens.forEach((d) => { gsap.set($$(".linha > span", d), { yPercent: 112 }); gsap.set($(".dossie__foto", d), { opacity: 0 }); });
    // Passagem do hero: o hero escurece e estreita; os dossiês fazem o caminho inverso até a tela cheia
    gsap.timeline({ scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 1 } })
      .to(".hero__escuro", { opacity: .8, ease: "none" }, 0)
      .fromTo(".hero__fundo", { clipPath: "inset(0% 0% 0% 0%)" }, { clipPath: "inset(0% 6% 0% 6%)", ease: "none" }, 0)
      .fromTo(palco, { clipPath: "inset(0% 6% 0% 6%)" }, { clipPath: "inset(0% 0% 0% 0%)", ease: "none" }, 0)
      .fromTo(veu, { scaleY: 1 }, { scaleY: .22, ease: "none" }, 0)
      .fromTo($(".dossie__foto img", itens[0]), { scale: 1.16 }, { scale: 1, ease: "none" }, 0);
    gsap.set($(".dossie__foto", itens[0]), { opacity: 1 });
    itens[0].classList.add("on");

    const escolher = (p) => Math.min(itens.length - 1, Math.floor(p * itens.length));
    st = ScrollTrigger.create({
      trigger: sec, start: "top top", end: () => "+=" + innerHeight * itens.length, pin: palco, pinSpacing: true,
      onEnter: (s) => ir(escolher(s.progress)),
      onEnterBack: (s) => ir(escolher(s.progress)),
      onUpdate: (s) => { gsap.set(barra, { scaleX: s.progress }); if (atual >= 0) ir(escolher(s.progress)); },
      onLeave: () => ir(itens.length - 1),
    });
    botoes.forEach((b, k) => b.addEventListener("click", () => {
      const y = st.start + (st.end - st.start) * ((k + .5) / itens.length);
      lenis ? lenis.scrollTo(y, { duration: 1.2 }) : scrollTo({ top: y, behavior: "smooth" });
    }));
    return st;
  })();

  /* ── 3. Minuta ── */
  (() => {
    const sec = $(".minuta"), folha = $(".folha"), versao = $(".folha__versao"), legenda = $(".minuta__legenda");
    const passos = $$(".passos li");
    const LEGENDAS = [
      "Você escreve pelo formulário ou pelo WhatsApp e combinamos dia e hora, no escritório ou por vídeo.",
      "Lemos os seus documentos e explicamos por escrito os caminhos possíveis, os prazos e os riscos de cada um.",
      "Quando o processo anda, você recebe a notícia e o que ela muda no seu caso, direto do advogado responsável.",
    ];
    const VERSOES = ["Minuta v1 · Leitura", "Minuta v2 · Revisão", "Versão final · Aceita pelas partes"];
    // Inserções viram palavras (o espaço vai dentro do span) para entrar uma a uma
    $$("ins", folha).forEach((ins) => {
      const partes = ins.textContent.split(/(?<=\s)/);
      ins.innerHTML = partes.map((p, i) => `<span class="pal" style="animation-delay:${(.45 + i * .11).toFixed(2)}s">${p}</span>`).join("");
    });
    let passo = 0, aceite;
    function ir(n) {
      if (n === passo) return;
      passo = n;
      clearTimeout(aceite);
      folha.classList.toggle("em1", n >= 1);
      folha.classList.toggle("em2", n >= 2);
      folha.classList.toggle("em3", n >= 3);
      folha.classList.remove("ok");
      passos.forEach((l, i) => l.classList.toggle("on", i === n - 1));
      if (n >= 1) {
        trocaTexto(versao, VERSOES[Math.min(n, 2) - 1]); // o passo 3 continua em revisão até o aceite
        legenda.classList.add("troca");
        setTimeout(() => { legenda.textContent = LEGENDAS[n - 1]; legenda.classList.remove("troca"); }, 250);
      }
      if (n === 3) aceite = setTimeout(() => { folha.classList.add("ok"); trocaTexto(versao, VERSOES[2]); }, 1500);
    }
    ScrollTrigger.create({ trigger: sec, start: "top 60%", once: true, onEnter: () => sobeLinhas($(".minuta__titulo")) });

    if (desktop) {
      gsap.fromTo(folha, { yPercent: 14 }, { yPercent: -4, ease: "none", scrollTrigger: { trigger: sec, start: "top bottom", end: () => "+=" + innerHeight * 3.4, scrub: 1 } });
      const escolher = (p) => (p < .33 ? 1 : p < .66 ? 2 : 3);
      ScrollTrigger.create({
        trigger: sec, start: "top top", end: () => "+=" + innerHeight * 2.4, pin: $(".minuta__palco"),
        onEnter: (s) => ir(escolher(s.progress)), onEnterBack: (s) => ir(escolher(s.progress)),
        onUpdate: (s) => ir(escolher(s.progress)),
        onLeave: () => ir(3), onLeaveBack: () => { ir(1); },
      });
    } else {
      ScrollTrigger.create({ trigger: folha, start: "top 75%", onEnter: () => ir(1), onLeaveBack: () => ir(0) });
      ScrollTrigger.create({ trigger: $('[data-c="4"]', folha), start: "top 50%", onEnter: () => ir(2), onLeaveBack: () => ir(1) });
      ScrollTrigger.create({ trigger: $('[data-c="9"]', folha), start: "top 50%", onEnter: () => ir(3), onLeaveBack: () => ir(2) });
    }
  })();

  /* ── Títulos soltos: sobem por máscara quando chegam ── */
  [".consulta__titulo", ".escritorio__titulo", ".contato__titulo"].forEach((s) => {
    const el = $(s);
    ScrollTrigger.create({ trigger: el, start: "top 85%", once: true, onEnter: () => { sobeLinhas(el); const selo = $$(".selo", el); selo.length && gsap.from(selo, { rotate: -90, duration: 1.2, ease: EASE }); } });
  });
  ScrollTrigger.create({ trigger: ".processo", start: "top 85%", once: true, onEnter: () => embaralha($(".processo__head"), 800) });

  /* ── 4. Áreas ── */
  (() => {
    const sec = $(".areas"), linhas = $$(".areas__lista li");
    ScrollTrigger.create({ trigger: ".areas__lista", start: "top 80%", once: true, onEnter: () => gsap.to($$(".areas__palavra .linha > span"), { yPercent: 0, duration: 1.1, stagger: .07, ease: EASE }) });
    if (mouse && desktop) {
      const caixa = $(".areas__cursor"), img = $("img", caixa);
      const qx = gsap.quickTo(caixa, "x", { duration: .6, ease: "power3" }), qy = gsap.quickTo(caixa, "y", { duration: .6, ease: "power3" });
      const qr = gsap.quickTo(caixa, "rotation", { duration: .8, ease: "power3" });
      let ultimoX = 0;
      gsap.set(caixa, { xPercent: -50, yPercent: -50 });
      sec.addEventListener("pointermove", (e) => { qx(e.clientX); qy(e.clientY); qr(gsap.utils.clamp(-8, 8, (e.clientX - ultimoX) * .5)); ultimoX = e.clientX; });
      linhas.forEach((li) => {
        li.addEventListener("pointerenter", (e) => {
          linhas.forEach((l) => l.classList.toggle("on", l === li));
          img.src = li.dataset.foto;
          gsap.to(caixa, { opacity: 1, scale: 1, duration: .4, ease: EASE });
        });
      });
      $(".areas__lista").addEventListener("pointerleave", () => { linhas.forEach((l) => l.classList.remove("on")); gsap.to(caixa, { opacity: 0, scale: .9, duration: .3 }); });
      sec.addEventListener("pointerenter", (e) => { gsap.set(caixa, { x: e.clientX, y: e.clientY }); ultimoX = e.clientX; });
    } else {
      linhas.forEach((li) => ScrollTrigger.create({ trigger: li, start: "top 55%", end: "bottom 45%", onToggle: (s) => li.classList.toggle("on", s.isActive) }));
    }
  })();

  /* ── 5. Escritório ── */
  function trocaSocio(i) {
    const socios = $$(".socios li"), fotos = $$(".escritorio__fotos img"), legenda = $("[data-legenda]");
    const LEGENDAS = ["O escritório · Centro, Sorocaba", "Sala de reunião · Atendimento presencial", "Atendimento por vídeo · De qualquer lugar"];
    socios.forEach((l, k) => l.classList.toggle("on", k === i));
    fotos.forEach((f, k) => f.classList.toggle("on", k === i));
    trocaTexto(legenda, LEGENDAS[i]);
  }
  function iniciaEscritorioSimples() {
    $$(".socios button").forEach((b) => b.addEventListener("click", () => trocaSocio(+b.dataset.socio)));
  }
  (() => {
    const sec = $(".escritorio"), grade = $(".escritorio__grade"), n = $$(".socios li").length;
    gsap.from(".escritorio__fotos", { clipPath: "inset(100% 0% 0% 0%)", duration: 1.4, ease: "expo.inOut", scrollTrigger: { trigger: grade, start: "top 75%", once: true } });
    // a troca anda um sócio por vez, com pelo menos 0,45 s em cada
    let atual = 0, alvo = 0, ocupado = false;
    const andar = () => {
      if (ocupado || atual === alvo) return;
      ocupado = true;
      atual += alvo > atual ? 1 : -1;
      trocaSocio(atual);
      setTimeout(() => { ocupado = false; andar(); }, 450);
    };
    const pedir = (i) => { alvo = i; andar(); };
    if (desktop) {
      const st = ScrollTrigger.create({
        trigger: grade, start: () => (grade.offsetHeight < innerHeight ? "center center" : "top top+=" + 84), end: () => "+=" + innerHeight * .55 * n, pin: true,
        onUpdate: (s) => pedir(Math.min(n - 1, Math.floor(s.progress * n))),
        onLeave: () => pedir(n - 1),
      });
      $$(".socios button").forEach((b) => b.addEventListener("click", () => {
        const y = st.start + (st.end - st.start) * ((+b.dataset.socio + .5) / n);
        lenis ? lenis.scrollTo(y, { duration: 1 }) : scrollTo({ top: y, behavior: "smooth" });
      }));
    } else {
      $$(".socios li").forEach((li, i) => ScrollTrigger.create({ trigger: li, start: "top 60%", end: "bottom 60%", onToggle: (s) => s.isActive && pedir(i) }));
      iniciaEscritorioSimples();
    }
    // números contam até o valor
    $$("[data-conta]").forEach((b) => {
      const fim = +b.dataset.conta, o = { v: 0 };
      b.textContent = "0";
      ScrollTrigger.create({ trigger: desktop ? grade : b, start: desktop ? "top 70%" : "top 90%", once: true, onEnter: () => gsap.to(o, { v: fim, duration: 1.4, ease: "power2.out", onUpdate: () => (b.textContent = Math.round(o.v)) }) });
    });
    $$(".numeros li").forEach((li, i) => gsap.from(li, { opacity: 0, y: 16, duration: .8, delay: i * .08, ease: EASE, scrollTrigger: { trigger: desktop ? grade : li, start: desktop ? "top 70%" : "top 92%", once: true } }));
  })();

  /* ── 6. Contato: parallax leve na foto ── */
  gsap.fromTo(".contato__foto", { yPercent: -6 }, { yPercent: 6, ease: "none", scrollTrigger: { trigger: ".contato", start: "top bottom", end: "bottom top", scrub: 1 } });

  /* ── Lenis (depois dos pins) ── */
  lenis = new window.Lenis({ lerp: .1, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  ScrollTrigger.addEventListener("refresh", () => lenis.resize());
  $$('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
    const alvo = a.getAttribute("href");
    if (alvo.length < 2) return;
    const el = $(alvo);
    if (!el) return;
    e.preventDefault();
    lenis.scrollTo(el, { offset: alvo === "#topo" ? 0 : 0, duration: 1.4 });
  }));

  iniciaNav(lenis);
  iniciaBarra(lenis);
  addEventListener("load", () => ScrollTrigger.refresh());

  /* ── Nav: some ao descer, volta ao subir ── */
  function iniciaNav(l) {
    const nav = $(".nav");
    let ultimo = 0;
    const ver = (y) => {
      nav.classList.toggle("solida", y > 40);
      if (raiz.classList.contains("menu-aberto")) return;
      if (y > ultimo + 4 && y > innerHeight * .4) nav.classList.add("escondida");
      else if (y < ultimo - 4 || y < 40) nav.classList.remove("escondida");
      ultimo = y;
    };
    if (l) l.on("scroll", (e) => ver(e.scroll)); else addEventListener("scroll", () => ver(scrollY), { passive: true });
  }

  /* ── Barra de rolagem própria: um fio claro por cima da página ── */
  function iniciaBarra(l) {
    const barra = $(".barra"), fio = $("span", barra);
    let some;
    const medir = () => {
      const total = document.documentElement.scrollHeight, h = innerHeight;
      const alt = Math.max(36, h * (h / total));
      fio.style.height = alt + "px";
      return { total, h, alt };
    };
    let m = medir();
    addEventListener("resize", () => (m = medir()));
    ScrollTrigger.addEventListener("refresh", () => (m = medir()));
    const mostrar = () => { barra.classList.add("on"); clearTimeout(some); some = setTimeout(() => !barra.classList.contains("arrasta") && barra.classList.remove("on"), 900); };
    l.on("scroll", (e) => {
      const p = e.scroll / Math.max(1, m.total - m.h);
      fio.style.transform = `translateY(${p * (m.h - m.alt)}px)`;
      mostrar();
    });
    fio.addEventListener("pointerenter", mostrar);
    fio.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      barra.classList.add("arrasta", "on");
      const y0 = e.clientY, s0 = l.scroll;
      const mover = (ev) => l.scrollTo(s0 + (ev.clientY - y0) * ((m.total - m.h) / (m.h - m.alt)), { immediate: true });
      const soltar = () => { barra.classList.remove("arrasta"); mostrar(); removeEventListener("pointermove", mover); removeEventListener("pointerup", soltar); };
      addEventListener("pointermove", mover);
      addEventListener("pointerup", soltar);
    });
  }
})();
