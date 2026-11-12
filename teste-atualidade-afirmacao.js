// Nota de atualidade da afirmação = recência das evidências × parcela de apoio.
// Funções puras; sem rede, sem banco.
const assert = require("node:assert/strict");
const { calcularAtualidadeAfirmacao } = require("./src/atualidade-afirmacao");

let n = 0;
const ok = nome => { n += 1; console.log(`PASSOU: ${nome}`); };
const conc = (score, sup, con, cobertura = "STRONG") => ({ score, supporting: sup, contradicting: con, split: 0, independent_sources: sup + con, coverage: cobertura });

// 1. Confirmada por fontes recentes, com data do fato → atual, confiança alta.
{
  const r = calcularAtualidadeAfirmacao({
    freshness: { score: 90, confidence: "ADEQUATE", drivers: [{ date: "2026-11-01" }, { date: "2026-10-20" }] },
    concordancia: conc(100, 3, 0), janelaDias: 30
  });
  assert.equal(r.score, 90); assert.equal(r.status, "CURRENT"); assert.equal(r.basis, "FACT_DATE");
  assert.equal(r.confidence, "HIGH"); assert.equal(r.newest_date, "2026-11-01");
  ok("confirmada por fontes recentes: nota alta, 'Current', confiança alta");
}

// 2. Contradita por fontes atuais → nota baixa, 'Outdated'.
{
  const r = calcularAtualidadeAfirmacao({
    freshness: { score: 95, confidence: "LIMITED", drivers: [] },
    concordancia: conc(0, 0, 2), janelaDias: 90
  });
  assert.equal(r.score, 0); assert.equal(r.status, "CONTRADICTED"); assert.equal(r.confidence, "MEDIUM");
  ok("contradita por fontes atuais: nota 0, 'Outdated'");
}

// 3. Sem data do fato: usa a data da página, confiança baixa.
{
  const r = calcularAtualidadeAfirmacao({
    freshness: { score: null }, recenciaPagina: { score: 40, newest_date: "2026-06-01" },
    concordancia: conc(100, 2, 0, "MODERATE"), janelaDias: 30
  });
  assert.equal(r.score, 40); assert.equal(r.status, "AGING"); assert.equal(r.basis, "PAGE_DATE"); assert.equal(r.confidence, "LOW");
  ok("só datas de página: nota existe, 'Aging', confiança baixa");
}

// 4. Sem categoria: janela geral de 180 dias.
{
  const r = calcularAtualidadeAfirmacao({
    freshness: { score: null }, recenciaPagina: { score: null }, recenciaGeral: { score: 70, newest_date: "2026-09-01" },
    concordancia: conc(60, 2, 1), janelaDias: null
  });
  assert.equal(r.score, 42); assert.equal(r.basis, "PAGE_DATE_GENERAL_WINDOW"); assert.equal(r.window_days, 180);
  assert.equal(r.status, "UNCERTAIN");
  ok("sem categoria temporal: janela geral de 180 dias, nota existe");
}

// 5. Sem posição ou sem data: não inventa número.
{
  assert.equal(calcularAtualidadeAfirmacao({ freshness: { score: 80 }, concordancia: conc(null, 0, 0) }).reason, "NO_SOURCE_TOOK_A_POSITION");
  const r = calcularAtualidadeAfirmacao({ freshness: { score: null }, recenciaPagina: { score: null }, concordancia: conc(100, 1, 0) });
  assert.equal(r.score, null); assert.equal(r.reason, "NO_SOURCE_DATE");
  ok("sem fonte que se posicione ou sem nenhuma data: sem número inventado");
}

// 6. Integração com o agregador: afirmação de preço contradita por duas
//    fontes atuais recebe nota baixa; a mesma afirmação sem categoria usa a
//    janela geral e ainda assim recebe nota.
{
  const { agregarEvidencias } = require("./src/agregador");
  const ev = (url, postura, data) => ({
    fonte: { titulo: "Fonte", url, tipo_fonte: "tavily_extract", data_publicacao: null, data_atualizacao: data, escopo_data: "ATTRIBUTE" },
    correspondencia: { status: "MATCH" },
    classificacao: { postura, justificativa: "teste" },
    atualidade: { status: "FRESH" }
  });
  const asOf = new Date("2026-11-12T12:00:00Z");
  const evidencias = [ev("https://g1.globo.com/a", "CONTRADICTS", "2026-11-05"), ev("https://www.gov.br/b", "CONTRADICTS", "2026-11-01")];
  const r1 = agregarEvidencias({ texto: "O plano custa R$ 20.", tipo_afirmacao: "preco", evidencias }, { asOf });
  assert.equal(r1.atualidade_afirmacao.status, "CONTRADICTED");
  assert.equal(r1.atualidade_afirmacao.score, 0);
  const r2 = agregarEvidencias({ texto: "Fato qualquer.", evidencias: [ev("https://g1.globo.com/a", "SUPPORTS", "2026-11-05")] }, { asOf });
  assert.equal(r2.atualidade_afirmacao.basis, "PAGE_DATE_GENERAL_WINDOW");
  assert.ok(r2.atualidade_afirmacao.score > 90, `nota ${r2.atualidade_afirmacao.score}`);
  ok("agregador: nota baixa quando contradita; janela geral quando sem categoria");
}

console.log(`\n${n} testes passaram.`);
