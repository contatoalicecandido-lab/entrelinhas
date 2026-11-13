// Resposta corrigida: só evidências verificadas, citações conferidas.
// fetch simulado (Bifrost); sem rede; sem banco.
const assert = require("node:assert/strict");
process.env.BIFROST_KEY = "chave-ficticia-para-teste";
const { gerarRespostaCorrigida, montarFontesNumeradas, validarRespostaCorrigida } = require("../src/resposta-corrigida");

let n = 0;
const ok = nome => { n += 1; console.log(`PASSOU: ${nome}`); };

const ev = (url, tipo, postura, citacao, match = "MATCH") => ({
  fonte: { url, titulo: url, categoria_fonte: tipo, conteudo: citacao, data_publicacao: "2026-11-01" },
  correspondencia: { status: match },
  classificacao: { postura },
  preparacao: { citacao_chave: citacao }
});
const resultados = [
  { id: "afirmacao_1", texto: "O salário mínimo em 2026 é de R$ 1.518.", agregacao: { veredito: "CONTRADICAO_FRACA" },
    evidencias: [ev("https://blog.example/a", "BLOG_FORUM", "SUPPORTS", "R$ 1.518"), ev("https://agenciabrasil.ebc.com.br/x", "NOTICIA", "CONTRADICTS", "salário mínimo de R$ 1.621"),
      ev("https://www.gov.br/y", "OFICIAL", "CONTRADICTS", "R$ 1.621 a partir de 1º de janeiro"), ev("https://outro.example/z", "OUTRO", "IRRELEVANT", "nada", "UNRELATED")] },
  { id: "afirmacao_2", texto: "Pix é gratuito para pessoas físicas.", agregacao: { veredito: "ATUAL" },
    evidencias: [ev("https://www.bcb.gov.br/pix", "OFICIAL", "SUPPORTS", "gratuito para pessoas físicas")] }
];

