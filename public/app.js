"use strict";

// Todo conteúdo vindo do servidor é inserido com textContent (nunca innerHTML).

const TEXTOS = {
  en: {
    tagline: "Is this AI answer still true today?",
    titulo: "Paste an AI answer. We check every claim against live sources and tell you how fresh the evidence is.",
    rotuloTexto: "AI-generated answer",
    modo: "Mode",
    modoExemplo: "Example (simulated sources, no cost)",
    modoReal: "Live (Tavily + Bifrost)",
    modoRealIndisponivel: "Live (needs TAVILY_API_KEY and BIFROST_KEY)",
    rotuloDominios: "Official domains (optional)",
    dicaDominios: "Sources from these domains are treated as official. Adds one extra search per claim.",
    carregarExemplo: "Load example",
    verificar: "Check claims",
    verificando: "Checking…",
    etapa1: "Splitting the answer into atomic claims",
    etapa2: "Searching and extracting live sources (Tavily)",
    etapa3: "Reading each source against the claim (model via Bifrost)",
    etapa4: "Checking dates and computing the freshness index",
    avisoSimulado: "Example mode: the sources below are fictional and the model and search responses are simulated. The verdict and freshness logic is the real engine.",
    resumoTitulo: "Result",
    seloExemplo: "Example mode",
    seloReal: "Live mode available",
    comoLerTitulo: "How to read the results",
    st_ATUAL: "Current",
    st_CONTRADITA_POR_FONTE_ATUAL: "Likely outdated",
    st_SUPORTE_FRACO: "Supported, freshness unconfirmed",
    st_CONFLITO: "Conflicting",
    st_NAO_VERIFICAVEL: "Not verifiable",
    lg_ATUAL: "An official source with a date tied to this exact fact supports the claim.",
    lg_CONTRADITA_POR_FONTE_ATUAL: "A recent official source says something different. The AI answer is probably stale.",
    lg_SUPORTE_FRACO: "Sources agree, but no date proves the information is still current.",
    lg_CONFLITO: "Sources disagree and none settles it. Check them yourself.",
    lg_NAO_VERIFICAVEL: "No usable evidence was found. This does not mean the claim is false.",
    formula: "Freshness index (0–100): how recent the dated evidence is, relative to the validity window of the claim type (prices 30 days, API versions 90, companies 180, regulations 365). It halves every half-window: 7 days old for a price = 72. It is not a probability of truth, and it is only shown when a date is explicitly tied to the fact being checked.",
    rodape: "Entrelinhas · Tavily for search and extraction · Bifrost as model gateway · SQLite in-memory traceability",
    cat_preco: "Price", cat_versao_api: "API / software version", cat_regulamento: "Regulation", cat_empresa: "Company information", cat_nenhuma: "No category (timeless or unknown)",
    origem_CONFIGURADO: "set by you", origem_MODELO: "detected by the model", origem_HEURISTICA: "detected by keyword rules",
    categoria: "Category",
    janela: "validity window",
    dias: "days",
    indice: "freshness",
    indiceContra: "contrary evidence",
    naoDeterminavel: "no dated evidence",
    medidorAria: "Freshness index",
    fontesTitulo: "Evidence",
    semFontes: "No source could be analysed for this claim.",
    apoia: "Supports", contradiz: "Contradicts", insuficiente: "Insufficient", irrelevante: "Not about this claim", erro: "Analysis error",
    oficial: "Official",
    publicada: "Published", atualizada: "Updated", consultada: "Retrieved",
    naoInformada: "not stated",
    dataVinculada: "✓ This date is tied to the specific fact being checked, so it counts for freshness.",
    dataPagina: "This is a page-level date. It does not prove when this specific fact changed, so it does not count for freshness.",
    dataAusente: "No publication or update date was found. Retrieval time is not treated as an update date.",
    limitacoesTitulo: "Limitations and engine notes",
    notaMotor: "Engine note (Portuguese): ",
    omitidas: n => `${n} additional claim(s) were not checked to limit cost. Send them separately.`,
    contagem: (n, rotulo) => `${n} ${rotulo}`,
    rastreio: r => `verification ${r.id} · ${r.modelo} model calls · ${r.pesquisa} search operations · ${r.duracao} ms · ${r.modo === "exemplo" ? "simulated" : "live"} · stored in SQLite :memory:`,
    erroGenerico: "Something went wrong. Please try again.",
    textoVazio: "Paste an AI answer first.",
    decorrido: s => `${s}s elapsed.`,
    avisoLento: " Each source is read by the model; when the model provider's rate limit is hit, Entrelinhas waits and retries, so a live check can take a few minutes.",
    soExemplo: "Example mode only checks the demo answer. Click “Load example”, or run the server with Tavily and Bifrost keys to check your own text.",
    expl_ATUAL: f => `An official source supports this claim and its date is tied to this exact fact${f !== null ? ` (freshness ${f}/100)` : ""}. This is not an absolute guarantee of truth.`,
    expl_CONTRADITA_POR_FONTE_ATUAL: f => `A current official source contradicts this claim${f !== null ? ` (that evidence scores ${f}/100 on freshness)` : ""}. If an AI said this, the answer is probably outdated.`,
    expl_SUPORTE_FRACO: () => "Sources support the claim, but none has a date tied to this specific fact, so we cannot confirm it is still current.",
    expl_CONFLITO: () => "Sources disagree and none of them resolves the conflict. Review the evidence before relying on this claim.",
    expl_NAO_VERIFICAVEL: () => "We could not find usable evidence. That does not mean the claim is false."
  },
  pt: {
    tagline: "Essa resposta de IA ainda vale hoje?",
    titulo: "Cole uma resposta de IA. Verificamos cada afirmação em fontes atuais e mostramos o quão recente é a evidência.",
    rotuloTexto: "Resposta gerada por IA",
    modo: "Modo",
    modoExemplo: "Exemplo (fontes simuladas, sem custo)",
    modoReal: "Real (Tavily + Bifrost)",
    modoRealIndisponivel: "Real (precisa de TAVILY_API_KEY e BIFROST_KEY)",
    rotuloDominios: "Domínios oficiais (opcional)",
    dicaDominios: "Fontes desses domínios contam como oficiais. Faz uma busca extra por afirmação.",
    carregarExemplo: "Carregar exemplo",
    verificar: "Verificar afirmações",
    verificando: "Verificando…",
    etapa1: "Separando a resposta em afirmações",
    etapa2: "Buscando e extraindo fontes atuais (Tavily)",
    etapa3: "Lendo cada fonte contra a afirmação (modelo via Bifrost)",
    etapa4: "Conferindo datas e calculando o índice de atualidade",
    avisoSimulado: "Modo exemplo: as fontes abaixo são fictícias e as respostas da busca e do modelo são simuladas. A lógica de veredito e atualidade é a do motor real.",
    resumoTitulo: "Resultado",
    seloExemplo: "Modo exemplo",
    seloReal: "Modo real disponível",
    comoLerTitulo: "Como ler os resultados",
    st_ATUAL: "Atual",
    st_CONTRADITA_POR_FONTE_ATUAL: "Provavelmente desatualizada",
    st_SUPORTE_FRACO: "Apoiada, atualidade não confirmada",
    st_CONFLITO: "Em conflito",
    st_NAO_VERIFICAVEL: "Não verificável",
    lg_ATUAL: "Uma fonte oficial, com data ligada a esse fato específico, apoia a afirmação.",
    lg_CONTRADITA_POR_FONTE_ATUAL: "Uma fonte oficial recente diz outra coisa. A resposta da IA provavelmente está desatualizada.",
    lg_SUPORTE_FRACO: "As fontes concordam, mas nenhuma data prova que a informação ainda vale.",
    lg_CONFLITO: "As fontes discordam e nenhuma resolve a dúvida. Confira você mesma.",
    lg_NAO_VERIFICAVEL: "Não encontramos evidência utilizável. Isso não quer dizer que a afirmação é falsa.",
    formula: "Índice de atualidade (0–100): o quão recente é a evidência datada, em relação à janela de validade do tipo de afirmação (preços 30 dias, versões de API 90, empresas 180, regulamentos 365). Cai pela metade a cada meia janela: um preço com 7 dias = 72. Não é probabilidade de verdade, e só aparece quando há uma data explicitamente ligada ao fato verificado.",
    rodape: "Entrelinhas · Tavily para busca e extração · Bifrost como gateway de modelos · rastreabilidade em SQLite na memória",
    cat_preco: "Preço", cat_versao_api: "API / versão de software", cat_regulamento: "Regulamento", cat_empresa: "Informação de empresa", cat_nenhuma: "Sem categoria (atemporal ou desconhecida)",
    origem_CONFIGURADO: "definida por você", origem_MODELO: "detectada pelo modelo", origem_HEURISTICA: "detectada por palavras-chave",
    categoria: "Categoria",
    janela: "janela de validade",
    dias: "dias",
    indice: "atualidade",
    indiceContra: "evidência contrária",
    naoDeterminavel: "sem data vinculada",
    medidorAria: "Índice de atualidade",
    fontesTitulo: "Evidências",
    semFontes: "Nenhuma fonte pôde ser analisada para esta afirmação.",
    apoia: "Apoia", contradiz: "Contradiz", insuficiente: "Insuficiente", irrelevante: "Não trata disso", erro: "Erro na análise",
    oficial: "Oficial",
    publicada: "Publicada", atualizada: "Atualizada", consultada: "Consultada",
    naoInformada: "não informada",
    dataVinculada: "✓ Esta data está ligada ao fato verificado, por isso conta para a atualidade.",
    dataPagina: "Esta é uma data da página. Ela não prova quando esse fato específico mudou, por isso não conta para a atualidade.",
    dataAusente: "Nenhuma data de publicação ou atualização foi encontrada. A hora da consulta não é tratada como data de atualização.",
    limitacoesTitulo: "Limitações e notas do motor",
    notaMotor: "",
    omitidas: n => `${n} afirmação(ões) a mais não foram verificadas para limitar o custo. Envie-as separadamente.`,
    contagem: (n, rotulo) => `${n} ${rotulo}`,
    rastreio: r => `verificação ${r.id} · ${r.modelo} chamadas ao modelo · ${r.pesquisa} operações de busca · ${r.duracao} ms · ${r.modo === "exemplo" ? "simulado" : "real"} · gravado em SQLite :memory:`,
    erroGenerico: "Algo deu errado. Tente de novo.",
    textoVazio: "Cole uma resposta de IA primeiro.",
    decorrido: s => `${s}s decorridos.`,
    avisoLento: " Cada fonte é lida pelo modelo; quando o provedor do modelo atinge o limite de uso, o Entrelinhas espera e tenta de novo, então uma verificação real pode levar alguns minutos.",
    soExemplo: "O modo exemplo só verifica a resposta de demonstração. Clique em “Carregar exemplo” ou rode o servidor com as chaves da Tavily e do Bifrost para verificar seu próprio texto.",
    expl_ATUAL: f => `Uma fonte oficial apoia esta afirmação e a data dela está ligada a esse fato específico${f !== null ? ` (atualidade ${f}/100)` : ""}. Isso não é garantia absoluta de verdade.`,
    expl_CONTRADITA_POR_FONTE_ATUAL: f => `Uma fonte oficial atual contradiz esta afirmação${f !== null ? ` (essa evidência tem atualidade ${f}/100)` : ""}. Se uma IA disse isso, a resposta provavelmente está desatualizada.`,
    expl_SUPORTE_FRACO: () => "As fontes apoiam a afirmação, mas nenhuma tem data ligada a esse fato específico, então não dá para confirmar que ainda vale.",
    expl_CONFLITO: () => "As fontes discordam e nenhuma resolve o conflito. Revise as evidências antes de confiar nesta afirmação.",
    expl_NAO_VERIFICAVEL: () => "Não encontramos evidência utilizável. Isso não quer dizer que a afirmação é falsa."
  }
};

