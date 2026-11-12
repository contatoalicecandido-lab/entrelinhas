// Benchmark sintético versionado. Os casos são controlados para testar regras,
// não estimam a taxa de acerto em páginas reais nem substituem anotação humana.
const assert = require("node:assert/strict");
const { agregarEvidencias } = require("../src/agregador");
const { avaliarAtualidade } = require("../src/atualidade");
const { calculateClaimFreshnessScore } = require("../src/freshness-score");

const AS_OF = new Date("2026-11-11T12:00:00.000Z");
const casos = [
  { id: "F01", eixo: "recent_attribute_support", postura: "SUPPORTS", data: "2026-11-11", escopo: "ATTRIBUTE", status: "FRESH", esperado: ["ATUAL", "FRESH", "APOIA"], dominio: "loja-oficial.example", oficial: true },
  { id: "F02", eixo: "recent_page_date_not_attribute", postura: "SUPPORTS", data: "2026-11-10", escopo: "PAGE", status: "FRESH", esperado: ["SUPORTE_FRACO", "UNVERIFIABLE", "APOIA"], dominio: "loja-oficial.example", oficial: true },
  { id: "F03", eixo: "missing_date_abstention", postura: "SUPPORTS", data: null, escopo: "UNKNOWN", status: "UNVERIFIABLE", esperado: ["SUPORTE_FRACO", "UNVERIFIABLE", "APOIA"], dominio: "loja-oficial.example", oficial: true },
  { id: "F04", eixo: "old_attribute_support", postura: "SUPPORTS", data: "2026-08-01", escopo: "ATTRIBUTE", status: "STALE", esperado: ["SUPORTE_FRACO", "STALE", "APOIA"], dominio: "loja-oficial.example", oficial: true },
  { id: "F05", eixo: "recent_attribute_contradiction", postura: "CONTRADICTS", data: "2026-11-10", escopo: "ATTRIBUTE", status: "FRESH", esperado: ["CONTRADITA_POR_FONTE_ATUAL", "FRESH", "CONTRADIZ"], dominio: "loja-oficial.example", oficial: true },
  { id: "F06", eixo: "current_cross_source_conflict", postura: "SUPPORTS", data: "2026-11-10", escopo: "ATTRIBUTE", status: "FRESH", esperado: ["CONFLITO", "MIXED", "CONFLITO"], dominio: "a.example", oficial: true, par: { postura: "CONTRADICTS", dominio: "b.example", data: "2026-11-10", status: "FRESH" } },
  { id: "F07", eixo: "invalid_date_abstention", postura: "SUPPORTS", data: "2026-02-30", escopo: "ATTRIBUTE", status: "UNVERIFIABLE", esperado: ["SUPORTE_FRACO", "UNVERIFIABLE", "APOIA"], dominio: "loja-oficial.example", oficial: true },
  { id: "F08", eixo: "future_date_abstention", postura: "SUPPORTS", data: "2026-11-12", escopo: "ATTRIBUTE", status: "UNVERIFIABLE", esperado: ["SUPORTE_FRACO", "UNVERIFIABLE", "APOIA"], dominio: "loja-oficial.example", oficial: true },
  { id: "F09", eixo: "same_domain_duplicate", postura: "SUPPORTS", data: "2026-11-11", escopo: "ATTRIBUTE", status: "FRESH", esperado: ["ATUAL", "FRESH", "APOIA"], dominio: "loja-oficial.example", oficial: true, duplicata: true },
  { id: "F10", eixo: "recent_and_old_mixed", postura: "SUPPORTS", data: "2026-11-10", escopo: "ATTRIBUTE", status: "FRESH", esperado: ["ATUAL", "MIXED", "CONFLITO"], dominio: "loja-oficial.example", oficial: true, par: { postura: "CONTRADICTS", dominio: "arquivo.example", data: "2026-07-01", status: "STALE" } },
  { id: "F11", eixo: "evidence_mismatch", postura: "SUPPORTS", data: "2026-11-11", escopo: "ATTRIBUTE", status: "FRESH", match: false, esperado: ["NAO_VERIFICAVEL", "UNVERIFIABLE", "NAO_VERIFICAVEL"], dominio: "loja-oficial.example", oficial: true },
  { id: "F12", eixo: "recent_undated_attribute_source", postura: "SUPPORTS", data: null, escopo: "PAGE", status: "UNVERIFIABLE", esperado: ["SUPORTE_FRACO", "UNVERIFIABLE", "APOIA"], dominio: "a.example", oficial: false, par: { postura: "SUPPORTS", dominio: "b.example", data: "2026-11-10", escopo: "PAGE", status: "FRESH" } },
  { id: "F13", eixo: "update_before_publication", postura: "SUPPORTS", data: "2026-11-05", atualizacao: "2026-11-04", escopo: "ATTRIBUTE", status: "UNVERIFIABLE", esperado: ["SUPORTE_FRACO", "UNVERIFIABLE", "APOIA"], dominio: "loja-oficial.example", oficial: true }
];

