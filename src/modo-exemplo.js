// Modo exemplo do Entrelinhas.
//
// Executa o pipeline REAL (categorias, nuances do português, atualidade,
// concordância entre fontes, agregador, índice temporal e persistência em
// SQLite :memory:) e substitui apenas as chamadas externas — Tavily e
// Bifrost — por respostas fixas, com fontes FICTÍCIAS (domínios .example).
// Serve para demonstrar o produto sem credenciais e sem custo.
const Module = require("node:module");
const path = require("node:path");
const { montarFontesNumeradas, GRUPO_VEREDITO } = require("./resposta-corrigida");

const DIA_MS = 24 * 60 * 60 * 1000;

function diasAtras(agora, dias) {
  return new Date(agora.getTime() - dias * DIA_MS).toISOString().slice(0, 10);
}

// Cada exemplo: texto, domínios oficiais, afirmações (como o modelo as
// separaria) e fontes por afirmação com a postura que o modelo simulado dará.
function exemplos(agora) {
  const f = (url, categoria, titulo, conteudo, postura, justificativa, datas = {}) => ({
    postura, justificativa,
    fonte: { tipo_fonte: "tavily_extract", categoria_fonte: categoria, titulo, url, conteudo,
      data_publicacao: datas.pub ?? null, data_atualizacao: datas.upd ?? null,
      escopo_data: datas.escopo ?? (datas.upd || datas.pub ? "PAGE" : "UNKNOWN"), relevancia: 0.9 }
  });
  return {
    en: {
      rotulo: "Example · English",
      texto: "Acme Cloud's Pro plan costs $20 per month. The Acme API still supports the /v1/completions endpoint. Under the Data Act of 2025, companies with more than 50 employees must appoint a data protection officer.",
      dominios: ["acme.example", "gov.example"],
      afirmacoes: [
        ["Acme Cloud's Pro plan costs $20 per month.", "preco", [
          f("https://acme.example/pricing", "OFICIAL", "Acme Cloud — Pricing", `Pro plan: $20 per user / month, billed monthly. Prices updated on ${diasAtras(agora, 7)}.`, "SUPPORTS", "The official pricing table lists the Pro plan at $20 per month, next to a visible 'Prices updated on' date.", { upd: diasAtras(agora, 7), escopo: "ATTRIBUTE" }),
          f("https://technews.example/acme-pricing", "NOTICIA", "Acme keeps Pro plan at $20", "Acme Cloud confirmed this quarter that its Pro plan stays at $20 a month.", "SUPPORTS", "A news report confirms the same price for the same plan.", { pub: diasAtras(agora, 40) }),
          f("https://reviews.example/acme-cloud-pro", "BLOG_FORUM", "Is Acme Cloud Pro worth it?", "At $20 per month, Acme Cloud Pro sits in the middle of the market.", "SUPPORTS", "A review mentions the same price; its date refers to the article, not to the price.", { pub: diasAtras(agora, 210) })
        ]],
        ["The Acme API still supports the /v1/completions endpoint.", "versao_api", [
          f("https://docs.acme.example/changelog", "OFICIAL", "Acme API changelog", `Breaking change (${diasAtras(agora, 12)}): the /v1/completions endpoint has been retired. Use /v2/responses.`, "CONTRADICTS", "The official changelog states that /v1/completions was retired and replaced by /v2/responses.", { upd: diasAtras(agora, 12), escopo: "ATTRIBUTE" }),
          f("https://devnews.example/acme-retires-v1", "NOTICIA", "Acme retires its v1 completions API", "Developers have until the end of the month to migrate away from /v1/completions, Acme said.", "CONTRADICTS", "A news article reports the retirement of the endpoint.", { pub: diasAtras(agora, 20) }),
          f("https://devblog.example/acme-completions-tutorial", "BLOG_FORUM", "Tutorial: calling /v1/completions", "Send a POST request to /v1/completions with your prompt.", "SUPPORTS", "An old tutorial shows /v1/completions working: exactly what an outdated AI answer would repeat.", { pub: diasAtras(agora, 480) })
        ], "The Acme API no longer supports the /v1/completions endpoint: it was retired and replaced by /v2/responses."],
        ["Under the Data Act of 2025, companies with more than 50 employees must appoint a data protection officer.", "regulamento", [
          f("https://gov.example/data-act-2025", "OFICIAL", "Data Act of 2025 — full text", "Article 12. Organisations employing more than 50 persons shall designate a data protection officer.", "SUPPORTS", "The official text contains the 50-employee threshold; the page declares no publication or update date."),
          f("https://lawnews.example/data-act-explained", "NOTICIA", "What the Data Act means for mid-size firms", "Firms with more than 50 staff now need a data protection officer under the new act.", "SUPPORTS", "A legal news article describes the same obligation and threshold.", { pub: diasAtras(agora, 90) }),
          f("https://encyclopedia.example/wiki/Data_Act_2025", "REFERENCIA", "Data Act of 2025 — encyclopedia entry", "The act requires a data protection officer in organisations with over 50 employees.", "SUPPORTS", "A reference entry states the same requirement.")
        ]]
      ]
    },
    pt: {
      rotulo: "Exemplo · Português",
      texto: "O plano Premium da Fictícia Telecom custa a partir de R$ 99,90 por mês. A Fictícia Telecom atualmente tem cerca de 5 mil funcionários.",
      dominios: ["ficticiatelecom.example"],
      afirmacoes: [
        ["O plano Premium da Fictícia Telecom custa a partir de R$ 99,90 por mês.", "preco", [
          f("https://ficticiatelecom.example/planos", "OFICIAL", "Fictícia Telecom — Planos", `Premium 500 Mega: R$ 119,90/mês. Premium 300 Mega: R$ 99,90/mês. Preços atualizados em ${diasAtras(agora, 5).split("-").reverse().join("/")}.`, "SUPPORTS", "The official page lists Premium plans from R$ 99,90 to R$ 119,90 per month; 'a partir de' means a starting price, so the claim holds.", { upd: diasAtras(agora, 5), escopo: "ATTRIBUTE" }),
          f("https://noticiasbr.example/telecom/precos", "NOTICIA", "Operadoras reajustam planos de internet", "A Fictícia Telecom manteve o Premium a partir de R$ 99,90 mensais, segundo a empresa.", "SUPPORTS", "A Brazilian news article reports the same starting price.", { pub: diasAtras(agora, 30) })
        ]],
        ["A Fictícia Telecom atualmente tem cerca de 5 mil funcionários.", "empresa", [
          f("https://noticiasbr.example/negocios/ficticia-demissoes", "NOTICIA", "Fictícia Telecom reduz quadro para 3.200 pessoas", "Após a reestruturação, a Fictícia Telecom passou a ter 3.200 funcionários.", "CONTRADICTS", "A recent news report says the company now has 3,200 employees, not about 5,000.", { pub: diasAtras(agora, 25) }),
          f("https://enciclopedia.example/wiki/Ficticia_Telecom", "REFERENCIA", "Fictícia Telecom — verbete", "Funcionários: 3.200 (2026). A empresa chegou a ter 5 mil funcionários em 2022.", "CONTRADICTS", "The reference entry says 5,000 was the 2022 figure; 'atualmente' (currently) makes the claim about today, when it is 3,200.", { pub: diasAtras(agora, 60) }),
          f("https://blogdeempregos.example/ficticia", "BLOG_FORUM", "Trabalhar na Fictícia Telecom", "Com cerca de 5 mil funcionários, a Fictícia Telecom é uma das maiores do setor.", "SUPPORTS", "An old blog post repeats the 5,000 figure.", { pub: diasAtras(agora, 900) })
        ], "A Fictícia Telecom tem hoje 3.200 funcionários, após uma reestruturação; os 5 mil eram o número de 2022."]
      ]
    }
  };
}