const CLASSE_ESTADO = {
  ATUAL: "estado-atual",
  CONTRADITA_POR_FONTE_ATUAL: "estado-desatualizada",
  SUPORTE_FRACO: "estado-fraco",
  CONFLITO: "estado-conflito",
  NAO_VERIFICAVEL: "estado-neutro"
};
const ORDEM_ESTADOS = ["CONTRADITA_POR_FONTE_ATUAL", "CONFLITO", "SUPORTE_FRACO", "ATUAL", "NAO_VERIFICAVEL"];
const JANELAS = { preco: 30, versao_api: 90, regulamento: 365, empresa: 180 };

const estado = {
  idioma: (navigator.language || "en").toLowerCase().startsWith("pt") ? "pt" : "en",
  status: null,
  ultimoResultado: null
};

const $ = id => document.getElementById(id);
const t = chave => TEXTOS[estado.idioma][chave] ?? TEXTOS.en[chave] ?? chave;

function elemento(tag, classe, texto) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (texto !== undefined && texto !== null) el.textContent = String(texto);
  return el;
}

function aplicarIdioma() {
  document.documentElement.lang = estado.idioma === "pt" ? "pt-BR" : "en";
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const valor = t(el.dataset.i18n);
    if (typeof valor === "string") el.textContent = valor;
  });
  $("botao-idioma").textContent = estado.idioma === "pt" ? "EN" : "PT";
  $("botao-idioma").setAttribute("aria-label", estado.idioma === "pt" ? "Mudar para inglês" : "Switch to Portuguese");
  atualizarSeloEModo();
  if (estado.ultimoResultado) renderizarResultado(estado.ultimoResultado);
}

