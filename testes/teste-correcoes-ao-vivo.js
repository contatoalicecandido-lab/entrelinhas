// Regressões encontradas no teste ao vivo de 12/11/2026 (vacina da dengue no SUS).
// Funções puras; sem rede, sem banco.
const assert = require("node:assert/strict");
const { validarDataDoFato } = require("../src/analise-lote");
const { ehResultadoUtil } = require("../src/tavily");
const { inferirTipoPorRegras } = require("../src/tipo-afirmacao");

let n = 0;
const ok = nome => { n += 1; console.log(`PASSOU: ${nome}`); };
const ref = new Date("2026-11-12T12:00:00Z");

// 1. Número de documento não é data do fato.
{
  const texto = "NOTA TÉCNICA Nº 15/2026-CGFAM/DPNI/SVSA/MS. Prevenção de dengue em indivíduos de 10 a 14 anos.";
  assert.equal(validarDataDoFato({ date: "2026-01-01", quote: "NOTA TÉCNICA Nº 15/2026-CGFAM/DPNI/SVSA/MS" }, texto, ref), null);
  ok("'Nota Técnica nº 15/2026' não vira 1º de janeiro de 2026");
}

// 2. Precisão honesta: ano, mês ou dia conforme o que a citação mostra.
{
  const texto = "Em 2026 a regra mudou. A partir de março de 2026 o valor subiu. Desde 03/04/2026 vale a nova tabela.";
  assert.deepEqual(validarDataDoFato({ date: "2026-01-01", quote: "Em 2026 a regra mudou" }, texto, ref),
    { data: "2026-01-01", precisao: "ANO", citacao: "Em 2026 a regra mudou" });
  assert.equal(validarDataDoFato({ date: "2026-03-15", quote: "A partir de março de 2026 o valor subiu" }, texto, ref).precisao, "MES");
  assert.equal(validarDataDoFato({ date: "2026-03-15", quote: "A partir de março de 2026 o valor subiu" }, texto, ref).data, "2026-03-01");
  assert.equal(validarDataDoFato({ date: "2026-04-03", quote: "Desde 03/04/2026 vale a nova tabela" }, texto, ref).precisao, "DIA");
  ok("precisão da data do fato segue o que a citação realmente mostra");
}

// 3. Fichas internas da Tavily e resultados quase irrelevantes ficam de fora.
{
  assert.equal(ehResultadoUtil({ url: "https://tavily.com/knowledge/company/abc", score: 0.9 }), false);
  assert.equal(ehResultadoUtil({ url: "https://www.jb.com.br/noticia.html", score: 0.0067 }), false);
  assert.equal(ehResultadoUtil({ url: "https://www.jb.com.br/noticia.html", score: 0.82 }), true);
  assert.equal(ehResultadoUtil({ url: "https://www.gov.br/saude", score: undefined }), true);
  ok("resultados sem conteúdo (tavily.com/knowledge, relevância < 0,05) são descartados");
}

// 4. Políticas públicas de saúde têm janela temporal de regulamento.
{
  assert.equal(inferirTipoPorRegras("A vacina da dengue Qdenga é aplicada pelo SUS apenas em crianças de 10 a 14 anos."), "regulamento");
  assert.equal(inferirTipoPorRegras("Ozempic is FDA-approved for weight loss."), "regulamento");
  assert.equal(inferirTipoPorRegras("O plano Premium custa R$ 99,90."), "preco");
  ok("SUS, Anvisa, FDA e elegibilidade são tratados como regulamento");
}

// 5. Teste ao vivo do iPhone: menu e imagens no começo da página escondiam o
//    preço. A seleção limpa o ruído e acha o trecho com o valor.
{
  const { selecionarTrechosParaLimite, limparRuidoPagina } = require("../src/preparar-evidencia");
  const pagina = "[Hoje](https://www.estadao.com.br/ \"H\")\n![](https://img.example/x.png)\n* [Política](https://x.example)\n* [Economia](https://y.example)\n" +
    "Texto genérico sobre tecnologia e mercado. ".repeat(80) +
    "\nO iPhone 17 Pro custa R$ 11.499 no Brasil na versão de 256 GB, segundo a Apple.\n" +
    "Outro parágrafo qualquer sem relação. ".repeat(60);
  const limpo = limparRuidoPagina(pagina);
  assert.ok(!/https?:|!\[|\]\(/.test(limpo), "sem links nem imagens");
  const sel = selecionarTrechosParaLimite("O iPhone 17 Pro tá saindo por uns 9 pau no Brasil. O iPhone 17 Pro tá saindo por uns R$ 9 mil no Brasil.", pagina, 600);
  assert.ok(sel.length <= 600);
  assert.ok(sel.includes("O iPhone 17 Pro custa R$ 11.499 no Brasil"));
  ok("página com menu no topo: o trecho com o preço chega ao modelo");
}

console.log(`\n${n} testes passaram.`);

// 6. Gravação ao vivo: resposta em inglês virou afirmações em português.
//    A decomposição agora recebe o idioma do texto e a regra de não traduzir.
(async () => {
  process.env.BIFROST_KEY = "chave-ficticia-para-teste";
  const fetchOriginal = global.fetch;
  let corpo = null;
  global.fetch = async (_u, cfg) => {
    corpo = JSON.parse(cfg.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: "{\"afirmacoes\":[{\"texto\":\"Node.js 20 is the current LTS release.\",\"categoria\":\"versao_api\"}]}" } }] }), { status: 200 });
  };
  try {
    const { decomporEmAfirmacoes } = require("../src/afirmacoes");
    await decomporEmAfirmacoes("Node.js 20 is the current LTS release and the recommended version for production.");
    const pergunta = JSON.parse(corpo.messages.at(-1).content);
    assert.equal(pergunta.idioma_do_texto, "inglês (English)");
    assert.match(corpo.messages[0].content, /NO MESMO IDIOMA/);
    console.log("PASSOU: decomposição recebe o idioma do texto e a regra de nunca traduzir");
  } finally {
    global.fetch = fetchOriginal;
  }
})().catch(e => { console.error("FALHOU:", e); process.exit(1); });
