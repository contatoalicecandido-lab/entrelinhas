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
const ORIGEM = { CONFIGURADO: "set by you", MODELO: "detected by the model", HEURISTICA: "detected by keyword rules" };
const TIPOS_FONTE = { OFICIAL: "Official", NOTICIA: "News", REFERENCIA: "Reference", OUTRO: "Other site", BLOG_FORUM: "Blog / forum" };
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
  selo.textContent = real ? "Live mode ready" : "Example mode";
  selo.classList.toggle("real", real);
  const opcao = $("opcao-real");
  const radio = opcao.querySelector("input");
  radio.disabled = !real;
  opcao.classList.toggle("desativado", !real);
  opcao.querySelector("span").textContent = real
    ? "Live: Tavily search + model via Bifrost"
    : "Live: needs TAVILY_API_KEY and BIFROST_KEY on the server";
  (real ? radio : document.querySelector('input[name="modo"][value="exemplo"]')).checked = true;
}

function montarExemplos() {
  const caixa = $("exemplos");
  caixa.replaceChildren();
  for (const ex of estado.status?.exemplos ?? []) {
    const b = el("button", null, ex.rotulo);
    b.type = "button";
    b.addEventListener("click", () => {
      $("texto").value = ex.texto;
      $("dominios").value = ex.dominios.join(", ");
      document.querySelector('input[name="modo"][value="exemplo"]').checked = true;
      atualizarEntrada();
      mostrarMensagem("");
    });
    caixa.append(b);
  }
}

