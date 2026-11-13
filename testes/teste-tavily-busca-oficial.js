const assert = require("node:assert/strict");
const { pesquisarComTavily } = require("../src/tavily");

const URLS = {
  secundariaA: "https://news.test/afirmacao",
  secundariaB: "https://blog.test/afirmacao",
  oficialA: "https://docs.example.com/afirmacao",
  oficialB: "https://example.com/outra-pagina"
};

function resultado(url, score, id) {
  return {
    id,
    title: `Resultado ${id}`,
    url,
    score,
    content: `Trecho de apoio para ${id}.`,
    raw_content: `Conteúdo de busca de ${id}.`,
    published_date: "2026-11-10"
  };
}

async function main() {
  const fetchOriginal = global.fetch;
  const chaveOriginal = process.env.TAVILY_API_KEY;
  const chamadas = [];
  const metadados = [];
  let falharBuscaOficial = false;
  process.env.TAVILY_API_KEY = "chave-ficticia-local";

  global.fetch = async (url, opcoes) => {
    const endpoint = new URL(url).pathname;
    const corpo = JSON.parse(opcoes.body);
    chamadas.push({ endpoint, corpo });

    if (endpoint === "/search") {
      if (corpo.include_domains) {
        if (falharBuscaOficial) {
          return new Response(JSON.stringify({ error: "Falha simulada." }), {
            status: 503,
            headers: { "Content-Type": "application/json" }
          });
        }
        return new Response(JSON.stringify({
          request_id: "req-oficial",
          response_time: 0.2,
          results: [
            resultado(URLS.oficialA, 0.98, "oficial-a-repetido"),
            resultado(URLS.oficialB, 0.90, "oficial-b")
          ]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({
        request_id: "req-geral",
        response_time: 0.1,
        results: [
          resultado(URLS.secundariaA, 0.99, "secundaria-a"),
          resultado(URLS.secundariaB, 0.95, "secundaria-b"),
          resultado(URLS.oficialA, 0.70, "oficial-a-geral")
        ]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (endpoint === "/extract") {
      return new Response(JSON.stringify({
        request_id: "req-extracao",
        response_time: 0.3,
        results: corpo.urls.map(urlFonte => ({
          url: urlFonte,
          raw_content: `Conteúdo extraído de ${urlFonte}.`
        }))
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    throw new Error(`Endpoint inesperado no teste: ${endpoint}`);
  };

  try {
    const evidencias = await pesquisarComTavily("afirmação sintética", {
      idVerificacao: "verificacao-teste",
      idAfirmacao: "afirmacao-teste",
      dominiosOficiais: ["example.com", "www.example.com"],
      onMetadata: item => metadados.push(item)
    });

    assert.equal(chamadas.filter(item => item.endpoint === "/search").length, 2);
    assert.deepEqual(chamadas[0].corpo.include_domains, undefined);
    assert.deepEqual(chamadas[1].corpo.include_domains, ["example.com"]);
    const extracao = chamadas.find(item => item.endpoint === "/extract");
    assert.deepEqual(extracao.corpo.urls, [URLS.oficialA, URLS.oficialB, URLS.secundariaA]);

    assert.equal(evidencias.length, 4);
    assert.equal(new Set(evidencias.map(item => item.url)).size, 4);
    const fonteDuplicada = evidencias.find(item => item.url === URLS.oficialA);
    assert.equal(fonteDuplicada.metadados_provedor.buscas.length, 2);
    assert.equal(fonteDuplicada.coleta.id_operacao_busca, metadados[1].id_operacao);
    assert.equal(fonteDuplicada.coleta.metadados.operacoes_busca.length, 2);
    assert.equal(fonteDuplicada.tipo_fonte, "tavily_extract");
    assert.ok(evidencias.every(item => item.coleta.id_coleta));
    assert.deepEqual(metadados.map(item => item.etapa), ["BUSCA", "BUSCA", "EXTRACAO"]);
    console.log("PASSOU: busca geral e busca oficial são combinadas, deduplicadas e rastreadas; URLs oficiais têm prioridade na extração.");

    chamadas.length = 0;
    metadados.length = 0;
    falharBuscaOficial = true;
    const fallback = await pesquisarComTavily("afirmação sintética", {
      idVerificacao: "verificacao-teste-fallback",
      idAfirmacao: "afirmacao-teste",
      dominiosOficiais: ["example.com"],
      onMetadata: item => metadados.push(item)
    });
    assert.ok(fallback.length > 0);
    assert.equal(metadados[0].status, "SUCESSO");
    assert.equal(metadados[1].status, "ERRO");
    assert.equal(metadados[2].etapa, "EXTRACAO");
    console.log("PASSOU: falha da busca oficial fica registrada e a busca geral segue disponível.");
    console.log("Todas as chamadas de rede foram interceptadas por fetch simulado.");
  } finally {
    global.fetch = fetchOriginal;
    if (chaveOriginal === undefined) delete process.env.TAVILY_API_KEY;
    else process.env.TAVILY_API_KEY = chaveOriginal;
  }
}

main().catch(erro => {
  console.error("FALHOU:", erro);
  process.exitCode = 1;
});
