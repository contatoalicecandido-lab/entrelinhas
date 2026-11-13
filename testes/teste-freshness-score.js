const assert = require("node:assert/strict");
const { calculateClaimFreshnessScore } = require("../src/freshness-score");
const { agregarEvidencias } = require("../src/agregador");

const AS_OF = new Date("2026-11-11T12:00:00.000Z");
function e(overrides = {}) {
  const { posture, ...rest } = overrides;
  return {
    match: true, postura: "SUPPORTS", temporalStatus: "FRESH",
    domain: "shop.example", publicationDate: "2026-11-10", updateDate: null,
    dateScope: "ATTRIBUTE", evidenceId: "e1", official: true,
    ...rest,
    ...(posture ? { postura: posture } : {})
  };
}
function calc(list, validityDays = 30) {
  return calculateClaimFreshnessScore(list, { claimType: "preco", validityDays, asOf: AS_OF });
}

let count = 0;
function test(name, fn) { fn(); count++; console.log(`OK ${count}: ${name}`); }

test("data recente ligada ao atributo produz índice alto e versionado", () => {
  const result = calc([e()]);
  assert.equal(result.status, "FRESH");
  assert.ok(result.score >= 90 && result.score <= 100);
  assert.equal(result.algorithm_version, "1.1.0");
});

test("sem data de atributo a saída é indeterminável, não score zero ou estimado", () => {
  const result = calc([e({ dateScope: "PAGE" })]);
  assert.equal(result.score, null);
  assert.equal(result.status, "UNVERIFIABLE");
});

test("data ausente permanece indeterminável mesmo que a coleta seja recente", () => {
  const result = calc([e({ publicationDate: null })]);
  assert.equal(result.score, null);
});

test("data inválida, futura ou com atualização anterior é excluída", () => {
  for (const item of [
    e({ publicationDate: "2026-02-30" }),
    e({ publicationDate: "2026-11-12" }),
    e({ publicationDate: "2026-11-10", updateDate: "2026-11-01" })
  ]) assert.equal(calc([item]).score, null);
});

test("evidência antiga recebe score temporal baixo e status stale", () => {
  const result = calc([e({ publicationDate: "2026-08-01", temporalStatus: "STALE" })]);
  assert.equal(result.status, "STALE");
  assert.ok(result.score < 25);
});

test("o algoritmo não confia em rótulo FRESH incompatível com a data e a política", () => {
  const result = calc([e({ publicationDate: "2026-10-01", temporalStatus: "FRESH" })]);
  assert.equal(result.status, "STALE");
  assert.ok(result.score < 25);
});

test("evidências contraditórias continuam atuais, mas resultado fica mixed", () => {
  const result = calc([
    e({ domain: "a.example" }),
    e({ domain: "b.example", posture: "CONTRADICTS", evidenceId: "e2" })
  ]);
  assert.equal(result.status, "MIXED");
  assert.ok(result.score >= 90);
  assert.equal(result.confidence, "LIMITED");
});

test("várias URLs do mesmo domínio não inflacionam fontes independentes", () => {
  const result = calc([e(), e({ evidenceId: "e2", publicationDate: "2026-11-09" })]);
  assert.equal(result.evidence_summary.eligible, 2);
  assert.equal(result.evidence_summary.independent_domains, 1);
});

test("não compara um score de atualidade com score de qualidade da evidência", () => {
  const aggregation = agregarEvidencias({
    texto: "O produto custa R$ 50.", tipo_afirmacao: "preco",
    evidencias: [{
      fonte: { url: "https://shop.example/price", tipo_fonte: "tavily_extract", data_publicacao: "2026-11-10", escopo_data: "ATTRIBUTE" },
      correspondencia: { status: "MATCH" },
      classificacao: { postura: "SUPPORTS" },
      atualidade: { status: "FRESH" }
    }]
  }, { asOf: AS_OF });
  assert.ok(aggregation.freshness);
  assert.ok(aggregation.score_qualidade_evidencia);
  assert.notEqual(aggregation.freshness, aggregation.score_qualidade_evidencia);
});

test("tipo de afirmação sem janela definida não recebe validade inventada", () => {
  const aggregation = agregarEvidencias({
    texto: "Uma afirmação de categoria ainda não suportada.",
    evidencias: [{
      fonte: { url: "https://example.org/item", tipo_fonte: "tavily_extract", data_publicacao: "2026-11-10", escopo_data: "ATTRIBUTE" },
      correspondencia: { status: "MATCH" },
      classificacao: { postura: "SUPPORTS" },
      atualidade: { status: "FRESH" }
    }]
  }, { asOf: AS_OF });
  assert.equal(aggregation.freshness.score, null);
  assert.equal(aggregation.freshness.status, "UNVERIFIABLE");
  assert.equal(aggregation.freshness.drivers[0].code, "UNKNOWN_CLAIM_TYPE");
});

console.log(`\n${count}/${count} testes de freshness score passaram.`);