async function principal() {
  // 1. Fontes numeradas: só MATCH com postura, contradições e oficiais primeiro.
  const fontes = montarFontesNumeradas(resultados);
  assert.deepEqual(fontes.map(f => [f.n, f.claim_id, f.stance, f.type]), [
    [1, "afirmacao_1", "CONTRADICTS", "OFICIAL"], [2, "afirmacao_1", "CONTRADICTS", "NOTICIA"],
    [3, "afirmacao_1", "SUPPORTS", "BLOG_FORUM"], [4, "afirmacao_2", "SUPPORTS", "OFICIAL"]]);
  ok("fontes numeradas: só posições verificadas; contradições e oficiais primeiro");

  // 2. Citação a número inexistente é removida; mudanças com id inválido também.
  const v = validarRespostaCorrigida({ answer: "Em 2026 o mínimo é R$ 1.621 [1][2][9]. O Pix é gratuito [4] .", changes: [{ claim_id: "afirmacao_1", what: "Updated value." }, { claim_id: "x", what: "?" }] }, fontes, new Set(["afirmacao_1", "afirmacao_2"]));
  assert.equal(v.texto, "Em 2026 o mínimo é R$ 1.621 [1][2]. O Pix é gratuito [4].");
  assert.deepEqual(v.fontes_citadas, [1, 2, 4]);
  assert.equal(v.mudancas.length, 1);
  ok("citações inventadas são removidas; só ids de afirmações reais");

  // 3. Chamada via Bifrost com etapa própria; pergunta leva vereditos e citações.
  const fetchOriginal = global.fetch;
  let corpo = null; let meta = null;
  global.fetch = async (_url, cfg) => {
    corpo = JSON.parse(cfg.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: "```json\n{\"answer\":\"O salário mínimo em 2026 é de R$ 1.621 [1][2]. Pix é gratuito para pessoas físicas [4].\",\"changes\":[{\"claim_id\":\"afirmacao_1\",\"what\":\"Updated the value.\"}]}\n```" } }] }), { status: 200 });
  };
  try {
    const r = await gerarRespostaCorrigida("The minimum wage is R$ 1,518 and Pix is free.", resultados, { onMetadata: m => { meta = m; }, dataReferencia: new Date("2026-11-12T00:00:00Z") });
    const pergunta = JSON.parse(corpo.messages.at(-1).content);
    assert.equal(meta.etapa, "RESPOSTA_CORRIGIDA");
    assert.equal(pergunta.reference_date, "2026-11-12");
    assert.equal(pergunta.answer_language, "English", "texto original em inglês: resposta em inglês");
    assert.deepEqual(pergunta.claims.map(c => c.verdict), ["CONTRADICTED", "SUPPORTED"]);
    assert.equal(r.texto, "O salário mínimo em 2026 é de R$ 1.621 [1][2]. Pix é gratuito para pessoas físicas [4].");
    assert.equal(r.fontes.length, 4);
    assert.equal(r.metodo, "MODEL_REWRITE_FROM_VERIFIED_EVIDENCE");
    ok("uma chamada via Bifrost, com vereditos e data de referência; resposta validada");
  } finally {
    global.fetch = fetchOriginal;
  }
  // 4. Sem citações na 1ª resposta: nova tentativa; se ainda faltar, anexa.
  {
    const fetchOriginal2 = global.fetch;
    const respostas = [
      "{\"answer\":\"O mínimo é R$ 1.621. Pix é gratuito.\",\"changes\":[]}",
      "{\"answer\":\"O mínimo é R$ 1.621 [1]. Pix é gratuito.\",\"changes\":[]}"
    ];
    let chamadas = 0; let segunda = null;
    global.fetch = async (_u, cfg) => {
      if (chamadas === 1) segunda = JSON.parse(cfg.body).messages.at(-1).content;
      return new Response(JSON.stringify({ choices: [{ message: { content: respostas[chamadas++] } }] }), { status: 200 });
    };
    try {
      const r = await gerarRespostaCorrigida("t", resultados, {});
      assert.equal(chamadas, 2);
      assert.match(segunda, /missing source citations for: afirmacao_1 \(use \[1\]\[2\]\[3\]\); afirmacao_2 \(use \[4\]\)/);
      assert.equal(r.tentativas, 2);
      assert.equal(r.citacoes_anexadas, true);
      assert.equal(r.texto, "O mínimo é R$ 1.621 [1]. Pix é gratuito. [4]");
      assert.deepEqual(r.fontes_citadas, [1, 4]);
      ok("faltou citação: pede de novo dizendo o que faltou; se ainda faltar, anexa");
    } finally { global.fetch = fetchOriginal2; }
  }
  {
    // O registro de mudanças nunca diz "kept" para uma afirmação contradita.
    const fetchOriginal3 = global.fetch;
    global.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content:
      "{\"answer\":\"O mínimo é R$ 1.621 [1]. Pix é gratuito [4].\",\"changes\":[{\"claim_id\":\"afirmacao_1\",\"what\":\"kept\"},{\"claim_id\":\"afirmacao_2\",\"what\":\"kept\"}]}" } }] }), { status: 200 });
    try {
      const r = await gerarRespostaCorrigida("t", resultados, {});
      const porId = Object.fromEntries(r.mudancas.map(m => [m.claim_id, m.what]));
      const verdicts = Object.fromEntries(resultados.map(x => [x.id, x.agregacao?.veredito]));
      for (const [id, what] of Object.entries(porId)) {
        const contradita = ["CONTRADICAO_FRACA", "CONTRADITA_POR_FONTE_ATUAL"].includes(verdicts[id]);
        if (contradita) assert.notEqual(what, "kept", `${id} é contradita: não pode ficar como kept`);
      }
      ok("registro de mudanças: afirmação contradita nunca aparece como kept");
    } finally { global.fetch = fetchOriginal3; }
  }
  console.log(`\n${n} testes passaram.`);
}
principal().catch(e => { console.error(e); process.exit(1); });