function montarLegenda() {
  const caixa = $("legenda");
  caixa.replaceChildren();
  for (const codigo of ["ATUAL", "CORROBORADA", "SUPORTE_FRACO", "CONFLITO", "CONTRADICAO_FRACA", "CONTRADITA_POR_FONTE_ATUAL", "NAO_VERIFICAVEL"]) {
    const v = VEREDITOS[codigo];
    const bloco = el("div");
    bloco.append(el("span", `pilula ${v.tom}`, v.nome), el("p", null, v.texto));
    caixa.append(bloco);
  }
  const extras = [
    ["Source agreement (0–100)", "How much independent sources agree with the claim, weighted by type: official 3, news 2, reference 2, other sites 1, blogs and forums 0.5. Copies and pages of one site count once."],
    ["Freshness (0–100)", "How recent the date tied to this exact fact is, against the claim type's validity window: it halves every half window, so a price dated 7 days ago scores 72. Without such a date, the card says so and shows page-date recency with low confidence."],
    ["Portuguese-aware reading", "R$ 1.234,56 is 1234.56 and “5 mil” is 5,000; “a partir de” is a starting price, “até” an upper bound, “cerca de” approximate; “no Pix”, “12x sem juros” and “para novos clientes” are conditions; “deixou de” and “entrou em vigor” mark changes; “atualmente” must hold today; “ano que vem” and 03/04/2027 are resolved (3 April); Selic, LGPD, Anatel or salário mínimo send the search to the Brazilian authority."]
  ];
  for (const [titulo, texto] of extras) {
    const bloco = el("div");
    bloco.append(el("strong", null, titulo), el("p", null, texto));
    caixa.append(bloco);
  }
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
  if (modo() === "exemplo" && !(estado.status?.exemplos ?? []).some(e => norm(e.texto) === norm(texto))) {
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
    const resposta = await fetch("/api/verificar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto, modo: modo(), dominiosOficiais })
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados.erro || "Something went wrong. Please try again.");
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
  $("rastreio").textContent = `Verification ${dados.id_verificacao} · ${dados.rastreabilidade_modelo?.length ?? 0} model calls via ${dados.simulado ? "simulated provider" : "Bifrost"} · ${dados.rastreabilidade_pesquisa?.length ?? 0} search operations via ${dados.simulado ? "simulated provider" : "Tavily"} · ${dados.duracao_ms ?? "—"} ms · stored in SQLite (in memory)`;
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

function criarMetricas(afirmacao) {
  const ag = afirmacao.agregacao ?? {};
  const conc = ag.concordancia ?? null;
  const fr = ag.freshness ?? null;
  const rec = ag.recencia_pagina ?? null;
  const grade = el("div", "metricas");

  const m1 = metrica("Source agreement");
  valorComBarra(m1, conc?.score ?? null, corDoValor(conc?.score));
  m1.append(el("p", "metrica-nota", conc && conc.independent_sources > 0
    ? `${conc.supporting} support · ${conc.contradicting} contradict${conc.split ? ` · ${conc.split} split` : ""} · ${conc.independent_sources} independent source${conc.independent_sources > 1 ? "s" : ""}, ${COBERTURA[conc.coverage]}`
    : "No source took a clear position on this claim."));
  grade.append(m1);

  const contra = ag.veredito === "CONTRADITA_POR_FONTE_ATUAL" || ag.veredito === "CONTRADICAO_FRACA";
  const m2 = metrica(contra ? "Freshness of the evidence" : "Freshness");
  const nota = fr && Number.isFinite(fr.score) ? fr.score : null;
  valorComBarra(m2, nota, contra ? "var(--vermelho)" : corDoValor(nota));
  const cat = CATEGORIAS[afirmacao.tipo_afirmacao];
  let textoFr;
  if (nota !== null) {
    textoFr = `${cat ? `${cat[0]} · ${cat[1]}-day window` : ""}. Based on a date tied to this fact${contra ? "; that recent evidence contradicts the claim" : ""}.`;
  } else if (!cat) {
    textoFr = "No category, so no validity window.";
  } else if (rec && Number.isFinite(rec.score)) {
    textoFr = `No date tied to this fact. Page dates suggest ${rec.score}/100 (newest ${rec.newest_date}), low confidence.`;
  } else {
    textoFr = "No date tied to this fact, and no dated page either.";
  }
  m2.append(el("p", "metrica-nota", textoFr));
  grade.append(m2);

  const m3 = metrica("Evidence mix");
  const lista = el("ul", "mix");
  const porTipo = {};
  for (const e of afirmacao.evidencias ?? []) {
    const tipo = e.fonte?.categoria_fonte ?? "OUTRO";
    porTipo[tipo] ??= { a: 0, c: 0, n: 0 };
    const p = e.classificacao?.postura;
    if (p === "SUPPORTS") porTipo[tipo].a += 1; else if (p === "CONTRADICTS") porTipo[tipo].c += 1; else porTipo[tipo].n += 1;
  }
  const tipos = Object.keys(TIPOS_FONTE).filter(t => porTipo[t]);
  if (tipos.length === 0) lista.append(el("li", null, "No sources were analysed."));
  for (const t of tipos) {
    const li = el("li");
    li.append(el("span", null, TIPOS_FONTE[t]));
    const contas = el("span", "contas");
    const { a, c, n } = porTipo[t];
    if (a) contas.append(el("span", "a", `${a} ✓`));
    if (c) { if (a) contas.append(document.createTextNode("  ")); contas.append(el("span", "c", `${c} ✗`)); }
    if (n) { if (a || c) contas.append(document.createTextNode("  ")); contas.append(el("span", null, `${n} ○`)); }
    li.append(contas);
    lista.append(li);
  }
  m3.append(lista);
  m3.append(el("p", "metrica-nota", "✓ supports   ✗ contradicts   ○ no position"));
  grade.append(m3);
  return grade;
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
  cab.append(el("span", `etiqueta ${classe}`, rotulo));
  cab.append(el("span", "etiqueta e-tipo", TIPOS_FONTE[fonte.categoria_fonte] ?? "Other site"));
  const url = /^https?:\/\//i.test(fonte.url ?? "") ? fonte.url : null;
  let titulo;
  if (url && !simulado) {
    titulo = el("a", "fonte-titulo", fonte.titulo || url);
    titulo.href = url; titulo.target = "_blank"; titulo.rel = "noopener noreferrer";
  } else {
    titulo = el("span", "fonte-titulo", fonte.titulo || fonte.url || "—");
  }
  cab.append(titulo, el("span", "fonte-dominio", dominioDe(fonte.url)));
  item.append(cab);

  const citacao = evidencia.preparacao?.citacao_chave;
  if (citacao) {
    item.append(el("blockquote", "citacao", `“${citacao}”`));
  } else {
    const bruto = (evidencia.preparacao?.trecho_analisado || fonte.conteudo || "").replace(/\s+/g, " ").trim();
    if (bruto) item.append(el("p", "trecho", bruto.length > 360 ? `${bruto.slice(0, 360)}…` : bruto));
  }
  const motivo = evidencia.classificacao?.justificativa || evidencia.correspondencia?.justificativa;
  if (motivo) item.append(el("p", "motivo", emIngles(motivo)));

  const datas = el("dl", "datas");
  for (const [rot, valor] of [["Published", fonte.data_publicacao], ["Updated", fonte.data_atualizacao], ["Retrieved", fonte.coletado_em]]) {
    const b = el("div");
    b.append(el("dt", null, rot), el("dd", null, formatarData(valor)));
    datas.append(b);
  }
  item.append(datas);
  const temData = Boolean(fonte.data_publicacao || fonte.data_atualizacao);
  if (fonte.data_fato?.citacao) item.append(el("p", "escopo ok", `✓ Fact date found in the source text, quote verified: “${fonte.data_fato.citacao}”. It counts for freshness.`));
  else if (fonte.escopo_data === "ATTRIBUTE" && temData) item.append(el("p", "escopo ok", "✓ This date is tied to the specific fact, so it counts for freshness."));
  else if (temData) item.append(el("p", "escopo pagina", "Page-level date: it does not prove when this specific fact changed."));
  else item.append(el("p", "escopo sem", "No publication or update date found. Retrieval time is never used as one."));
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
  if (afirmacao.nuances?.idioma === "pt") cab.append(el("span", "chip", afirmacao.nuances.variante === "pt-PT" ? "European Portuguese" : "Brazilian Portuguese"));
  for (const d of afirmacao.dominios_oficiais_automaticos ?? []) cab.append(el("span", "chip chip-br", `Official BR source searched: ${d}`));
  cartao.append(cab);

  cartao.append(el("h3", "afirmacao", afirmacao.texto));
  cartao.append(el("p", "explicacao", afirmacao.erro_busca ? `${v.texto} Search error: ${afirmacao.erro_busca}` : v.texto));
  cartao.append(criarMetricas(afirmacao));

  const notas = afirmacao.nuances?.notas ?? [];
  if (notas.length) {
    const caixa = el("div", "idioma");
    caixa.append(el("h4", null, afirmacao.nuances.idioma === "pt" ? "How Entrelinhas read the Portuguese" : "How Entrelinhas read this claim"));
    const ul = el("ul");
    for (const n of notas) ul.append(el("li", null, n));
    caixa.append(ul);
    cartao.append(caixa);
  }

  const evidencias = afirmacao.evidencias ?? [];
  const blocoFontes = el("details", "bloco");
  blocoFontes.open = true;
  blocoFontes.append(el("summary", null, `Evidence (${evidencias.length} source${evidencias.length === 1 ? "" : "s"})`));
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
    estado.status = await (await fetch("/api/status")).json();
  } catch {
    estado.status = { modo_real_disponivel: false, exemplos: [] };
  }
  configurarModo();
  montarExemplos();
  montarLegenda();
  atualizarEntrada();
}

document.addEventListener("DOMContentLoaded", iniciar);
