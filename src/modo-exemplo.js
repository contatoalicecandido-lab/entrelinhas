// Modo exemplo do Entrelinhas.
//
// Executa o pipeline REAL (categorias, avaliação de atualidade, agregador,
// índice temporal e persistência em SQLite :memory:) substituindo apenas as
// chamadas externas — Tavily e Bifrost — por respostas fixas e fictícias.
// Serve para demonstrar o produto sem credenciais e sem custo.
// Nada aqui deve ser apresentado como resultado de fontes reais.
const Module = require("node:module");
const path = require("node:path");

const DIA_MS = 24 * 60 * 60 * 1000;

const TEXTO_EXEMPLO =
  "Acme Cloud's Pro plan costs $20 per month. " +
  "The Acme API still supports the /v1/completions endpoint. " +
  "Under the Data Act of 2025, companies with more than 50 employees must appoint a data protection officer.";

const DOMINIOS_OFICIAIS_EXEMPLO = ["acme.example", "gov.example"];

const AFIRMACOES = [
  { texto: "Acme Cloud's Pro plan costs $20 per month.", categoria: "preco" },
  { texto: "The Acme API still supports the /v1/completions endpoint.", categoria: "versao_api" },
  {
    texto: "Under the Data Act of 2025, companies with more than 50 employees must appoint a data protection officer.",
    categoria: "regulamento"
  }
];

function diasAtras(agora, dias) {
  return new Date(agora.getTime() - dias * DIA_MS).toISOString().slice(0, 10);
}

// Fontes fictícias por afirmação. "postura" é a resposta que o modelo
// simulado dará; o restante é o que a Tavily simulada devolve.
function fontesPorAfirmacao(agora) {
  const coletadoEm = agora.toISOString();
  return {
    afirmacao_1: [
      {
        postura: "SUPPORTS",
        justificativa: "The official pricing table lists the Pro plan at $20/month, with a visible 'Prices updated on' date next to the table.",
        fonte: {
          tipo_fonte: "tavily_extract",
          titulo: "Acme Cloud — Pricing (fictional)",
          url: "https://acme.example/pricing",
          conteudo: "Pro plan: $20 per user / month, billed monthly. Prices updated on " + diasAtras(agora, 7) + ".",
          coletado_em: coletadoEm,
          data_publicacao: null,
          data_atualizacao: diasAtras(agora, 7),
          escopo_data: "ATTRIBUTE",
          relevancia: 0.97
        }
      },
      {
        postura: "SUPPORTS",
        justificativa: "A third-party review mentions the same price, but its date refers to the article, not to the price.",
        fonte: {
          tipo_fonte: "tavily_extract",
          titulo: "Review: Is Acme Cloud Pro worth it? (fictional)",
          url: "https://techreviews.example/acme-cloud-pro",
          conteudo: "At $20 per month, Acme Cloud Pro sits in the middle of the market.",
          coletado_em: coletadoEm,
          data_publicacao: diasAtras(agora, 210),
          data_atualizacao: null,
          escopo_data: "PAGE",
          relevancia: 0.81
        }
      }
    ],
    afirmacao_2: [
      {
        postura: "CONTRADICTS",
        justificativa: "The official changelog states that /v1/completions was retired and replaced by /v2/responses.",
        fonte: {
          tipo_fonte: "tavily_extract",
          titulo: "Acme API changelog (fictional)",
          url: "https://docs.acme.example/changelog",
          conteudo: "Breaking change (" + diasAtras(agora, 12) + "): the /v1/completions endpoint has been retired. Use /v2/responses.",
          coletado_em: coletadoEm,
          data_publicacao: null,
          data_atualizacao: diasAtras(agora, 12),
          escopo_data: "ATTRIBUTE",
          relevancia: 0.95
        }
      },
      {
        postura: "SUPPORTS",
        justificativa: "An old tutorial shows /v1/completions working, which is what an outdated AI answer would repeat.",
        fonte: {
          tipo_fonte: "tavily_extract",
          titulo: "Tutorial: calling /v1/completions (fictional)",
          url: "https://devblog.example/acme-completions-tutorial",
          conteudo: "Send a POST request to /v1/completions with your prompt.",
          coletado_em: coletadoEm,
          data_publicacao: diasAtras(agora, 480),
          data_atualizacao: null,
          escopo_data: "PAGE",
          relevancia: 0.77
        }
      }
    ],
    afirmacao_3: [
      {
        postura: "SUPPORTS",
        justificativa: "The official text of the act contains the 50-employee threshold, but the page declares no publication or update date.",
        fonte: {
          tipo_fonte: "tavily_extract",
          titulo: "Data Act of 2025 — full text (fictional)",
          url: "https://gov.example/data-act-2025",
          conteudo: "Article 12. Organisations employing more than 50 persons shall designate a data protection officer.",
          coletado_em: coletadoEm,
          data_publicacao: null,
          data_atualizacao: null,
          relevancia: 0.93
        }
      }
    ]
  };
}

