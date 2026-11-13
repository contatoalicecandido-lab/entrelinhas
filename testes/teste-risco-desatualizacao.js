// Sinalização de risco de desatualização (requisito 2). Regras puras.
const assert = require("node:assert/strict");
const { avaliarRiscoDesatualizacao } = require("../src/risco-desatualizacao");
const { analisarNuances } = require("../src/portugues");
let n = 0;
const ok = nome => { n += 1; console.log(`PASSOU: ${nome}`); };
const ref = new Date("2026-11-12T12:00:00Z");

{
  const r = avaliarRiscoDesatualizacao({ texto: "ChatGPT Plus costs $20 per month.", tipo: "preco", dataReferencia: ref });
  assert.equal(r.nivel, "HIGH"); assert.equal(r.sensivel_ao_tempo, true); assert.match(r.motivos[0], /30-day window/);
  ok("preço: risco alto, com a janela de 30 dias como motivo");
}
{
  const texto = "A taxa Selic está atualmente em 10,5% ao ano.";
  const r = avaliarRiscoDesatualizacao({ texto, tipo: "regulamento", nuances: analisarNuances(texto, { dataReferencia: ref }), dataReferencia: ref });
  assert.equal(r.nivel, "HIGH"); assert.ok(r.motivos.some(m => /right now/.test(m)));
  ok("'atualmente' sobe o risco de uma regra oficial para alto");
}
{
  const r = avaliarRiscoDesatualizacao({ texto: "Node.js 20 is in Active LTS until 2025.", tipo: "versao_api", dataReferencia: ref });
  assert.ok(r.motivos.some(m => /2025/.test(m)));
  ok("ano no passado vira motivo explícito");
}
{
  const r = avaliarRiscoDesatualizacao({ texto: "Water boils at 100 °C at sea level.", tipo: null, dataReferencia: ref });
  assert.equal(r.nivel, "LOW"); assert.equal(r.sensivel_ao_tempo, false);
  const r2 = avaliarRiscoDesatualizacao({ texto: "The tallest building is currently the Burj Khalifa.", tipo: null, dataReferencia: ref });
  assert.equal(r2.nivel, "MEDIUM");
  ok("sem categoria: risco baixo, a menos que afirme valer 'agora'");
}
console.log(`\n${n} testes passaram.`);

// Janelas por entidade: Selic e inflação mudam mais rápido que "regras" (365 d).
{
  const assert = require("node:assert/strict");
  const { janelaDeValidade, avaliarAtualidade } = require("../src/atualidade");
  const { avaliarRiscoDesatualizacao } = require("../src/risco-desatualizacao");
  const selic = janelaDeValidade("regulamento", "A taxa Selic está atualmente em 10,5% ao ano.");
  assert.equal(selic.dias, 45); assert.equal(selic.origem, "ENTITY");
  assert.equal(janelaDeValidade("regulamento", "O IPCA de outubro foi 0,4%.").dias, 30);
  assert.equal(janelaDeValidade("regulamento", "A LGPD está em vigor desde 2020.").dias, 365);
  assert.equal(janelaDeValidade(null, "Texto qualquer"), null);
  const risco = avaliarRiscoDesatualizacao({ texto: "A Selic está em 15%.", tipo: "regulamento", janela: selic });
  assert.equal(risco.nivel, "HIGH");
  assert.ok(risco.motivos.some(m => /45-day window/.test(m) && /Copom/.test(m)));
  // Página de 100 dias: dentro da janela de regras (365), fora da janela da Selic (45).
  const fonte = { tipo_fonte: "tavily_search", data_publicacao: "2026-08-05" };
  const ref = new Date("2026-11-13T12:00:00Z");
  assert.equal(avaliarAtualidade(fonte, "regulamento", ref).status, "FRESH");
  assert.equal(avaliarAtualidade(fonte, "regulamento", ref, selic.dias).status, "STALE");
  console.log("PASSOU: Selic e inflação têm janela própria (45 e 30 dias), com motivo na triagem");
}
