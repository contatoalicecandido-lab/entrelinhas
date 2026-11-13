// Regras endurecidas depois do painel final de 13/11/2026 (regras 1.4.0).
// Tudo simulado; sem rede.
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const { classificarFonte } = require("../src/tipo-fonte");
const { agregarEvidencias } = require("../src/agregador");
const { montarFontesNumeradas, INSTRUCOES } = require("../src/resposta-corrigida");

let n = 0;
const ok = nome => { n += 1; console.log(`PASSOU: ${nome}`); };

// 1. Sites que imitam governo ou a empresa não ganham peso de fonte oficial.
{
  const tipo = (url, texto) => classificarFonte(url, { afirmacao: texto }).tipo;
  assert.notEqual(tipo("https://receita.gov.example.com/selic"), "OFICIAL", ".gov. no meio do nome");
  assert.notEqual(tipo("https://bcb.gov.br.noticias-falsas.com/selic"), "OFICIAL", "gov.br no meio do nome");
  assert.equal(tipo("https://www.bcb.gov.br/controleinflacao/taxaselic"), "OFICIAL");
  assert.equal(tipo("https://www.gov.br/trabalho"), "OFICIAL");
  for (const falso of ["https://netflix.blog.br/precos", "https://netflix.tech/precos", "https://netflix.com.br.info/precos"]) {
    assert.notEqual(tipo(falso, "O plano da Netflix custa R$ 20,90"), "OFICIAL", falso);
  }
  assert.equal(tipo("https://help.netflix.com/pt/node/24926", "O plano da Netflix custa R$ 20,90"), "OFICIAL");
  assert.notEqual(tipo("https://www.researchgate.net/publication/1"), "ACADEMICO", "repositório aberto a qualquer um");
  ok("domínios que imitam governo ou a empresa não contam como oficiais");
}

// 2. Vereditos: força de cada voz.
function ev(url, postura, categoria) {
  return {
    fonte: { titulo: "F", url, tipo_fonte: "tavily_extract", data_publicacao: null, data_atualizacao: null, escopo_data: "ATTRIBUTE", categoria_fonte: categoria },
    categoria_fonte: categoria,
    correspondencia: { status: "MATCH" },
    classificacao: { postura, justificativa: "teste" },
    atualidade: { status: "UNVERIFIABLE" }
  };
}
const af = evidencias => ({ texto: "Afirmação de teste.", evidencias });
{
  // Três sites comuns concordam, uma notícia discorda: não pode ser verde.
  const r = agregarEvidencias(af([
    ev("https://a.com/x", "SUPPORTS", "OUTRO"), ev("https://b.com/x", "SUPPORTS", "OUTRO"),
    ev("https://c.com/x", "SUPPORTS", "OUTRO"), ev("https://jornal.com/2026/11/x", "CONTRADICTS", "NOTICIA")
  ]));
  assert.equal(r.veredito, "CONFLITO", "uma voz forte contra vira conflito");
  ok("uma fonte forte contra impede o verde (vira conflito)");
}
{
  // Cinco blogs e sites comuns a favor, sem nenhuma voz forte: não é "corroborada".
  const r = agregarEvidencias(af([
    ev("https://a.com/x", "SUPPORTS", "OUTRO"), ev("https://b.com/x", "SUPPORTS", "OUTRO"),
    ev("https://c.com/x", "SUPPORTS", "OUTRO"), ev("https://d.com/x", "SUPPORTS", "REFERENCIA")
  ]));
  assert.notEqual(r.veredito, "CORROBORADA");
  const forte = agregarEvidencias(af([
    ev("https://a.com/x", "SUPPORTS", "OUTRO"), ev("https://jornal.com/2026/11/x", "SUPPORTS", "NOTICIA"),
    ev("https://www.gov.br/x", "SUPPORTS", "OFICIAL")
  ]));
  assert.equal(forte.veredito, "CORROBORADA", "com notícia e governo a favor, é corroborada");
  assert.equal(forte.concordancia.strong_supporting, 2);
  ok("'corroborada' exige pelo menos uma voz forte (oficial, científica ou notícia)");
}
{
  const fraca = agregarEvidencias(af([ev("https://blog.com/x", "CONTRADICTS", "BLOG_FORUM")]));
  assert.equal(fraca.veredito, "NAO_VERIFICAVEL", "um blog contra não pinta de vermelho");
  ok("contradição com peso menor que 2 fica 'não verificável'");
}

// 3. Resposta corrigida: fonte sem citação conferida não fornece números.
{
  const r = [{ id: "afirmacao_1", evidencias: [
    { ...ev("https://a.com/x", "SUPPORTS", "OUTRO"), preparacao: { citacao_chave: null } },
    { ...ev("https://www.gov.br/x", "SUPPORTS", "OFICIAL"), preparacao: { citacao_chave: "o salário mínimo passa a R$ 1.621" } }
  ] }];
  const fontes = montarFontesNumeradas(r);
  assert.equal(fontes[0].quote_verified, true, "fonte com citação conferida vem primeiro");
  assert.equal(fontes[0].quote, "o salário mínimo passa a R$ 1.621");
  assert.equal(fontes[1].quote_verified, false);
  assert.equal(fontes[1].quote, "", "sem citação conferida não há trecho do começo da página");
  assert.match(INSTRUCOES, /quote_verified/);
  ok("resposta corrigida: números e datas só de citações conferidas");
}

// 4. Selic em português: a busca inclui o Banco Central (bcb.gov.br).
async function buscaNasAutoridades() {
  const ARQ = path.join(__dirname, "..", "src", "verificador.js");
  let dominiosBuscados = null;
  const simulados = {
    "./afirmacoes": { async decomporEmAfirmacoes() { return [{ id: "afirmacao_1", texto: "A Selic está em 15% ao ano.", categoria_sugerida: "taxa" }]; } },
    "./tavily": { async pesquisarComTavily(_t, opcoes) { dominiosBuscados = opcoes.dominiosOficiais; return []; } }
  };
  delete require.cache[ARQ];
  const original = Module._load;
  Module._load = function (req, parent, isMain) {
    if (parent?.filename === ARQ && Object.hasOwn(simulados, req)) return simulados[req];
    return original.call(this, req, parent, isMain);
  };
  let verificarTexto;
  try { verificarTexto = require(ARQ).verificarTexto; } finally { Module._load = original; }
  const { criarBanco } = require("../src/banco");
  const banco = criarBanco({ caminho: ":memory:" });
  try {
    await verificarTexto("A Selic está em 15% ao ano.", { banco, analiseEmLote: true, paisAutomatico: true, maxEvidencias: 3, dataReferencia: new Date("2026-11-13T12:00:00Z") });
    assert.ok(Array.isArray(dominiosBuscados) && dominiosBuscados.includes("bcb.gov.br"), `buscou em: ${JSON.stringify(dominiosBuscados)}`);
    ok("afirmação sobre a Selic busca também no site do Banco Central");
  } finally { banco.fechar(); }
}

buscaNasAutoridades()
  .then(() => console.log(`Resultado: ${n}/${n}. Sem rede.`))
  .catch(e => { console.error("FALHOU:", e); process.exitCode = 1; });
