/* ---------- acesso aos dados ----------
   Servidor local (padrão) ou site estático da demonstração pública, que
   define window.ENTRELINHAS_API (docs/estatico.js) e reproduz gravações. */
const API = window.ENTRELINHAS_API ?? {
  estatico: false,
  async status() { return (await fetch("/api/status")).json(); },
  async verificar(corpo) {
    const resposta = await fetch("/api/verificar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo)
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados.erro || "Something went wrong. Please try again.");
    return dados;
  }
};

"use strict";

// Interface do Entrelinhas (inglês). Todo conteúdo vindo do servidor é
// inserido com textContent, nunca innerHTML.

const VEREDITOS = {
  ATUAL: { nome: "Current", tom: "tom-bom", atencao: false,
    texto: "An official source with a date tied to this exact fact supports the claim. Not an absolute guarantee of truth." },
  CORROBORADA: { nome: "Corroborated", tom: "tom-corroborado", atencao: false,
    texto: "Several independent sources of different types support the claim and none contradicts it. No official source dates this exact fact." },
  SUPORTE_FRACO: { nome: "Supported, unconfirmed", tom: "tom-cautela", atencao: false,
    texto: "Some sources support the claim, but not enough independent or official evidence to confirm it is true today." },
  CONFLITO: { nome: "Conflicting", tom: "tom-conflito", atencao: true,
    texto: "Sources disagree and none settles it. Review the evidence before relying on this claim." },
  CONTRADICAO_FRACA: { nome: "Contradicted by sources", tom: "tom-ruim", atencao: true,
    texto: "The sources found contradict this claim. If an AI said it, the answer is possibly outdated or wrong. No official source dates this exact fact, so treat it as a strong warning, not a final ruling." },
  CONTRADITA_POR_FONTE_ATUAL: { nome: "Likely outdated", tom: "tom-ruim", atencao: true,
    texto: "A current official source contradicts this claim. If an AI said it, the answer is probably outdated." },
  NAO_VERIFICAVEL: { nome: "Not verifiable", tom: "tom-neutro", atencao: false,
    texto: "No usable evidence was found. This does not mean the claim is false." }
};
const ORDEM = ["CONTRADITA_POR_FONTE_ATUAL", "CONTRADICAO_FRACA", "CONFLITO", "SUPORTE_FRACO", "CORROBORADA", "ATUAL", "NAO_VERIFICAVEL"];

const CATEGORIAS = {
  preco: ["Price", 30], versao_api: ["API / software version", 90], empresa: ["Company information", 180], regulamento: ["Regulation", 365]
};
const PLURAIS = { preco: "prices", versao_api: "API versions", empresa: "company facts", regulamento: "regulations" };
const ORIGEM = { CONFIGURADO: "set by you", MODELO: "detected by the model", HEURISTICA: "detected by keyword rules" };
const TIPOS_FONTE = { OFICIAL: "Official", NOTICIA: "News", ACADEMICO: "Scientific", REFERENCIA: "Reference", OUTRO: "Other website", BLOG_FORUM: "Blog / forum" };
const ORDEM_TIPOS = ["OFICIAL", "NOTICIA", "ACADEMICO", "REFERENCIA", "OUTRO", "BLOG_FORUM"];
const COBERTURA = { STRONG: "strong coverage", MODERATE: "moderate coverage", WEAK: "a single source", NONE: "no usable source" };

// O motor escreve algumas notas em português; aqui ficam as versões em inglês.
const TRADUCOES = [
  [/^Índice temporal determinístico/, "Deterministic freshness index; not a probability of truth."],
  [/^Datas de página sem vínculo explícito/, "Page dates not explicitly tied to this fact were excluded from the freshness score."],
  [/^Não há evidência com data verificável ligada ao atributo/, "No source gives a verifiable date tied to this specific fact."],
  [/^Não existe uma janela temporal definida/, "This claim has no category, so there is no validity window for its dates."],
  [/^Uma data da página ou do resultado de busca não comprova/, "A page or search-result date does not prove when this specific fact was published or updated."],
  [/^A data da consulta registra quando a página foi observada/, "Retrieval time shows when we read the page; it never replaces a publication or update date."],
  [/^Evidências do mesmo domínio, URL canônica/, "Sources from the same site, the same canonical URL or near-identical text were grouped so they cannot inflate agreement."],
  [/^Cópias exatas, quase duplicadas/, "Copies, near-duplicates, identical canonical URLs and pages from one site count as one voice; other sites are not proven editorially independent."],
  [/^Domínios sem sinal detectado de duplicação/, "Sites without a detected copy signal are not proven independent; heavily edited republications can slip through."],
  [/^Existe uma evidência contraditória antiga/, "An older contradicting source was considered but did not outweigh the current official source."],
  [/^Foram encontradas posturas divergentes/, "Sources, or pages of the same site, disagree. The conflict was not resolved."],
  [/^Nenhuma fonte pertence ao cadastro de domínios oficiais/, "No source belongs to the official domains you provided."],
  [/^Nenhuma evidência possui data verificável e status/, "No source has a verifiable, current date."],
  [/^Nenhuma evidência utilizável/, "No usable source both matched the claim and took a position on it."],
  [/^Não há evidências utilizáveis/, "There is no usable evidence to say whether the claim is supported or contradicted."],
  [/^Baseado na data da página/, "Based on page dates, not on when this specific fact changed: low confidence."],
  [/^Não substitui o índice de atualidade principal/, "Does not replace the main freshness score and is not a probability of truth."],
  [/^Nenhuma fonte utilizável declara data/, "No usable source declares a valid publication or update date."],
  [/^Sem categoria temporal/, "Without a category there is no validity window to compare dates against."],
  [/^Qualidade estrutural das evidências/, "Structural quality of the evidence, not a probability of truth."]
];
const emIngles = texto => (TRADUCOES.find(([re]) => re.test(texto))?.[1]) ?? texto;

