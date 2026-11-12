// Índice de concordância entre fontes e veredito CORROBORADA. Sem rede e sem banco.
const assert = require("node:assert/strict");
const { agregarEvidencias } = require("./src/agregador");
let n = 0;
const caso = (nome, fn) => { fn(); n += 1; console.log(`PASSOU: ${nome}`); };

const ev = (url, postura, categoria, extra = {}) => ({
  fonte: { url, tipo_fonte: "tavily_extract", titulo: url, conteudo: `Texto exclusivo de ${url} ${Math.random()}`, categoria_fonte: categoria, data_publicacao: null, data_atualizacao: null, ...extra },
  correspondencia: { status: "MATCH" },
  classificacao: { postura, justificativa: "fixture" },
  atualidade: { status: "UNVERIFIABLE" }
});
const agregar = (lista, opcoes = {}) => agregarEvidencias({ texto: "Afirmação.", tipo_afirmacao: "empresa", evidencias: lista }, opcoes);

caso("três fontes independentes de tipos diferentes apoiando: CORROBORADA", () => {
  const r = agregar([ev("https://g1.globo.com/a", "SUPPORTS", "NOTICIA"), ev("https://pt.wikipedia.org/a", "SUPPORTS", "REFERENCIA"), ev("https://site.com.br/a", "SUPPORTS", "OUTRO")]);
  assert.equal(r.veredito, "CORROBORADA");
  assert.equal(r.concordancia.score, 100);
  assert.equal(r.concordancia.coverage, "STRONG");
});
caso("três blogs do mesmo tipo não corroboram", () => {
  const r = agregar([ev("https://a.medium.com/x", "SUPPORTS", "BLOG_FORUM"), ev("https://reddit.com/x", "SUPPORTS", "BLOG_FORUM"), ev("https://dev.to/x", "SUPPORTS", "BLOG_FORUM")]);
  assert.equal(r.veredito, "SUPORTE_FRACO");
  assert.equal(r.concordancia.coverage, "MODERATE");
});
caso("páginas do mesmo domínio contam como uma voz", () => {
  const r = agregar([ev("https://g1.globo.com/a", "SUPPORTS", "NOTICIA"), ev("https://g1.globo.com/b", "SUPPORTS", "NOTICIA"), ev("https://g1.globo.com/c", "SUPPORTS", "NOTICIA")]);
  assert.equal(r.concordancia.independent_sources, 1);
  assert.equal(r.veredito, "SUPORTE_FRACO");
});
caso("uma contradição impede CORROBORADA e baixa o índice", () => {
  const r = agregar([ev("https://g1.globo.com/a", "SUPPORTS", "NOTICIA"), ev("https://pt.wikipedia.org/a", "SUPPORTS", "REFERENCIA"), ev("https://site.com.br/a", "SUPPORTS", "OUTRO"), ev("https://reuters.com/a", "CONTRADICTS", "NOTICIA")]);
  assert.equal(r.veredito, "CONFLITO");
  assert.equal(r.concordancia.score, Math.round(100 * 5 / 7));
});
caso("pesos: um blog contra uma fonte oficial pesa pouco", () => {
  const r = agregar([ev("https://gov.br/a", "SUPPORTS", "OFICIAL"), ev("https://medium.com/a", "CONTRADICTS", "BLOG_FORUM")]);
  assert.equal(r.concordancia.score, Math.round(100 * 3 / 3.5));
});
caso("sem fontes utilizáveis o índice é null", () => {
  const r = agregar([]);
  assert.equal(r.concordancia.score, null);
  assert.equal(r.concordancia.coverage, "NONE");
});
caso("categoria ausente é deduzida pela URL", () => {
  const r = agregar([{ ...ev("https://pt.wikipedia.org/x", "SUPPORTS", undefined) }]);
  assert.equal(r.fontes[0].evidencias[0].categoria_fonte, "REFERENCIA");
});
caso("fonte oficial atual continua prevalecendo sobre a concordância", () => {
  const oficial = ev("https://gov.br/regra", "CONTRADICTS", "OFICIAL", { data_atualizacao: "2026-11-01", escopo_data: "ATTRIBUTE" });
  oficial.atualidade = { status: "FRESH" };
  const r = agregar([oficial, ev("https://g1.globo.com/a", "SUPPORTS", "NOTICIA"), ev("https://pt.wikipedia.org/a", "SUPPORTS", "REFERENCIA")], { dominiosOficiais: ["gov.br"] });
  assert.equal(r.veredito, "CONTRADITA_POR_FONTE_ATUAL");
});
caso("contradição dominante (notícia + referência contra um blog) vira CONTRADICAO_FRACA", () => {
  const r = agregar([ev("https://g1.globo.com/a", "CONTRADICTS", "NOTICIA"), ev("https://pt.wikipedia.org/a", "CONTRADICTS", "REFERENCIA"), ev("https://medium.com/a", "SUPPORTS", "BLOG_FORUM")]);
  assert.equal(r.concordancia.score, 11);
  assert.equal(r.veredito, "CONTRADICAO_FRACA");
});
caso("apoio dominante com uma contradição continua CONFLITO (não tranquiliza)", () => {
  const r = agregar([ev("https://g1.globo.com/a", "SUPPORTS", "NOTICIA"), ev("https://pt.wikipedia.org/a", "SUPPORTS", "REFERENCIA"), ev("https://medium.com/a", "CONTRADICTS", "BLOG_FORUM")]);
  assert.equal(r.veredito, "CONFLITO");
});
caso("site da própria entidade citada conta como oficial (nodejs.org, openai.com, nubank.com.br)", () => {
  const { classificarFonte: c } = require("./src/tipo-fonte");
  assert.equal(c("https://nodejs.org/en/blog/x", { afirmacao: "Node.js 20 is the current LTS." }).tipo, "OFICIAL");
  assert.equal(c("https://help.openai.com/x", { afirmacao: "ChatGPT Plus costs $20." }).tipo, "OFICIAL");
  assert.equal(c("https://nubank.com.br/tarifas", { afirmacao: "O Nubank não cobra anuidade." }).tipo, "OFICIAL");
  assert.equal(c("https://nubank.com.br/tarifas", { afirmacao: "A Selic está em 15%." }).tipo, "OUTRO", "sem a entidade na afirmação, não é oficial");
  assert.equal(c("https://g1.globo.com/openai", { afirmacao: "ChatGPT Plus costs $20." }).tipo, "NOTICIA", "veículo de notícia continua notícia");
});
console.log(`Resultado: ${n}/${n} casos de concordância passaram. Sem rede e sem banco.`);
