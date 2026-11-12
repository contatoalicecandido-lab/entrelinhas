// Indicador secundário de recência pela data da página (confiança baixa).
// Sem rede e sem banco.
const assert = require("node:assert/strict");
const { calculatePageDateRecency, calculateClaimFreshnessScore } = require("./src/freshness-score");
const { agregarEvidencias } = require("./src/agregador");

const AS_OF = new Date("2026-11-12T12:00:00Z");
let total = 0;
function caso(nome, fn) { fn(); total += 1; console.log(`PASSOU: ${nome}`); }

function ev(data, postura = "SUPPORTS", dominio = "a.example", grupo) {
  return { match: true, postura, domain: dominio, dependencyGroup: grupo ?? dominio,
    publicationDate: data, updateDate: null, evidenceId: `${dominio}-${data}` };
}

caso("data de página com 7 dias num preço vale 72, confiança LOW", () => {
  const r = calculatePageDateRecency([ev("2026-11-05")], { claimType: "preco", validityDays: 30, asOf: AS_OF });
  assert.equal(r.score, 72);
  assert.equal(r.status, "FRESH");
  assert.equal(r.confidence, "LOW");
  assert.equal(r.basis, "PAGE_DATE");
  assert.equal(r.newest_date, "2026-11-05");
});
caso("datas antigas resultam em STALE e índice baixo", () => {
  const r = calculatePageDateRecency([ev("2023-10-24")], { claimType: "versao_api", validityDays: 90, asOf: AS_OF });
  assert.equal(r.status, "STALE");
  assert.ok(r.score <= 1);
});
caso("sem datas não inventa número", () => {
  const r = calculatePageDateRecency([ev(null)], { claimType: "preco", validityDays: 30, asOf: AS_OF });
  assert.equal(r.score, null);
});
caso("data futura ou inválida é excluída", () => {
  const r = calculatePageDateRecency([ev("2027-01-01"), ev("2026-02-30", "SUPPORTS", "b.example")], { claimType: "preco", validityDays: 30, asOf: AS_OF });
  assert.equal(r.score, null);
});
caso("sem categoria temporal não há índice", () => {
  const r = calculatePageDateRecency([ev("2026-11-05")], { claimType: "unknown", validityDays: null, asOf: AS_OF });
  assert.equal(r.score, null);
});
caso("cópias do mesmo grupo de dependência contam uma vez", () => {
  const r = calculatePageDateRecency([ev("2026-11-05", "SUPPORTS", "a.example", "g1"), ev("2026-11-05", "SUPPORTS", "b.example", "g1")],
    { claimType: "preco", validityDays: 30, asOf: AS_OF });
  assert.equal(r.sources.length, 1);
});
caso("o índice principal continua null com datas só de página", () => {
  const principal = calculateClaimFreshnessScore([{ ...ev("2026-11-05"), temporalStatus: "FRESH", dateScope: "PAGE" }],
    { claimType: "preco", validityDays: 30, asOf: AS_OF });
  assert.equal(principal.score, null);
});
caso("agregador devolve os dois indicadores separados", () => {
  const resultado = agregarEvidencias({
    texto: "O plano custa R$ 10.",
    tipo_afirmacao: "preco",
    evidencias: [{
      fonte: { url: "https://loja.example/plano", tipo_fonte: "tavily_extract", data_publicacao: "2026-11-05", data_atualizacao: null, escopo_data: "PAGE" },
      correspondencia: { status: "MATCH" },
      classificacao: { postura: "SUPPORTS", justificativa: "fixture" },
      atualidade: { status: "FRESH" }
    }]
  }, { asOf: AS_OF });
  assert.equal(resultado.freshness.score, null);
  assert.equal(resultado.recencia_pagina.score, 72);
  assert.equal(resultado.recencia_pagina.confidence, "LOW");
});

console.log(`Resultado: ${total}/${total} casos de recência por data da página passaram. Sem rede e sem banco.`);