function atualizarSeloEModo() {
  const selo = $("selo-modo");
  const realDisponivel = Boolean(estado.status?.modo_real_disponivel);
  selo.textContent = realDisponivel ? t("seloReal") : t("seloExemplo");
  selo.classList.toggle("real", realDisponivel);
  const opcaoReal = $("opcao-real");
  const radioReal = opcaoReal.querySelector("input");
  radioReal.disabled = !realDisponivel;
  opcaoReal.classList.toggle("desativado", !realDisponivel);
  opcaoReal.querySelector("span").textContent = realDisponivel ? t("modoReal") : t("modoRealIndisponivel");
  if (!realDisponivel && radioReal.checked) {
    document.querySelector('input[name="modo"][value="exemplo"]').checked = true;
  }
}

function modoSelecionado() {
  return document.querySelector('input[name="modo"]:checked')?.value ?? "exemplo";
}

function atualizarContador() {
  $("contador").textContent = String($("texto").value.length);
}

function mostrarMensagem(texto) {
  $("mensagem").textContent = texto || "";
}

let temporizadorEtapas = null;
function iniciarProgresso() {
  const secao = $("progresso");
  const itens = [...secao.querySelectorAll("li")];
  secao.hidden = false;
  let indice = 0;
  const marcar = () => itens.forEach((li, i) => li.classList.toggle("ativa", i === indice));
  marcar();
  const intervalo = modoSelecionado() === "exemplo" ? 350 : 4000;
  const inicio = Date.now();
  const tempo = $("tempo-decorrido");
  tempo.textContent = "";
  let ultimoAvanco = Date.now();
  temporizadorEtapas = setInterval(() => {
    if (Date.now() - ultimoAvanco >= intervalo) {
      indice = Math.min(indice + 1, itens.length - 1);
      ultimoAvanco = Date.now();
      marcar();
    }
    const segundos = Math.round((Date.now() - inicio) / 1000);
    if (modoSelecionado() === "real") {
      tempo.textContent = t("decorrido")(segundos) + (segundos >= 20 ? t("avisoLento") : "");
    }
  }, 250);
}
function pararProgresso() {
  clearInterval(temporizadorEtapas);
  $("progresso").hidden = true;
}