function evid(c, suffix = "1") {
  const fonte = {
    url: `https://${c.dominio}/${c.id.toLowerCase()}-${suffix}`,
    tipo_fonte: "tavily_extract",
    data_publicacao: c.data,
    data_atualizacao: c.atualizacao ?? null,
    escopo_data: c.escopo ?? "ATTRIBUTE",
    coletado_em: "2026-11-11T12:00:00.000Z"
  };
  return {
    fonte,
    correspondencia: { status: c.match === false ? "NO_MATCH" : "MATCH" },
    classificacao: { postura: c.postura },
    atualidade: avaliarAtualidade(fonte, "preco", AS_OF)
  };
}

const erros = [];
const matriz = new Map();
for (const caso of casos) {
  const evidencias = [evid(caso)];
  if (caso.duplicata) evidencias.push(evid({ ...caso }, "2"));
  if (caso.par) evidencias.push(evid({ ...caso, ...caso.par, escopo: caso.par.escopo ?? "ATTRIBUTE", match: true }, "par"));
  const resultado = agregarEvidencias({ texto: `Caso sintético ${caso.id}`, tipo_afirmacao: "preco", evidencias }, { dominiosOficiais: caso.oficial ? [caso.dominio] : [], asOf: AS_OF });
  const obtido = [resultado.veredito, resultado.freshness.status, resultado.conclusao_factual.status];
  const chave = `${caso.esperado[1]} -> ${obtido[1]}`;
  matriz.set(chave, (matriz.get(chave) || 0) + 1);
  if (obtido.some((valor, indice) => valor !== caso.esperado[indice])) {
    erros.push({ id: caso.id, eixo: caso.eixo, esperado: caso.esperado, obtido });
  }
  if (["F02", "F03", "F07", "F08", "F11", "F12", "F13"].includes(caso.id)) {
    assert.equal(resultado.freshness.score, null, `${caso.id}: sem score temporal confiável`);
  }
}

// Caso numérico auditável: meia-vida = 15 dias; idade = 7 dias.
const calculoNumerico = calculateClaimFreshnessScore([{
  match: true,
  postura: "SUPPORTS",
  temporalStatus: "FRESH",
  domain: "loja-oficial.example",
  publicationDate: "2026-11-04",
  updateDate: null,
  dateScope: "ATTRIBUTE",
  evidenceId: "NUM-01",
  official: true
}], { claimType: "preco", validityDays: 30, asOf: AS_OF });
assert.equal(calculoNumerico.score, 72);
assert.equal(calculoNumerico.status, "FRESH");
assert.deepEqual(erros, [], JSON.stringify(erros, null, 2));

console.log(`Benchmark rotulado sintético v1: ${casos.length}/${casos.length} casos passaram.`);
console.log("Eixos conferidos separadamente: conclusão factual, veredito operacional legado e estado temporal.");
console.log(`Caso numérico fixo executado pelo algoritmo: 7 dias / janela 30 dias => ${calculoNumerico.score}/100 (índice temporal, não probabilidade).`);
console.log("Sem data de atributo, data inválida/futura ou divergência de correspondência: score null / UNVERIFIABLE.");
console.log("Matriz atualidade esperada -> obtida:");
for (const [classe, quantidade] of matriz) console.log(`  ${classe}: ${quantidade}`);
console.log("Limite: fixtures sintéticas; não representam precisão em tráfego real nem ground truth do mundo.");