const estado = { status: null, inicio: 0, temporizador: null };
const $ = id => document.getElementById(id);

function el(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined && texto !== null) e.textContent = String(texto);
  return e;
}

function modo() {
  return document.querySelector('input[name="modo"]:checked')?.value ?? "exemplo";
}

function dominioDe(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function formatarData(valor) {
  if (!valor) return "not stated";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return String(valor);
  return /T\d/.test(String(valor)) ? d.toISOString().replace("T", " ").slice(0, 16) + " UTC" : String(valor).slice(0, 10);
}

/* ---------- entrada ---------- */

function detectarIdiomaRapido(texto) {
  const t = ` ${texto.toLowerCase()} `;
  const pt = (t.match(/ (de|do|da|que|não|nao|para|com|uma|custa|atualmente|é) /g) ?? []).length + (/r\$\s?\d/.test(t) ? 2 : 0) + (t.match(/[ãõç]/g) ?? []).length;
  const en = (t.match(/ (the|of|and|is|are|with|for|costs|still|current) /g) ?? []).length;
  if (pt + en < 2) return "";
  return pt > en ? "Portuguese detected: numbers, qualifiers and dates will be read the Brazilian way." : "";
}

function atualizarEntrada() {
  const texto = $("texto").value;
  $("contador").textContent = texto.length.toLocaleString("en-US");
  $("idioma-detectado").textContent = detectarIdiomaRapido(texto);
}

function mostrarMensagem(texto) { $("mensagem").textContent = texto || ""; }

function configurarModo() {
  const real = Boolean(estado.status?.modo_real_disponivel);
  const selo = $("selo-modo");
  selo.textContent = real ? "Live checks on" : "Demo mode";
  selo.classList.toggle("real", real);
  const opcao = $("opcao-real");
  const radio = opcao.querySelector("input");
  radio.disabled = !real;
  opcao.classList.toggle("desativado", !real);
  opcao.querySelector("span").textContent = API.estatico
    ? "Recorded live checks"
    : real
      ? "Live check"
      : "Live check (needs API keys)";
  if (API.estatico) selo.textContent = "Public demo";
  (real ? radio : document.querySelector('input[name="modo"][value="exemplo"]')).checked = true;
  const atualizarQueda = () => {
    const temReserva = (estado.status?.bifrost?.reservas ?? []).length > 0;
    $("opcao-queda").hidden = API.estatico || !(modo() === "real" && temReserva);
  };
  for (const r of document.querySelectorAll('input[name="modo"]')) r.addEventListener("change", atualizarQueda);
  atualizarQueda();
}

function montarExemplos() {
  const caixa = $("exemplos");
  caixa.replaceChildren();
  // Gravações de checagens reais primeiro (só na demonstração pública).
  for (const g of estado.status?.gravacoes ?? []) {
    const b = el("button", "gravacao", g.rotulo);
    b.type = "button";
    b.title = "Recorded live check: real Tavily search and Bifrost model calls";
    b.addEventListener("click", () => {
      $("texto").value = g.texto;
      $("dominios").value = "";
      const real = document.querySelector('input[name="modo"][value="real"]');
      if (real && !real.disabled) real.checked = true;
      atualizarEntrada();
      mostrarMensagem("");
    });
    caixa.append(b);
  }
  for (const ex of estado.status?.exemplos ?? []) {
    const b = el("button", null, ex.rotulo);
    b.type = "button";
    b.title = "Built-in example: the real engine with simulated, fictional sources";
    b.addEventListener("click", () => {
      $("texto").value = ex.texto;
      $("dominios").value = ex.dominios.join(", ");
      document.querySelector('input[name="modo"][value="exemplo"]').checked = true;
      atualizarEntrada();
      mostrarMensagem("");
    });
    caixa.append(b);
  }
  // Lista enxuta: três visíveis, o resto atrás de "More".
  const botoes = [...caixa.querySelectorAll("button")];
  if (botoes.length > 4) {
    botoes.slice(3).forEach(b => { b.hidden = true; });
    const mais = el("button", "mais", `More (${botoes.length - 3})`);
    mais.type = "button";
    mais.addEventListener("click", () => { botoes.forEach(b => { b.hidden = false; }); mais.remove(); });
    caixa.append(mais);
  }
  // "See a real check": carrega a primeira gravação real (ou o primeiro exemplo) e já verifica.
  const verReal = $("ver-real");
  const primeiro = caixa.querySelector("button.gravacao") ?? caixa.querySelector("button");
  verReal.hidden = !primeiro;
  if (!caixa.querySelector("button.gravacao")) verReal.textContent = "See an example check";
  verReal.onclick = () => { if (!primeiro) return; primeiro.click(); verificar(); };
}

// Botão de favoritos: selecione um trecho em qualquer site (ChatGPT, Gemini,
// um blog) e clique; o Entrelinhas abre com o texto preenchido.
function configurarFavorito() {
  const link = $("favorito");
  if (!link) return;
  const destino = API.estatico ? "http://localhost:3000" : location.origin;
  const codigo = `(()=>{const t=String(getSelection()).trim()||prompt('Paste the AI answer to check');if(t)open('${destino}/?text='+encodeURIComponent(t.slice(0,4000)),'_blank')})()`;
  link.setAttribute("href", `javascript:${codigo}`);
  link.addEventListener("click", e => { e.preventDefault(); mostrarMensagem("Drag this button to your bookmarks bar, then use it on any page with an AI answer."); });
  $("favorito-destino").textContent = destino;
}

function montarLegenda() {
  const caixa = $("legenda");
  caixa.replaceChildren();
  const grupos = [
    ["It holds", "g-holds", ["ATUAL", "CORROBORADA"]],
    ["Look closer", "g-closer", ["SUPORTE_FRACO", "CONFLITO", "NAO_VERIFICAVEL"]],
    ["It has expired", "g-expired", ["CONTRADICAO_FRACA", "CONTRADITA_POR_FONTE_ATUAL"]]
  ];
  for (const [nome, cor, codigos] of grupos) {
    const grupo = el("div", `ladrilho legenda-grupo ${cor}`);
    grupo.append(el("p", "rotulo", nome));
    for (const codigo of codigos) {
      const v = VEREDITOS[codigo];
      const item = el("div", "legenda-item");
      item.append(el("span", `pilula ${v.tom}`, v.nome), el("p", null, v.texto));
      grupo.append(item);
    }
    caixa.append(grupo);
  }
  const extras = [
    ["Source agreement, 0 to 100", "How much independent sources agree with the claim. Official and scientific sources weigh 3, news 2, references 1.5, other websites 1, blogs and forums 0.25. Copies and pages of one site count once."],
    ["Freshness, 0 to 100", "For prices, API versions, regulations and company facts: how recent the date tied to this exact fact is. A page's publish date never counts as proof."]
  ];
  const notas = el("div", "legenda-notas");
  for (const [titulo, texto] of extras) {
    const bloco = el("div");
    bloco.append(el("h3", null, titulo), el("p", null, texto));
    notas.append(bloco);
  }
  caixa.append(notas);
}

/* ---------- progresso ---------- */

function iniciarProgresso() {
  const secao = $("progresso");
  const itens = [...secao.querySelectorAll("li")];
  secao.hidden = false;
  estado.inicio = Date.now();
  const real = modo() === "real";
  const marcos = real ? [0, 6, 20, 0] : [0, 0.3, 0.6, 0.9];
  clearInterval(estado.temporizador);
  estado.temporizador = setInterval(() => {
    const s = (Date.now() - estado.inicio) / 1000;
    let ativa = 0;
    marcos.forEach((m, i) => { if (s >= m && (i < 3 || !real)) ativa = i; });
    if (real && s > 40) ativa = 3;
    itens.forEach((li, i) => { li.classList.toggle("ativa", i === ativa); li.classList.toggle("feita", i < ativa); });
    if (real) {
      $("tempo-decorrido").textContent = `${Math.round(s)} s elapsed.` + (s >= 20
        ? " Each claim is searched and read live; free model tiers add short waits when rate limits are hit, so a full answer can take a minute or two."
        : "");
    } else {
      $("tempo-decorrido").textContent = "";
    }
  }, 250);
}

function pararProgresso() {
  clearInterval(estado.temporizador);
  $("progresso").hidden = true;
}

/* ---------- verificação ---------- */

async function verificar() {
  const texto = $("texto").value.trim();
  if (!texto) { mostrarMensagem("Paste an AI answer first."); $("texto").focus(); return; }
  const norm = v => String(v ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  if (!API.estatico && modo() === "exemplo" && !(estado.status?.exemplos ?? []).some(e => norm(e.texto) === norm(texto))) {
    mostrarMensagem("Example mode only checks the built-in examples. Pick one above, or run the server with Tavily and Bifrost keys to check your own text.");
    return;
  }
  const dominiosOficiais = $("dominios").value.split(/[\s,;]+/).map(d => d.trim()).filter(Boolean);
  const botao = $("botao-verificar");
  botao.disabled = true;
  botao.textContent = "Checking…";
  mostrarMensagem("");
  $("resultado").hidden = true;
  iniciarProgresso();
  try {
    const dados = await API.verificar({ texto, modo: modo(), dominiosOficiais, simularQuedaModelo: modo() === "real" && $("simular-queda").checked });
    renderizarResultado(dados);
    $("resultado").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (erro) {
    mostrarMensagem(erro.message || "Something went wrong. Please try again.");
  } finally {
    pararProgresso();
    botao.disabled = false;
    botao.textContent = "Check answer";
  }
}

/* ---------- resultado ---------- */

function renderizarResultado(dados) {
  $("resultado").hidden = false;
  $("aviso-simulado").hidden = !dados.simulado;
  const g = dados.gravacao;
  $("aviso-gravado").hidden = !g;
  if (g) $("aviso-gravado").textContent = `Recorded live check from ${formatarDataCurta(String(g.data).slice(0, 10))}: real web sources found with Tavily and real model calls through Bifrost, replayed here without API keys. To check your own text, run Entrelinhas locally (see the GitHub README).`;
  const afirmacoes = dados.afirmacoes ?? [];
  const porVeredito = {};
  for (const a of afirmacoes) {
    const v = a.agregacao?.veredito ?? "NAO_VERIFICAVEL";
    porVeredito[v] = (porVeredito[v] ?? 0) + 1;
  }
  const atencao = afirmacoes.filter(a => VEREDITOS[a.agregacao?.veredito]?.atencao).length;
  $("resumo-frase").textContent = afirmacoes.length === 0
    ? "No verifiable claims were found in this text."
    : `${afirmacoes.length} claim${afirmacoes.length > 1 ? "s" : ""} checked. ` +
      (atencao === 0 ? "None was contradicted by the sources found." : `${atencao} need${atencao > 1 ? "" : "s"} attention: the sources contradict or dispute ${atencao > 1 ? "them" : "it"}.`);
  const contagens = $("contagens");
  contagens.replaceChildren();
  for (const v of ORDEM) {
    if (!porVeredito[v]) continue;
    contagens.append(el("span", `pilula ${VEREDITOS[v].tom}`, `${porVeredito[v]} ${VEREDITOS[v].nome}`));
  }
  const omitidas = dados.afirmacoes_omitidas ?? [];
  $("omitidas").hidden = omitidas.length === 0;
  $("omitidas").textContent = omitidas.length ? `${omitidas.length} more claim(s) were not checked to limit cost. Send them separately.` : "";
  $("cartoes").replaceChildren(...afirmacoes.map(a => criarCartao(a, dados.simulado)));
  mostrarCorrigida(dados);
  mostrarTriagem(afirmacoes);
  mostrarGateway(dados.gateway, dados.simulado);
  $("rastreio").textContent = `Verification ${dados.id_verificacao} · ${dados.rastreabilidade_modelo?.length ?? 0} model calls via ${dados.simulado ? "simulated provider" : "Bifrost"} · ${dados.rastreabilidade_pesquisa?.length ?? 0} search operations via ${dados.simulado ? "simulated provider" : "Tavily"} · ${dados.duracao_ms ?? "n/a"} ms · stored in SQLite (in memory)`;
}

// Resposta corrigida: texto com citações [n] viradas em links seguros.
function mostrarCorrigida(dados) {
  const rc = dados.resposta_corrigida;
  const painel = $("corrigida");
  if (!rc || !rc.texto) { painel.hidden = true; return; }
  painel.hidden = false;
  $("corrigida-original").textContent = dados.texto_original ?? "";
  const alvo = $("corrigida-texto");
  alvo.replaceChildren();
  const porNumero = new Map((rc.fontes ?? []).map(f => [f.n, f]));
  for (const parte of rc.texto.split(/(\[\d{1,2}\])/)) {
    const m = /^\[(\d{1,2})\]$/.exec(parte);
    const fonte = m ? porNumero.get(Number(m[1])) : null;
    if (fonte) {
      const sup = el("sup");
      const a = el("a", "ref", `[${fonte.n}]`);
      a.href = `#ref-${fonte.n}`;
      sup.append(a);
      alvo.append(sup);
    } else {
      alvo.append(document.createTextNode(parte));
    }
  }
  const lista = $("corrigida-fontes");
  lista.replaceChildren();
  for (const n of rc.fontes_citadas ?? []) {
    const f = porNumero.get(n);
    if (!f) continue;
    const li = el("li");
    li.id = `ref-${n}`;
    li.value = n;
    li.append(el("span", `selo-postura ${f.postura === "CONTRADICTS" ? "c" : "a"}`, f.postura === "CONTRADICTS" ? "Contradicts the AI" : "Supports"));
    li.append(el("span", "tipo-ref", TIPOS_FONTE[f.tipo] ?? f.tipo));
    if (f.url && /^https?:\/\//.test(f.url)) {
      const a = el("a", null, f.titulo || f.url);
      a.href = f.url; a.target = "_blank"; a.rel = "noopener noreferrer";
      li.append(a);
    } else {
      li.append(el("span", null, f.titulo || "Source"));
    }
    if (f.data) li.append(el("span", "data-ref", formatarDataCurta(f.data)));
    lista.append(li);
  }
}

const RITMOS = {
  preco: "prices change about monthly",
  versao_api: "versions about quarterly",
  empresa: "company facts about every six months",
  regulamento: "rules about yearly"
};
const RISCOS = { HIGH: "High stale risk", MEDIUM: "Medium stale risk", LOW: "Low stale risk" };

// Triagem: quais afirmações podem ter envelhecido, e por quê (antes da busca).
function mostrarTriagem(afirmacoes) {
  const lista = $("triagem-lista");
  lista.replaceChildren();
  const comRisco = afirmacoes.filter(a => a.risco_desatualizacao);
  $("triagem").hidden = comRisco.length === 0;
  for (const a of comRisco) {
    const r = a.risco_desatualizacao;
    const li = el("li", `risco-${r.nivel.toLowerCase()}`);
    const topo = el("div", "triagem-topo");
    topo.append(el("span", `pilula-risco risco-${r.nivel.toLowerCase()}`, RISCOS[r.nivel] ?? r.nivel));
    topo.append(el("span", "triagem-texto", a.texto));
    li.append(topo);
    li.append(el("p", "dica", r.motivos.join(" · ")));
    lista.append(li);
  }
  const sensiveis = comRisco.filter(a => a.risco_desatualizacao.sensivel_ao_tempo);
  const ritmos = [...new Set(sensiveis.map(a => a.tipo_afirmacao).filter(t => RITMOS[t]))].map(t => RITMOS[t]);
  $("triagem-resumo").textContent =
    `${comRisco.length} claim${comRisco.length === 1 ? "" : "s"} found · ${sensiveis.length} time-sensitive` +
    (ritmos.length ? `: ${ritmos.join(", ")}.` : ".");
}

// Painel do Bifrost: cadeia de modelos, quem respondeu, failover e tokens.
function mostrarGateway(g, simulado) {
  const painel = $("gateway");
  const caixa = $("gateway-conteudo");
  caixa.replaceChildren();
  if (!g || simulado || g.chamadas === 0) { painel.hidden = true; return; }
  painel.hidden = false;

  const cadeia = el("ol", "cadeia");
  g.cadeia_modelos.forEach((m, i) => {
    const usado = g.respostas_por_modelo.some(r => r.modelo === m || m.endsWith(`/${r.modelo}`) || r.modelo.endsWith(m.split("/").slice(1).join("/")));
    const li = el("li", usado ? "usado" : (g.queda_simulada && i === 0 ? "caiu" : null));
    li.append(el("span", "papel", i === 0 ? "Main" : `Backup ${i}`));
    li.append(el("code", null, m));
    if (g.queda_simulada && i === 0) li.append(el("span", "nota-cadeia", "simulated outage"));
    else if (usado) li.append(el("span", "nota-cadeia", "answered"));
    cadeia.append(li);
  });
  caixa.append(cadeia);

  const numeros = el("div", "gateway-numeros");
  const n = (valor, rotulo) => { const d = el("div"); d.append(el("strong", null, valor), el("span", null, rotulo)); numeros.append(d); };
  n(String(g.chamadas), g.chamadas === 1 ? "model call" : "model calls");
  n(String(g.respostas_de_reserva), "answered by a backup");
  n(g.tokens_total !== null ? g.tokens_total.toLocaleString("en-US") : "n/a", "tokens");
  n(g.latencia_media_ms !== null ? `${(g.latencia_media_ms / 1000).toFixed(1)} s` : "n/a", "avg. model latency");
  caixa.append(numeros);

  const quem = g.respostas_por_modelo.map(r => `${r.modelo} (${r.chamadas})`).join(", ");
  caixa.append(el("p", "dica", `Answered by: ${quem || "n/a"}.${g.falhas ? ` ${g.falhas} call(s) failed.` : ""}`));
  if (g.queda_simulada) {
    caixa.append(el("p", "aviso", g.respostas_de_reserva > 0
      ? `Outage drill: the main model was unavailable, and Bifrost served ${g.respostas_de_reserva} of ${g.chamadas} calls from a backup model. Entrelinhas sent the same request and changed nothing.`
      : "Outage drill: the backup did not answer. Check that the backup models are enabled for this key in Bifrost."));
  }
}

function metrica(rotulo) {
  const caixa = el("div", "metrica");
  caixa.append(el("p", "metrica-rotulo", rotulo));
  return caixa;
}

function valorComBarra(caixa, valor, cor) {
  if (valor === null || valor === undefined) {
    caixa.append(el("p", "metrica-valor vazio", "Not determinable"));
    const trilho = el("div", "trilho"); trilho.append(el("span")); trilho.firstChild.style.width = "0";
    caixa.append(trilho);
    return;
  }
  const v = el("p", "metrica-valor", String(valor));
  v.append(el("small", null, " / 100"));
  caixa.append(v);
  const trilho = el("div", "trilho");
  const barra = el("span");
  barra.style.width = `${Math.max(2, Math.min(100, valor))}%`;
  barra.style.setProperty("--cor-barra", cor);
  trilho.append(barra);
  caixa.append(trilho);
}

function corDoValor(valor) {
  if (valor === null || valor === undefined) return "#9aa0aa";
  if (valor >= 70) return "var(--verde)";
  if (valor >= 40) return "#d9a520";
  return "var(--vermelho)";
}

const STATUS_ATUALIDADE = {
  CURRENT: { texto: "Current: confirmed within its validity window", cor: "var(--verde)" },
  AGING: { texto: "Aging: only older sources confirm it", cor: "#d9a520" },
  UNCERTAIN: { texto: "Uncertain: sources are split", cor: "#d9a520" },
  CONTRADICTED: { texto: "Outdated: current sources contradict it", cor: "var(--vermelho)" }
};
const FUNDAMENTOS = {
  FACT_DATE: "dates the sources give for this fact",
  PAGE_DATE: "page dates (not proof of when the fact changed)",
  PAGE_DATE_GENERAL_WINDOW: "page dates (not proof of when the fact changed)"
};
const CONFIANCAS = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };

// Idade legível de uma data: "today", "2 days ago", "3 months ago".
function idadeLegivel(dias) {
  if (!Number.isInteger(dias) || dias < 0) return null;
  if (dias === 0) return "today";
  if (dias === 1) return "yesterday";
  if (dias < 60) return `${dias} days ago`;
  const meses = Math.round(dias / 30);
  if (meses < 24) return `${meses} months ago`;
  return `${Math.round(dias / 365)} years ago`;
}

function criarMetricas(afirmacao) {
  const ag = afirmacao.agregacao ?? {};
  const conc = ag.concordancia ?? null;
  const fr = ag.freshness ?? null;
  const rec = ag.recencia_pagina ?? null;
  const grade = el("div", "metricas");

  // 1. Concordância entre fontes
  const m1 = metrica("Source agreement");
  if (conc && conc.independent_sources > 0) {
    valorComBarra(m1, conc.score, corDoValor(conc.score));
    m1.append(el("p", "metrica-nota", `${conc.independent_sources} independent source${conc.independent_sources > 1 ? "s" : ""}: ${conc.supporting} agree, ${conc.contradicting} disagree${conc.split ? `, ${conc.split} mixed` : ""}.`));
  } else {
    m1.append(el("p", "metrica-etiqueta", "No source took a position"));
  }
  grade.append(m1);

  // 2. Nota de atualidade da afirmação (recência das fontes × apoio)
  const m2 = metrica("Freshness score");
  const at = ag.atualidade_afirmacao ?? null;
  const cat = CATEGORIAS[afirmacao.tipo_afirmacao];
  if (at && Number.isFinite(at.score)) {
    const st = STATUS_ATUALIDADE[at.status] ?? STATUS_ATUALIDADE.UNCERTAIN;
    valorComBarra(m2, at.score, st.cor);
    const idade = idadeLegivel(at.newest_age_days);
    const rotuloStatus = at.status === "CURRENT" && idade && at.window_days
      ? `Current: a source from ${idade} confirms it, inside the ${at.window_days}-day window`
      : st.texto;
    m2.append(el("p", `metrica-etiqueta status-${at.status.toLowerCase()}`, rotuloStatus));
    if (at.status === "CURRENT" && at.score < 50) {
      m2.append(el("p", "metrica-nota", "The score is lower because most confirming pages are older. The newest one is what keeps the claim current."));
    }
    const janela = at.basis === "PAGE_DATE_GENERAL_WINDOW"
      ? `general ${at.window_days}-day window`
      : cat ? `${cat[1]}-day window for ${PLURAIS[afirmacao.tipo_afirmacao]}` : "";
    m2.append(el("p", "metrica-nota",
      `Source recency ${at.evidence_recency} × support ${Math.round(at.support_share * 100)}%. ` +
      `Based on ${FUNDAMENTOS[at.basis] ?? "source dates"}${janela ? ` · ${janela}` : ""}` +
      `${at.newest_date ? ` · newest ${formatarDataCurta(at.newest_date)}` : ""}.`));
    m2.append(el("p", `confianca conf-${(at.confidence ?? "low").toLowerCase()}`, `${CONFIANCAS[at.confidence] ?? "Low"} confidence`));
  } else {
    m2.append(el("p", "metrica-etiqueta", at?.reason === "NO_SOURCE_DATE" ? "Not scored: no source gave a date" : "Not scored: no source took a position"));
    m2.append(el("p", "metrica-nota", at?.reason === "NO_SOURCE_DATE"
      ? "Sources discussed the claim but none says when it was published or updated."
      : "None of the sources found confirms or contradicts this claim."));
  }
  grade.append(m2);

  // 3. Quem diz o quê
  const m3 = metrica("Who says what");
  const lista = el("ul", "mix");
  const porTipo = {};
  for (const e of afirmacao.evidencias ?? []) {
    const tipo = e.fonte?.categoria_fonte ?? "OUTRO";
    porTipo[tipo] ??= { a: 0, c: 0, n: 0 };
    const p = e.classificacao?.postura;
    if (p === "SUPPORTS") porTipo[tipo].a += 1; else if (p === "CONTRADICTS") porTipo[tipo].c += 1; else porTipo[tipo].n += 1;
  }
  const tipos = ORDEM_TIPOS.filter(t => porTipo[t]);
  if (tipos.length === 0) lista.append(el("li", null, "No sources were analysed."));
  for (const t of tipos) {
    const { a, c, n } = porTipo[t];
    const li = el("li");
    li.append(el("span", "mix-tipo", TIPOS_FONTE[t]));
    const partes = el("span", "contas");
    const add = (txt, cls) => { if (partes.childNodes.length) partes.append(document.createTextNode(", ")); partes.append(el("span", cls, txt)); };
    if (a) add(`${a} agree${a > 1 ? "" : "s"}`, "a");
    if (c) add(`${c} disagree${c > 1 ? "" : "s"}`, "c");
    if (n) add(`${n} unclear`, "n");
    li.append(partes);
    lista.append(li);
  }
  m3.append(lista);
  grade.append(m3);
  return grade;
}

function formatarDataCurta(valor) {
  if (!valor) return "an unknown date";
  const d = new Date(/T/.test(valor) ? valor : `${valor}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(valor);
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function limparTrecho(texto) {
  return String(texto ?? "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*_`>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function rotuloPostura(postura) {
  switch (postura) {
    case "SUPPORTS": return ["Supports", "e-apoia"];
    case "CONTRADICTS": return ["Contradicts", "e-contradiz"];
    case "INSUFFICIENT": return ["Inconclusive", "e-neutra"];
    case "IRRELEVANT": return ["Not about this", "e-neutra"];
    default: return ["Not analysed", "e-neutra"];
  }
}

function criarFonte(evidencia, simulado) {
  const fonte = evidencia.fonte ?? {};
  const item = el("li", "fonte");
  const cab = el("div", "fonte-cabeca");
  const [rotulo, classe] = rotuloPostura(evidencia.classificacao?.postura);
  cab.append(el("span", `etiqueta ${classe}`, rotulo), el("span", "etiqueta e-tipo", TIPOS_FONTE[fonte.categoria_fonte] ?? "Other website"));
  item.append(cab);

  const url = /^https?:\/\//i.test(fonte.url ?? "") ? fonte.url : null;
  const linhaTitulo = el("p", "fonte-linha-titulo");
  let titulo;
  if (url && !simulado) {
    titulo = el("a", "fonte-titulo", limparTrecho(fonte.titulo) || dominioDe(url));
    titulo.href = url; titulo.target = "_blank"; titulo.rel = "noopener noreferrer";
  } else {
    titulo = el("span", "fonte-titulo", limparTrecho(fonte.titulo) || fonte.url || "Untitled source");
  }
  linhaTitulo.append(titulo, el("span", "fonte-dominio", dominioDe(fonte.url)));
  item.append(linhaTitulo);

  const motivo = evidencia.classificacao?.justificativa || evidencia.correspondencia?.justificativa;
  if (motivo) item.append(el("p", "motivo", emIngles(motivo).replace(/^(The )?source S\d+\s*/i, "The source ")));

  const citacao = evidencia.preparacao?.citacao_chave;
  if (citacao) item.append(el("blockquote", "citacao", `“${limparTrecho(citacao)}”`));

  const datas = [];
  if (fonte.data_fato?.citacao) datas.push(`Fact date: ${formatarDataCurta(fonte.data_fato.data)} (quoted in the source)`);
  else if (fonte.escopo_data === "ATTRIBUTE" && fonte.data_atualizacao) datas.push(`Fact date: ${formatarDataCurta(fonte.data_atualizacao)}`);
  else if (fonte.data_atualizacao) datas.push(`Page updated ${formatarDataCurta(fonte.data_atualizacao)}`);
  if (fonte.data_publicacao) datas.push(`Published ${formatarDataCurta(fonte.data_publicacao)}`);
  if (fonte.coletado_em) datas.push(`Read ${formatarDataCurta(fonte.coletado_em)}`);
  item.append(el("p", "datas-linha", datas.join("  ·  ")));

  const bruto = limparTrecho(evidencia.preparacao?.trecho_analisado || fonte.conteudo || "");
  if (bruto) {
    const det = el("details", "trecho-det");
    det.append(el("summary", null, "Show excerpt"), el("p", "trecho", bruto.length > 700 ? `${bruto.slice(0, 700)}…` : bruto));
    item.append(det);
  }
  return item;
}

function criarCartao(afirmacao, simulado) {
  const ag = afirmacao.agregacao ?? {};
  const codigo = ag.veredito ?? "NAO_VERIFICAVEL";
  const v = VEREDITOS[codigo] ?? VEREDITOS.NAO_VERIFICAVEL;
  const cartao = el("article", `cartao ${v.tom}`);

  const cab = el("div", "cartao-cabeca");
  cab.append(el("span", `pilula ${v.tom}`, v.nome));
  const cat = CATEGORIAS[afirmacao.tipo_afirmacao];
  cab.append(el("span", "chip", cat
    ? `${cat[0]}${afirmacao.origem_tipo_afirmacao ? ` · ${ORIGEM[afirmacao.origem_tipo_afirmacao]}` : ""}`
    : "No category"));
  if (afirmacao.risco_desatualizacao) cab.append(el("span", `chip pilula-risco risco-${afirmacao.risco_desatualizacao.nivel.toLowerCase()}`, RISCOS[afirmacao.risco_desatualizacao.nivel]));
  if (afirmacao.nuances?.idioma === "pt") cab.append(el("span", "chip", afirmacao.nuances.variante === "pt-PT" ? "European Portuguese" : "Brazilian Portuguese"));
  for (const d of afirmacao.dominios_oficiais_automaticos ?? []) cab.append(el("span", "chip chip-br", `Official BR source searched: ${d}`));
  cartao.append(cab);

  cartao.append(el("h3", "afirmacao", afirmacao.texto));
  cartao.append(el("p", "explicacao", afirmacao.erro_busca ? `${v.texto} Search error: ${afirmacao.erro_busca}` : v.texto));
  cartao.append(criarMetricas(afirmacao));

  const notas = afirmacao.nuances?.notas ?? [];
  if (notas.length && afirmacao.nuances?.idioma === "pt") {
    const caixa = el("details", "idioma");
    caixa.append(el("summary", null, `How the Portuguese was read (${notas.length})`));
    const ul = el("ul");
    for (const n of notas) ul.append(el("li", null, n));
    caixa.append(ul);
    cartao.append(caixa);
  }

  const prioridade = e => {
    const i = ORDEM_TIPOS.indexOf(e.fonte?.categoria_fonte ?? "OUTRO");
    const usado = ["SUPPORTS", "CONTRADICTS"].includes(e.classificacao?.postura) ? 0 : 10;
    return usado + (i === -1 ? 9 : i);
  };
  const evidencias = [...(afirmacao.evidencias ?? [])].sort((a, b) => prioridade(a) - prioridade(b));
  const blocoFontes = el("details", "bloco");
  blocoFontes.open = true;
  blocoFontes.append(el("summary", null, `Sources (${evidencias.length})`));
  const lista = el("ul", "fontes");
  if (evidencias.length === 0) lista.append(el("li", "fonte", "No source could be analysed for this claim."));
  for (const e of evidencias) lista.append(criarFonte(e, simulado));
  blocoFontes.append(lista);
  cartao.append(blocoFontes);

  const limitacoes = [...new Set([
    ...(ag.concordancia?.limitations ?? []),
    ...(ag.freshness?.limitations ?? []),
    ...(ag.limitacoes ?? [])
  ].map(emIngles))];
  if (limitacoes.length) {
    const bloco = el("details", "bloco");
    bloco.append(el("summary", null, `Limitations (${limitacoes.length})`));
    const ul = el("ul", "limites");
    for (const t of limitacoes) ul.append(el("li", null, t));
    bloco.append(ul);
    cartao.append(bloco);
  }
  return cartao;
}

/* ---------- início ---------- */

async function iniciar() {
  $("texto").addEventListener("input", atualizarEntrada);
  $("botao-verificar").addEventListener("click", verificar);
  $("texto").addEventListener("keydown", e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") verificar(); });
  try {
    estado.status = await API.status();
  } catch {
    estado.status = { modo_real_disponivel: false, exemplos: [] };
  }
  configurarModo();
  montarExemplos();
  montarLegenda();
  configurarFavorito();
  // Texto vindo de um link ou do botão de favoritos: ?text=...
  const recebido = new URLSearchParams(location.search).get("text") ?? new URLSearchParams(location.search).get("texto");
  if (recebido) {
    $("texto").value = recebido.slice(0, 4000);
    mostrarMensagem(API.estatico ? "" : "Text received. Choose a mode and click Check answer.");
  }
  atualizarEntrada();
}

document.addEventListener("DOMContentLoaded", iniciar);
