"use strict";
// Auditoria de página: validação do link, limpeza do texto extraído, leitura
// pela Tavily (fetch simulado) e exclusão da própria página das fontes.
const assert = require("node:assert/strict");
process.env.TAVILY_API_KEY = "tvly-teste";
const { validarUrlPublica, limparTextoPagina, lerPaginaParaAuditoria } = require("../src/auditoria-pagina");
const { normalizarUrlComparavel } = require("../src/verificador");
const { validarPedido } = require("../servidor");

// Links aceitos e recusados.
assert.equal(validarUrlPublica("https://help.example.com/faq#precos"), "https://help.example.com/faq");
for (const ruim of ["http://localhost:3000", "https://192.168.0.1/x", "ftp://exemplo.com", "javascript:alert(1)", "https://u:p@exemplo.com", "exemplo", "https://intranet.local/x"]) {
  assert.equal(validarUrlPublica(ruim), null, ruim);
}

// Limpeza: tira links, imagens, menus curtos e linhas repetidas.
const limpo = limparTextoPagina("Home\nLogin\n![logo](a.png)\nO plano Básico custa R$ 29,90 por mês e inclui [suporte](https://x.com) por chat.\nO plano Básico custa R$ 29,90 por mês e inclui suporte por chat.");
assert.equal(limpo, "O plano Básico custa R$ 29,90 por mês e inclui suporte por chat.");

// Pedido: um link sozinho vira auditoria de página no modo real.
const pedido = validarPedido({ texto: "https://help.example.com/precos", modo: "real" });
assert.equal(pedido.url, "https://help.example.com/precos");
assert.throws(() => validarPedido({ texto: "https://localhost/x", modo: "real" }), /public web page/);
assert.throws(() => validarPedido({ url: "https://help.example.com/x", modo: "exemplo" }), /live mode/);
// Texto comum continua igual.
assert.equal(validarPedido({ texto: "Node 20 is LTS. See https://nodejs.org", modo: "real" }).url, undefined);

// A própria página não pode servir de prova: comparação ignora www, barra final e #.
assert.equal(normalizarUrlComparavel("https://www.Example.com/faq/"), normalizarUrlComparavel("https://example.com/faq#a"));

(async () => {
  const original = global.fetch;
  let pedidoTavily = null;
  global.fetch = async (url, init) => {
    pedidoTavily = { url, corpo: JSON.parse(init.body) };
    return new Response(JSON.stringify({ results: [{ url: "https://help.example.com/precos", title: "Preços", raw_content: "Menu\nO plano Básico custa R$ 29,90 por mês e inclui suporte por chat em horário comercial.\nO plano Pro custa R$ 59,90 por mês." }], request_id: "r1" }), { status: 200 });
  };
  try {
    const pagina = await lerPaginaParaAuditoria("https://help.example.com/precos");
    assert.match(pedidoTavily.url, /api\.tavily\.com\/extract$/);
    assert.deepEqual(pedidoTavily.corpo.urls, ["https://help.example.com/precos"]);
    assert.equal(pagina.titulo, "Preços");
    assert.match(pagina.texto, /R\$ 29,90/);
    assert.equal(pagina.cortado, false);
    global.fetch = async () => new Response(JSON.stringify({ results: [{ url: "https://x.example.com", raw_content: "curto" }] }), { status: 200 });
    await assert.rejects(lerPaginaParaAuditoria("https://x.example.com"), /too little text/);
  } finally {
    global.fetch = original;
  }
  // No verificador: a página auditada some das fontes encontradas pela busca.
  const path = require("node:path");
  const Module = require("node:module");
  const ARQ = path.join(__dirname, "..", "src", "verificador.js");
  let analisadas = null;
  const simulados = {
    "./afirmacoes": { async decomporEmAfirmacoes() { return [{ id: "afirmacao_1", texto: "O plano Básico custa R$ 29,90 por mês.", categoria_sugerida: "preco" }]; } },
    "./tavily": { async pesquisarComTavily() {
      return [
        { url: "https://www.help.example.com/precos/", title: "Própria página", content: "O plano Básico custa R$ 29,90 por mês." },
        { url: "https://noticias.example.org/reajuste", title: "Reajuste", content: "O plano Básico passou a custar R$ 34,90 por mês." }
      ];
    } },
    "./analise-lote": { async analisarFontesEmLote(_a, fontes) { analisadas = fontes.map(f => f.url ?? f.fonte?.url); return []; }, citacaoExisteNoTexto: () => false }
  };
  delete require.cache[ARQ];
  const original2 = Module._load;
  Module._load = function (req, parent, isMain) {
    if (parent?.filename === ARQ && Object.hasOwn(simulados, req)) return simulados[req];
    return original2.call(this, req, parent, isMain);
  };
  let verificarTexto;
  try { verificarTexto = require(ARQ).verificarTexto; } finally { Module._load = original2; }
  const { criarBanco } = require("../src/banco");
  const banco = criarBanco({ caminho: ":memory:" });
  try {
    const r = await verificarTexto("O plano Básico custa R$ 29,90 por mês.", { banco, maxEvidencias: 3, urlsExcluidas: ["https://help.example.com/precos"] });
    const urls = r.afirmacoes[0].evidencias.map(e => e.fonte?.url ?? e.url);
    assert.ok(!urls.some(u => /help\.example\.com/.test(String(u))), `fontes: ${JSON.stringify(urls)}`);
    assert.ok(urls.some(u => /noticias\.example\.org/.test(String(u))), `fontes: ${JSON.stringify(urls)}`);
  } finally { banco.fechar(); }
  console.log("ok auditoria de página: link, limpeza, leitura pela Tavily, página excluída das provas");
})().catch(e => { console.error(e); process.exit(1); });
