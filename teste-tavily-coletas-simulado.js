const assert = require("node:assert/strict");

const { pesquisarComTavily } = require("./src/tavily");
const sinaisTemporais = require("./src/sinais-temporais");

const URLS = [
  "https://fonte-um.example/artigo",
  "https://fonte-dois.example/artigo",
  "https://fonte-tres.example/artigo"
];

const resultadosBusca = URLS.map((url, indice) => ({
  id: `resultado-${indice + 1}`,
  title: `Fonte simulada ${indice + 1}`,
  url,
  content: `Snippet da fonte simulada ${indice + 1}.`,
  score: 0.99 - indice / 100,
  published_date: "2026-11-09"
}));

const resultadosExtracao = URLS.map((url, indice) => ({
  url,
  raw_content: `Conteúdo extraído da fonte simulada ${indice + 1}.`
}));

async function executarTeste() {
  const fetchOriginal = global.fetch;
  const obterMetadadosOriginal = sinaisTemporais.obterMetadadosPagina;
  const tavilyKeyOriginal = process.env.TAVILY_API_KEY;
  const chamadasSimuladas = [];
  const chamadasMetadadosSimuladas = [];

  sinaisTemporais.obterMetadadosPagina = async (url, opcoes) => {
    chamadasMetadadosSimuladas.push({ url, opcoes });
    return {
      status: "SUCCESS",
      final_url: url,
      captured_at: "2026-11-11T12:00:00.000Z",
      signals: [{ signal_type: "HTTP_LAST_MODIFIED", field: "Last-Modified",
        value_original: "Mon, 09 Nov 2026 12:00:00 GMT", value_normalized: "2026-11-09",
        scope: "PAGE", source: "HTTP_HEADER" }]
    };
  };

  global.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    const endpoint = new URL(url).pathname;

    chamadasSimuladas.push({ endpoint, init });

    let corpo;
    try {
      corpo = JSON.parse(init.body ?? "{}");
    } catch {
      throw new Error("O corpo da chamada simulada não é JSON válido.");
    }

    if (endpoint === "/search") {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            request_id: "busca-simulada-001",
            response_time: 0.01,
            results: resultadosBusca
          };
        }
      };
    }

    if (endpoint === "/extract") {
      assert.deepEqual(corpo.urls, URLS);
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            request_id: "extracao-simulada-001",
            response_time: 0.01,
            results: resultadosExtracao
          };
        }
      };
    }

    throw new Error(`Chamada não simulada bloqueada: ${url}`);
  };

  process.env.TAVILY_API_KEY = "chave-ficticia-do-teste";

  try {
    console.log("Executando pesquisarComTavily() com fetch simulado...");

    const evidencias = await pesquisarComTavily(
      "Consulta de teste para três fontes",
      { idVerificacao: "verificacao-simulada-001" }
    );

    assert.equal(chamadasSimuladas.length, 2);
    assert.deepEqual(
      chamadasSimuladas.map(chamada => chamada.endpoint),
      ["/search", "/extract"]
    );

    assert.equal(evidencias.length, 3);
    assert.equal(chamadasMetadadosSimuladas.length, 3);
    assert.deepEqual(
      evidencias.map(evidencia => evidencia.url),
      URLS
    );
    assert.ok(
      evidencias.every(evidencia => evidencia.tipo_fonte === "tavily_extract")
    );
    assert.ok(evidencias.every(evidencia => evidencia.escopo_data === "PAGE"));
    assert.ok(evidencias.every(evidencia =>
      evidencia.metadados_provedor.sinais_data.length === 2 &&
      evidencia.metadados_provedor.sinais_data.some(sinal => sinal.source === "TAVILY_SEARCH_RESULT" && sinal.scope === "PAGE")
    ));
    assert.ok(evidencias.every(evidencia =>
      evidencia.metadados_provedor.sinais_data.some(sinal => sinal.signal_type === "HTTP_LAST_MODIFIED" && sinal.scope === "PAGE")
    ));

    const idsColeta = evidencias.map(evidencia => evidencia.coleta?.id_coleta);

    assert.ok(idsColeta.every(id => typeof id === "string" && id.length > 0));
    assert.equal(new Set(idsColeta).size, 3);

    const evidenciasSegundaAquisicao = await pesquisarComTavily(
      "Consulta de teste repetida para as mesmas fontes",
      { idVerificacao: "verificacao-simulada-002" }
    );
    const idsSegundaAquisicao = evidenciasSegundaAquisicao.map(
      evidencia => evidencia.coleta?.id_coleta
    );

    assert.equal(evidenciasSegundaAquisicao.length, 3);
    assert.ok(idsSegundaAquisicao.every(
      id => typeof id === "string" && id.length > 0
    ));
    assert.equal(new Set(idsSegundaAquisicao).size, 3);
    assert.equal(
      idsColeta.some(id => idsSegundaAquisicao.includes(id)),
      false,
      "Uma nova aquisição efetiva precisa gerar novos IDs de coleta."
    );
    assert.deepEqual(
      chamadasSimuladas.map(chamada => chamada.endpoint),
      ["/search", "/extract", "/search", "/extract"]
    );

    console.log("PASSOU: duas chamadas simuladas de busca e extração retornaram três evidências cada.");
    console.log("PASSOU: as três evidências são do tipo tavily_extract.");
    console.log("PASSOU: cada evidência possui id_coleta preenchido.");
    console.log("PASSOU: cada aquisição possui três id_coleta distintos.");
    console.log("PASSOU: a segunda aquisição gerou IDs diferentes dos da primeira.");
    console.log("PASSOU: exatamente quatro chamadas foram interceptadas pelo fetch falso (/search e /extract, duas vezes).");
    console.log("Nenhuma chamada de rede real foi permitida.");
    console.log("IDs de coleta:", idsColeta.join(", "));
  } finally {
    if (fetchOriginal === undefined) {
      delete global.fetch;
    } else {
      global.fetch = fetchOriginal;
    }

    if (tavilyKeyOriginal === undefined) {
      delete process.env.TAVILY_API_KEY;
    } else {
      process.env.TAVILY_API_KEY = tavilyKeyOriginal;
    }
    sinaisTemporais.obterMetadadosPagina = obterMetadadosOriginal;
  }
}

executarTeste().catch(erro => {
  console.error("FALHOU: teste simulado de IDs de coleta.");
  console.error(erro);
  process.exitCode = 1;
});