function normalizarTexto(texto) {
  return String(texto ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function identificarExemplo(texto, agora = new Date()) {
  const todos = exemplos(agora);
  return Object.entries(todos).find(([, e]) => normalizarTexto(e.texto) === normalizarTexto(texto))?.[0] ?? null;
}

function listarExemplos() {
  const todos = exemplos(new Date());
  return Object.entries(todos).map(([id, e]) => ({ id, rotulo: e.rotulo, texto: e.texto, dominios: e.dominios }));
}

function criarVerificadorExemplo({ agora = new Date() } = {}) {
  const arquivoVerificador = path.join(__dirname, "verificador.js");
  const todos = exemplos(agora);
  const coletadoEm = agora.toISOString();
  let atual = null;
  const posturaPorUrl = new Map();
  for (const e of Object.values(todos)) {
    for (const [, , fontes] of e.afirmacoes) for (const item of fontes) posturaPorUrl.set(item.fonte.url, item);
  }
  const registrar = (opcoes, etapa, extra = {}) => opcoes?.onMetadata?.({
    etapa, provedor: "SIMULADO", modelo: "example-mode", simulado: true, latencia_ms: 0, ...extra
  });

  const simulados = {
    "./afirmacoes": {
      async decomporEmAfirmacoes(texto, opcoes) {
        const id = identificarExemplo(texto, agora);
        if (!id) {
          throw Object.assign(new Error("Example mode only checks the built-in example answers. Configure TAVILY_API_KEY and BIFROST_KEY to check your own text."), { status: 400 });
        }
        atual = todos[id];
        registrar(opcoes, "DECOMPOSICAO");
        return atual.afirmacoes.map(([t, categoria], i) => ({ id: `afirmacao_${i + 1}`, texto: t, categoria_sugerida: categoria }));
      }
    },
    "./tavily": {
      async pesquisarComTavily(_texto, opcoes) {
        opcoes?.onMetadata?.({ operacao: "BUSCA_E_EXTRACAO", status: "SIMULADO", provedor: "SIMULADO", id_afirmacao: opcoes.idAfirmacao });
        const indice = Number(String(opcoes.idAfirmacao).split("_")[1]) - 1;
        return (atual?.afirmacoes[indice]?.[2] ?? []).map(item => ({ ...item.fonte, coletado_em: coletadoEm }));
      }
    },
    "./preparar-evidencia": {
      prepararEvidencia(_afirmacao, fonte) {
        return { conteudo_original: fonte.conteudo, conteudo_para_analise: fonte.conteudo, motivo_preparacao: "MODO_EXEMPLO", caracteres_originais: fonte.conteudo.length };
      }
    },
    "./resposta-corrigida": {
      // Determinística: mesma montagem de fontes numeradas do modo real, sem modelo.
      async gerarRespostaCorrigida(_texto, resultados, opcoes) {
        registrar(opcoes, "RESPOSTA_CORRIGIDA");
        const fontes = montarFontesNumeradas(resultados);
        const pt = atual === todos.pt;
        const partes = []; const mudancas = [];
        resultados.forEach((r, i) => {
          const grupo = GRUPO_VEREDITO[r.agregacao?.veredito] ?? "NOT_VERIFIABLE";
          const daAfirmacao = fontes.filter(f => f.claim_id === r.id);
          const cita = postura => daAfirmacao.filter(f => f.stance === postura).map(f => `[${f.n}]`).join("");
          const correcao = atual?.afirmacoes[i]?.[3];
          if (grupo === "CONTRADICTED" && correcao) {
            partes.push(`${correcao.replace(/\.$/, "")} ${cita("CONTRADICTS")}.`);
            mudancas.push({ claim_id: r.id, what: "Replaced with what current sources say." });
          } else if (grupo === "SUPPORTED" || grupo === "WEAKLY_SUPPORTED") {
            partes.push(`${r.texto.replace(/\.$/, "")} ${cita("SUPPORTS")}.`);
            mudancas.push({ claim_id: r.id, what: "Kept: current sources confirm it." });
          } else {
            partes.push(`${r.texto.replace(/\.$/, "")} (${pt ? "não foi possível confirmar" : "could not be confirmed"}).`);
            mudancas.push({ claim_id: r.id, what: "Kept with a note: could not be confirmed." });
          }
        });
        const texto = partes.join(" ").replace(/ \./g, ".");
        return {
          texto,
          mudancas,
          fontes_citadas: [...new Set([...texto.matchAll(/\[(\d+)\]/g)].map(m => Number(m[1])))],
          fontes: fontes.map(({ n, url, title, type, stance, date }) => ({ n, url, titulo: title, tipo: type, postura: stance, data: date })),
          metodo: "EXAMPLE_MODE_TEMPLATE"
        };
      }
    },
    "./correspondencia": {
      async avaliarCorrespondencia(_a, _c, opcoes) {
        registrar(opcoes, "CORRESPONDENCIA", { url_evidencia: opcoes.urlEvidencia });
        return { status: "MATCH", justificativa: "Simulated: the source is about the same object as the claim." };
      }
    },
    "./classificador": {
      async classificarEvidencia(_a, _c, opcoes) {
        registrar(opcoes, "CLASSIFICACAO", { url_evidencia: opcoes.urlEvidencia });
        const item = posturaPorUrl.get(opcoes.urlEvidencia);
        return { postura: item?.postura ?? "INSUFFICIENT", justificativa: item?.justificativa ?? "Simulated source without a defined stance." };
      }
    }
  };

  delete require.cache[arquivoVerificador];
  const carregarOriginal = Module._load;
  Module._load = function (request, parent, isMain) {
    if (parent?.filename === arquivoVerificador && Object.hasOwn(simulados, request)) return simulados[request];
    return carregarOriginal.call(this, request, parent, isMain);
  };
  let verificarTexto;
  try {
    verificarTexto = require(arquivoVerificador).verificarTexto;
  } finally {
    Module._load = carregarOriginal;
    delete require.cache[arquivoVerificador];
  }

  return async function verificarExemplo(texto, opcoes = {}) {
    const id = identificarExemplo(texto, agora);
    return verificarTexto(texto, {
      ...opcoes,
      analiseEmLote: false,
      respostaCorrigida: true,
      dominiosOficiais: id ? todos[id].dominios : [],
      dataReferencia: agora
    });
  };
}

const TEXTO_EXEMPLO = exemplos(new Date()).en.texto;
const DOMINIOS_OFICIAIS_EXEMPLO = exemplos(new Date()).en.dominios;

module.exports = {
  TEXTO_EXEMPLO,
  DOMINIOS_OFICIAIS_EXEMPLO,
  criarVerificadorExemplo,
  listarExemplos,
  textoEhExemplo: texto => identificarExemplo(texto) !== null
};