function normalizarTexto(texto) {
  return String(texto ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function textoEhExemplo(texto) {
  return normalizarTexto(texto) === normalizarTexto(TEXTO_EXEMPLO);
}

function criarVerificadorExemplo({ agora = new Date() } = {}) {
  const arquivoVerificador = path.join(__dirname, "verificador.js");
  const fontes = fontesPorAfirmacao(agora);
  const posturaPorUrl = new Map();
  for (const lista of Object.values(fontes)) {
    for (const item of lista) posturaPorUrl.set(item.fonte.url, item);
  }

  function registrarModelo(opcoes, etapa, extra = {}) {
    opcoes?.onMetadata?.({
      etapa,
      provedor: "SIMULADO",
      modelo: "modo-exemplo",
      simulado: true,
      latencia_ms: 0,
      ...extra
    });
  }

  const simulados = {
    "./afirmacoes": {
      async decomporEmAfirmacoes(texto, opcoes) {
        if (!textoEhExemplo(texto)) {
          throw Object.assign(
            new Error("No modo exemplo só o texto de demonstração pode ser verificado. Use \"Carregar exemplo\" ou configure TAVILY_API_KEY e BIFROST_KEY para verificar outros textos."),
            { status: 400 }
          );
        }
        registrarModelo(opcoes, "DECOMPOSICAO");
        return AFIRMACOES.map((item, indice) => ({
          id: `afirmacao_${indice + 1}`,
          texto: item.texto,
          categoria_sugerida: item.categoria
        }));
      }
    },
    "./tavily": {
      async pesquisarComTavily(_texto, opcoes) {
        opcoes?.onMetadata?.({
          operacao: "BUSCA_E_EXTRACAO",
          status: "SIMULADO",
          provedor: "SIMULADO",
          id_afirmacao: opcoes.idAfirmacao
        });
        return (fontes[opcoes.idAfirmacao] ?? []).map(item => ({ ...item.fonte }));
      }
    },
    "./preparar-evidencia": {
      prepararEvidencia(_afirmacao, fonte) {
        return {
          conteudo_original: fonte.conteudo,
          conteudo_para_analise: fonte.conteudo,
          motivo_preparacao: "MODO_EXEMPLO",
          caracteres_originais: fonte.conteudo.length
        };
      }
    },
    "./correspondencia": {
      async avaliarCorrespondencia(_afirmacao, _conteudo, opcoes) {
        registrarModelo(opcoes, "CORRESPONDENCIA", { url_evidencia: opcoes.urlEvidencia });
        return { status: "MATCH", justificativa: "Simulated: the source talks about the same object as the claim." };
      }
    },
    "./classificador": {
      async classificarEvidencia(_afirmacao, _conteudo, opcoes) {
        registrarModelo(opcoes, "CLASSIFICACAO", { url_evidencia: opcoes.urlEvidencia });
        const item = posturaPorUrl.get(opcoes.urlEvidencia);
        return {
          postura: item?.postura ?? "INSUFFICIENT",
          justificativa: item?.justificativa ?? "Simulated source without a defined stance."
        };
      }
    }
  };

  delete require.cache[arquivoVerificador];
  const carregarOriginal = Module._load;
  Module._load = function (request, parent, isMain) {
    if (parent?.filename === arquivoVerificador && Object.hasOwn(simulados, request)) {
      return simulados[request];
    }
    return carregarOriginal.call(this, request, parent, isMain);
  };
  let verificarTexto;
  try {
    verificarTexto = require(arquivoVerificador).verificarTexto;
  } finally {
    Module._load = carregarOriginal;
    // Evita que o verificador simulado fique no cache para outros usos.
    delete require.cache[arquivoVerificador];
  }

  return async function verificarExemplo(texto, opcoes = {}) {
    return verificarTexto(texto, {
      ...opcoes,
      dominiosOficiais: DOMINIOS_OFICIAIS_EXEMPLO,
      dataReferencia: agora
    });
  };
}

module.exports = {
  TEXTO_EXEMPLO,
  DOMINIOS_OFICIAIS_EXEMPLO,
  criarVerificadorExemplo,
  textoEhExemplo
};
