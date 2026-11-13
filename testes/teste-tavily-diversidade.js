// Busca com notícias, país e seleção diversa de fontes (Tavily simulada).
// fetch e leitura de metadados de página substituídos; sem rede e sem banco.
const assert = require("node:assert/strict");
const sinaisTemporais = require("../src/sinais-temporais");
const { pesquisarComTavily, janelaNoticias } = require("../src/tavily");

const r = (url, score, id) => ({ id, title: `T ${id}`, url, score, content: `Trecho ${id}.`, raw_content: null, published_date: "2026-11-10" });

async function main() {
  const fetchOriginal = global.fetch;
  const metaOriginal = sinaisTemporais.obterMetadadosPagina;
  const chaveOriginal = process.env.TAVILY_API_KEY;
  process.env.TAVILY_API_KEY = "chave-ficticia-local";
  sinaisTemporais.obterMetadadosPagina = async () => ({ status: "SKIPPED", reason: "TEST", signals: [] });
  const buscas = [];
  let extraidas = [];
  global.fetch = async (url, opcoes) => {
    const endpoint = new URL(url).pathname;
    const corpo = JSON.parse(opcoes.body);
    if (endpoint === "/search") {
      buscas.push(corpo);
      const results = corpo.topic === "news"
        ? [r("https://g1.globo.com/economia/plano", 0.80, "n1"), r("https://www.reuters.com/tech/plan", 0.70, "n2")]
        : [
          r("https://medium.com/@a/plano-1", 0.99, "b1"),
          r("https://medium.com/@b/plano-2", 0.98, "b2"),
          r("https://www.operadora.com.br/planos", 0.90, "o1"),
          r("https://pt.wikipedia.org/wiki/Operadora", 0.85, "w1"),
          r("https://comparaplanos.com.br/operadora", 0.60, "x1")
        ];
      return new Response(JSON.stringify({ request_id: `req-${buscas.length}`, response_time: 0.1, results }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (endpoint === "/extract") {
      extraidas = corpo.urls;
      return new Response(JSON.stringify({ request_id: "req-ext", response_time: 0.2, results: corpo.urls.map(u => ({ url: u, raw_content: `Conteúdo de ${u}.` })) }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    throw new Error(`Endpoint inesperado: ${endpoint}`);
  };

  try {
    const evidencias = await pesquisarComTavily("O plano da Operadora custa a partir de R$ 49,90", {
      incluirNoticias: true,
      pais: "brazil",
      selecaoDiversa: true,
      maxFontes: 5,
      dominiosOficiais: ["operadora.com.br"]
    });

    const geral = buscas.find(b => !b.topic && !b.include_domains);
    const noticias = buscas.find(b => b.topic === "news");
    assert.equal(geral.country, "brazil");
    assert.ok(noticias, "busca de notícias executada");
    assert.equal(noticias.country, undefined, "country não vai na busca de notícias");
    assert.ok(noticias.include_domains.includes("g1.globo.com") && noticias.include_domains.includes("agenciabrasil.ebc.com.br"),
      "afirmação em português: notícias só de veículos brasileiros");
    console.log("PASSOU: busca geral com país Brasil; notícias limitadas a veículos brasileiros.");

    assert.equal(geral.time_range, undefined, "busca geral sem filtro de data: páginas oficiais antigas continuam válidas");
    assert.equal(noticias.time_range, "year", "sem tipo informado, notícias do último ano");
    assert.equal(janelaNoticias("preco"), "month");
    assert.equal(janelaNoticias("versao_api"), "year");
    assert.equal(janelaNoticias("regulamento"), "year");
    assert.equal(janelaNoticias("empresa"), "year");
    console.log("PASSOU: notícias filtradas por período conforme o tipo de afirmação (preço: último mês).");

    const hosts = extraidas.map(u => new URL(u).hostname.replace(/^www\./, ""));
    assert.equal(extraidas.length, 5);
    assert.equal(hosts[0], "operadora.com.br", "fonte oficial primeiro");
    assert.equal(new Set(hosts).size, 5, "nenhum domínio repetido");
    assert.ok(hosts.includes("g1.globo.com") && hosts.includes("pt.wikipedia.org") && hosts.includes("reuters.com"));
    assert.ok(!hosts.includes("medium.com"), "blog só entra se faltar fonte melhor");
    console.log("PASSOU: seleção diversa prioriza oficial, notícias e referência; blog fica de fora quando há fontes melhores.");

    const categorias = Object.fromEntries(evidencias.filter(e => e.tipo_fonte === "tavily_extract").map(e => [new URL(e.url).hostname.replace(/^www\./, ""), e.categoria_fonte]));
    assert.equal(categorias["operadora.com.br"], "OFICIAL");
    assert.equal(categorias["g1.globo.com"], "NOTICIA");
    assert.equal(categorias["pt.wikipedia.org"], "REFERENCIA");
    assert.equal(categorias["reuters.com"], "NOTICIA");
    console.log("PASSOU: cada evidência traz o tipo da fonte.");

    buscas.length = 0;
    await pesquisarComTavily("afirmação simples", {});
    assert.equal(buscas.length, 1, "sem opções: só a busca geral, como antes");
    assert.equal(buscas[0].country, undefined);
    console.log("PASSOU: sem opções, o comportamento original é mantido.");
    console.log("Resultado: 4/4. Tavily e páginas simuladas; sem rede e sem banco.");
  } finally {
    global.fetch = fetchOriginal;
    sinaisTemporais.obterMetadadosPagina = metaOriginal;
    if (chaveOriginal === undefined) delete process.env.TAVILY_API_KEY; else process.env.TAVILY_API_KEY = chaveOriginal;
  }
}
main().catch(e => { console.error("FALHOU:", e); process.exitCode = 1; });

// Itens quebrados da Tavily não derrubam a busca inteira.
{
  const assert = require("node:assert/strict");
  const { limparResultados } = require("../src/tavily");
  const limpos = limparResultados([null, { url: "https://a.com/x", title: 42, content: null }, { title: "sem url" }, "texto"]);
  assert.equal(limpos.length, 1);
  assert.equal(limpos[0].title, "42");
  assert.equal(limpos[0].content, "");
  console.log("PASSOU: itens nulos ou malformados da Tavily são descartados ou consertados");
}

// Afirmação com valor: uma segunda busca sem o valor procura o valor de hoje.
{
  const assert = require("node:assert/strict");
  const { consultaSemValor } = require("../src/tavily");
  const d = new Date("2026-11-13T12:00:00Z");
  assert.equal(consultaSemValor("O salário mínimo atual no Brasil é de R$ 1.412.", d), "O salário mínimo atual no Brasil 2026");
  assert.equal(consultaSemValor("ChatGPT Plus costs $20 per month.", d), "ChatGPT Plus costs per month 2026");
  assert.equal(consultaSemValor("Satya Nadella is the CEO of Microsoft.", d), null, "sem valor, sem busca extra");
  console.log("PASSOU: afirmação com valor ganha uma busca sem o valor (o valor de hoje), sem gastar busca à toa");
}