async function verificar() {
  const texto = $("texto").value.trim();
  if (!texto) { mostrarMensagem(t("textoVazio")); $("texto").focus(); return; }
  const normalizar = valor => String(valor ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  if (modoSelecionado() === "exemplo" && normalizar(texto) !== normalizar(estado.status?.texto_exemplo)) {
    mostrarMensagem(t("soExemplo"));
    return;
  }
  const dominiosOficiais = $("dominios").value.split(/[\s,;]+/).map(d => d.trim()).filter(Boolean);
  const botao = $("botao-verificar");
  botao.disabled = true;
  botao.textContent = t("verificando");
  mostrarMensagem("");
  $("resultado").hidden = true;
  iniciarProgresso();
  try {
    const resposta = await fetch("/api/verificar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto, modo: modoSelecionado(), dominiosOficiais })
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados.erro || t("erroGenerico"));
    estado.ultimoResultado = dados;
    renderizarResultado(dados);
    $("resultado").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (erro) {
    mostrarMensagem(erro.message || t("erroGenerico"));
  } finally {
    pararProgresso();
    botao.disabled = false;
    botao.textContent = t("verificar");
  }
}

function nomeEstado(veredito) {
  return t(`st_${veredito}`) || veredito;
}

function renderizarResultado(dados) {
  $("resultado").hidden = false;
  $("aviso-simulado").hidden = !dados.simulado;

  const contagens = $("contagens");
  contagens.replaceChildren();
  const porEstado = {};
  for (const a of dados.afirmacoes ?? []) {
    const v = a.agregacao?.veredito ?? "NAO_VERIFICAVEL";
    porEstado[v] = (porEstado[v] ?? 0) + 1;
  }
  for (const v of ORDEM_ESTADOS) {
    if (!porEstado[v]) continue;
    contagens.append(elemento("span", `pilula ${CLASSE_ESTADO[v]}`, t("contagem")(porEstado[v], nomeEstado(v))));
  }

  const omitidas = dados.afirmacoes_omitidas ?? [];
  $("omitidas").hidden = omitidas.length === 0;
  $("omitidas").textContent = omitidas.length ? t("omitidas")(omitidas.length) : "";

  const cartoes = $("cartoes");
  cartoes.replaceChildren(...(dados.afirmacoes ?? []).map(a => criarCartao(a, dados.simulado)));

  $("rastreio").textContent = t("rastreio")({
    id: dados.id_verificacao,
    modelo: dados.rastreabilidade_modelo?.length ?? 0,
    pesquisa: dados.rastreabilidade_pesquisa?.length ?? 0,
    duracao: dados.duracao_ms ?? "—",
    modo: dados.modo
  });
}

function configurarMedidor(medidor, freshness, veredito) {
  const circulo = medidor.querySelector(".medidor-valor");
  const circunferencia = 2 * Math.PI * 50;
  circulo.style.strokeDasharray = String(circunferencia);
  const nota = freshness && Number.isFinite(freshness.score) ? freshness.score : null;
  medidor.classList.remove("tom-alerta", "tom-cautela", "vazio");
  if (nota === null) {
    medidor.classList.add("vazio");
    circulo.style.strokeDashoffset = String(circunferencia);
    medidor.querySelector(".medidor-numero").textContent = "—";
    medidor.querySelector(".medidor-legenda").textContent = t("naoDeterminavel");
    medidor.setAttribute("aria-label", `${t("medidorAria")}: ${t("naoDeterminavel")}`);
    return;
  }
  const contra = veredito === "CONTRADITA_POR_FONTE_ATUAL";
  if (contra) medidor.classList.add("tom-alerta");
  else if (veredito !== "ATUAL" || nota < 50) medidor.classList.add("tom-cautela");
  circulo.style.strokeDashoffset = String(circunferencia * (1 - nota / 100));
  medidor.querySelector(".medidor-numero").textContent = String(nota);
  medidor.querySelector(".medidor-legenda").textContent = `/100 ${contra ? t("indiceContra") : t("indice")}`;
  medidor.setAttribute("aria-label", `${t("medidorAria")}: ${nota}/100`);
}

function textoCategoria(afirmacao) {
  const tipo = afirmacao.tipo_afirmacao;
  if (!tipo) return `${t("categoria")}: ${t("cat_nenhuma")}`;
  const origem = afirmacao.origem_tipo_afirmacao ? ` (${t(`origem_${afirmacao.origem_tipo_afirmacao}`)})` : "";
  const janela = JANELAS[tipo] ? ` · ${t("janela")}: ${JANELAS[tipo]} ${t("dias")}` : "";
  return `${t("categoria")}: ${t(`cat_${tipo}`)}${origem}${janela}`;
}

function rotuloPostura(postura) {
  switch (postura) {
    case "SUPPORTS": return [t("apoia"), "apoia"];
    case "CONTRADICTS": return [t("contradiz"), "contradiz"];
    case "INSUFFICIENT": return [t("insuficiente"), "neutra"];
    case "IRRELEVANT": return [t("irrelevante"), "neutra"];
    default: return [t("erro"), "neutra"];
  }
}

function dominioDe(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function ehOficial(afirmacao, url) {
  const grupos = afirmacao.agregacao?.fontes ?? [];
  return grupos.some(g => g.oficial && (g.urls ?? []).includes(url));
}

function formatarData(valor) {
  if (!valor) return t("naoInformada");
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return String(valor);
  return /T\d/.test(String(valor))
    ? data.toISOString().replace("T", " ").slice(0, 16) + " UTC"
    : String(valor).slice(0, 10);
}

function criarFonte(afirmacao, evidencia, simulado) {
  const fonte = evidencia.fonte ?? {};
  const item = elemento("li", "fonte");
  const cabecalho = elemento("div", "fonte-cabecalho");
  const [rotulo, classe] = rotuloPostura(evidencia.classificacao?.postura);
  cabecalho.append(elemento("span", `etiqueta ${classe}`, rotulo));
  if (ehOficial(afirmacao, fonte.url)) cabecalho.append(elemento("span", "etiqueta oficial", t("oficial")));

  const urlSegura = /^https?:\/\//i.test(fonte.url ?? "") ? fonte.url : null;
  let titulo;
  if (urlSegura && !simulado) {
    titulo = elemento("a", "fonte-titulo", fonte.titulo || urlSegura);
    titulo.href = urlSegura;
    titulo.target = "_blank";
    titulo.rel = "noopener noreferrer";
  } else {
    titulo = elemento("span", "fonte-titulo", fonte.titulo || fonte.url || "—");
  }
  cabecalho.append(titulo, elemento("span", "fonte-dominio", dominioDe(fonte.url)));
  item.append(cabecalho);

  if (fonte.conteudo) item.append(elemento("p", "fonte-trecho", fonte.conteudo));
  const motivo = evidencia.classificacao?.justificativa || evidencia.correspondencia?.justificativa;
  if (motivo) item.append(elemento("p", "fonte-motivo", motivo));

  const datas = elemento("dl", "datas");
  for (const [chave, valor] of [["publicada", fonte.data_publicacao], ["atualizada", fonte.data_atualizacao], ["consultada", fonte.coletado_em]]) {
    const bloco = elemento("div");
    bloco.append(elemento("dt", null, t(chave)), elemento("dd", null, formatarData(valor)));
    datas.append(bloco);
  }
  item.append(datas);

  const temData = Boolean(fonte.data_publicacao || fonte.data_atualizacao);
  if (fonte.escopo_data === "ATTRIBUTE" && temData) {
    item.append(elemento("p", "escopo vinculada", t("dataVinculada")));
  } else if (temData) {
    item.append(elemento("p", "escopo pagina", t("dataPagina")));
  } else {
    item.append(elemento("p", "escopo", t("dataAusente")));
  }
  return item;
}

function criarCartao(afirmacao, simulado) {
  const cartao = $("modelo-cartao").content.firstElementChild.cloneNode(true);
  const agregacao = afirmacao.agregacao ?? {};
  const veredito = agregacao.veredito ?? "NAO_VERIFICAVEL";
  const classe = CLASSE_ESTADO[veredito] ?? "estado-neutro";
  const freshness = agregacao.freshness ?? null;
  const nota = freshness && Number.isFinite(freshness.score) ? freshness.score : null;

  cartao.classList.add(classe);
  const pilula = cartao.querySelector(".pilula");
  pilula.textContent = nomeEstado(veredito);
  pilula.classList.add(classe);
  cartao.querySelector(".afirmacao").textContent = afirmacao.texto;
  cartao.querySelector(".categoria").textContent = textoCategoria(afirmacao);
  configurarMedidor(cartao.querySelector(".medidor"), freshness, veredito);

  const explicar = TEXTOS[estado.idioma][`expl_${veredito}`];
  cartao.querySelector(".explicacao").textContent = explicar ? explicar(nota) : (agregacao.resumo ?? "");
  const notaMotor = cartao.querySelector(".nota-motor");
  notaMotor.textContent = agregacao.resumo ? `${t("notaMotor")}${agregacao.resumo}` : "";
  if (afirmacao.erro_busca) notaMotor.textContent += ` ${afirmacao.erro_busca}`;

  cartao.querySelector(".titulo-fontes").textContent = t("fontesTitulo");
  const lista = cartao.querySelector(".fontes");
  const evidencias = afirmacao.evidencias ?? [];
  if (evidencias.length === 0) {
    lista.append(elemento("li", "sem-fontes", t("semFontes")));
  } else {
    for (const evidencia of evidencias) lista.append(criarFonte(afirmacao, evidencia, simulado));
  }

  const limitacoes = [...new Set([...(freshness?.limitations ?? []), ...(agregacao.limitacoes ?? [])])];
  const detalhes = cartao.querySelector(".limitacoes");
  if (limitacoes.length === 0) {
    detalhes.remove();
  } else {
    detalhes.querySelector("summary").textContent = `${t("limitacoesTitulo")} (${limitacoes.length})`;
    detalhes.querySelector("ul").replaceChildren(...limitacoes.map(texto => elemento("li", null, texto)));
  }
  return cartao;
}

async function iniciar() {
  $("texto").addEventListener("input", atualizarContador);
  $("botao-verificar").addEventListener("click", verificar);
  $("texto").addEventListener("keydown", evento => {
    if ((evento.metaKey || evento.ctrlKey) && evento.key === "Enter") verificar();
  });
  $("botao-idioma").addEventListener("click", () => {
    estado.idioma = estado.idioma === "pt" ? "en" : "pt";
    aplicarIdioma();
  });
  $("botao-exemplo").addEventListener("click", () => {
    if (!estado.status) return;
    $("texto").value = estado.status.texto_exemplo;
    $("dominios").value = estado.status.dominios_exemplo.join(", ");
    document.querySelector('input[name="modo"][value="exemplo"]').checked = true;
    atualizarContador();
    mostrarMensagem("");
  });

  try {
    const resposta = await fetch("/api/status");
    estado.status = await resposta.json();
  } catch {
    estado.status = { modo_real_disponivel: false, texto_exemplo: "", dominios_exemplo: [] };
  }
  aplicarIdioma();
  if (estado.status.modo_real_disponivel) {
    document.querySelector('input[name="modo"][value="real"]').checked = true;
  }
  atualizarContador();
}

document.addEventListener("DOMContentLoaded", iniciar);
