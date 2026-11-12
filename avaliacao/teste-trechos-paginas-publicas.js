const assert = require("node:assert/strict");
const corpus = require("./rotulos-paginas-reais-v1.json");
const { extrairSinaisTemporais } = require("../src/sinais-temporais");

let datesExpected = 0;
let datesFound = 0;
for (const caso of corpus.casos) {
  const signals = extrairSinaisTemporais({
    html: `<main><p>${caso.trecho_visivel_para_teste}</p></main>`,
    claim: caso.afirmacao,
    claimType: caso.tipo_afirmacao,
    pageUrl: caso.url
  });
  const detectedDates = signals.filter(signal => signal.value_normalized).map(signal => signal.value_normalized);
  for (const expected of caso.datas_esperadas_no_trecho) {
    datesExpected++;
    assert.ok(detectedDates.includes(expected), `${caso.id}: data esperada ${expected} não extraída`);
    datesFound++;
  }
  assert.equal(signals.some(signal => signal.scope === "ATTRIBUTE"), false,
    `${caso.id}: texto de página não deve ser promovido a data de atributo`);
  if (caso.escopo_semantico_adicional === "PRICE_OBSERVATION") {
    assert.ok(signals.some(signal => signal.signal_type === "PRICE_OBSERVATION_DATE" &&
      signal.scope === "OBSERVATION" && signal.value_normalized === "2026-11-06"));
  }
}

console.log(`PASSOU: ${corpus.casos.length} rótulos públicos; ${datesFound}/${datesExpected} datas declaradas nos trechos capturadas; nenhum trecho foi classificado como ATTRIBUTE sem vínculo explícito.`);
console.log("Nota: os testes reproduzem trechos visíveis anotados manualmente; não testam o download nem a extração do HTML real.");
