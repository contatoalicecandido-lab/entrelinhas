// Nuances do português: números, moedas, qualificadores, datas e idioma.
// Determinístico; sem rede e sem banco.
const assert = require("node:assert/strict");
const p = require("./src/portugues");
let n = 0;
const caso = (nome, fn) => { fn(); n += 1; console.log(`PASSOU: ${nome}`); };

caso("R$ 1.234,56 é mil duzentos e trinta e quatro reais", () => {
  const [v] = p.extrairValores("Custa R$ 1.234,56.");
  assert.equal(v.valor, 1234.56); assert.equal(v.moeda, "BRL");
});
caso("R$ 49,90/mês é mensal", () => {
  const [v] = p.extrairValores("Plano por R$ 49,90/mês");
  assert.equal(v.valor, 49.9); assert.equal(v.periodo, "MENSAL");
});
caso("$1,234.56 em inglês usa o formato americano", () => {
  const [v] = p.extrairValores("It costs $1,234.56 per year");
  assert.equal(v.valor, 1234.56); assert.equal(v.moeda, "USD"); assert.equal(v.periodo, "ANUAL");
});
caso("R$ 2,5 bi vira 2,5 bilhões", () => {
  assert.equal(p.extrairValores("faturou R$ 2,5 bi")[0].valor, 2.5e9);
});
caso("'a partir de' marca preço mínimo", () => {
  assert.equal(p.extrairValores("a partir de R$ 44,90")[0].qualificador.tipo, "MINIMO");
});
caso("'até 50%' marca limite superior", () => {
  assert.equal(p.extrairValores("até 50% de desconto")[0].qualificador.tipo, "MAXIMO");
});
caso("'cerca de' marca valor aproximado", () => {
  assert.equal(p.extrairValores("cerca de 30% a mais")[0].qualificador.tipo, "APROXIMADO");
});
caso("preço mínimo é compatível com valor maior", () => {
  const r = p.compararValores(p.extrairValores("a partir de R$ 44,90")[0], p.extrairValores("Padrão: R$ 59,90"));
  assert.equal(r.status, "COMPATIVEL");
});
caso("preço exato diferente é incompatível", () => {
  const r = p.compararValores(p.extrairValores("custa R$ 44,90")[0], p.extrairValores("Padrão: R$ 59,90"));
  assert.equal(r.status, "INCOMPATIVEL");
});
caso("'até R$ 100' é incompatível com R$ 120", () => {
  const r = p.compararValores(p.extrairValores("até R$ 100")[0], p.extrairValores("custa R$ 120"));
  assert.equal(r.status, "INCOMPATIVEL");
});
caso("moedas diferentes não são comparadas", () => {
  const r = p.compararValores(p.extrairValores("custa R$ 20")[0], p.extrairValores("costs $20"));
  assert.equal(r.status, "SEM_VALOR");
});
caso("data por extenso em português", () => {
  assert.equal(p.extrairDatasPt("em vigor desde 18 de setembro de 2020")[0].data, "2020-09-18");
});
caso("1º de janeiro de 2025", () => {
  assert.equal(p.extrairDatasPt("vale a partir de 1º de janeiro de 2025")[0].data, "2025-01-01");
});
caso("12/11/2026 é dia/mês/ano", () => {
  assert.equal(p.extrairDatasPt("até 12/11/2026")[0].data, "2026-11-12");
});
caso("data impossível é ignorada", () => {
  assert.equal(p.extrairDatasPt("em 31/02/2026").length, 0);
});
caso("nov/2023 tem precisão de mês", () => {
  const [d] = p.extrairDatasPt("multa aplicada em nov/2023");
  assert.equal(d.data, "2023-11-01"); assert.equal(d.precisao, "MES");
});
caso("'atualmente' exige que valha hoje", () => {
  assert.equal(p.extrairExpressoesTemporais("Atualmente o plano custa R$ 10")[0].tipo, "PRESENTE");
});
caso("idioma: português e inglês", () => {
  assert.equal(p.detectarIdioma("O plano custa R$ 49,90 por mês para novos clientes.").idioma, "pt");
  assert.equal(p.detectarIdioma("The plan costs $20 per month for new customers.").idioma, "en");
});
caso("notas explicam as nuances em inglês para a interface", () => {
  const r = p.analisarNuances("O plano custa a partir de R$ 1.299,00 por mês.");
  assert.ok(r.notas.some(t => /lower bound/.test(t)));
  assert.ok(r.notas.some(t => /BRL 1,299\.00 per month/.test(t)));
});
caso("'cerca de 5 mil funcionários' é aproximadamente 5.000", () => {
  const v = p.extrairValores("A empresa tem cerca de 5 mil funcionários.").find(x => x.tipo === "QUANTIDADE");
  assert.equal(v.valor, 5000); assert.equal(v.qualificador.tipo, "APROXIMADO");
  assert.ok(p.analisarNuances("A empresa tem cerca de 5 mil funcionários.").notas.some(t => /5,000 \(approximately\)/.test(t)));
});
caso("'1,2 milhão de usuários' é 1.200.000 e não confunde com moeda", () => {
  const vs = p.extrairValores("O app tem 1,2 milhão de usuários e custa R$ 2 mil.");
  assert.equal(vs.find(x => x.tipo === "QUANTIDADE").valor, 1200000);
  assert.equal(vs.filter(x => x.tipo === "QUANTIDADE").length, 1);
  assert.equal(vs.find(x => x.tipo === "MONETARIO").valor, 2000);
});
const REF = new Date("2026-11-12T12:00:00Z");
caso("condições de pagamento brasileiras: Pix, 12x sem juros, novos clientes", () => {
  const r = p.analisarNuances("Custa R$ 9.999 à vista no Pix ou em 12x sem juros para novos clientes.", { dataReferencia: REF });
  const textos = r.condicoes.map(c => c.texto.toLowerCase());
  assert.ok(textos.includes("no pix") && textos.includes("12x sem juros") && textos.includes("para novos clientes"));
  assert.ok(!textos.includes("sem juros"), "sem duplicar 'sem juros'");
});
caso("mudança de estado: 'deixou de' e 'entrou em vigor'", () => {
  assert.ok(p.analisarNuances("O banco deixou de cobrar a tarifa.").mudancas.some(m => /stopped/.test(m.rotulo)));
  assert.ok(p.analisarNuances("A lei entrou em vigor ontem.").mudancas.some(m => /legal validity/.test(m.rotulo)));
});
caso("tempo coloquial resolvido pela data de hoje", () => {
  const r = p.analisarNuances("O salário mínimo vai subir no ano que vem.", { dataReferencia: REF });
  assert.equal(r.tempo_coloquial[0].resolvido, "2027");
  const m = p.analisarNuances("A regra vale a partir de março.", { dataReferencia: REF });
  assert.equal(m.tempo_coloquial[0].resolvido, "2027-03-01");
});
caso("mapa de autoridades: Selic → bcb.gov.br, LGPD → gov.br, Anatel", () => {
  assert.deepEqual(p.analisarNuances("A Selic está em 15%.").dominios_oficiais_sugeridos, ["bcb.gov.br"]);
  assert.deepEqual(p.analisarNuances("A LGPD exige um encarregado.").dominios_oficiais_sugeridos, ["gov.br"]);
  assert.ok(p.analisarNuances("A Anatel aprovou a regra da banda larga.").dominios_oficiais_sugeridos.includes("anatel.gov.br"));
});
caso("Pix como forma de pagamento não aponta para o Banco Central", () => {
  assert.deepEqual(p.analisarNuances("O tênis custa R$ 300 no Pix.").dominios_oficiais_sugeridos, []);
});
caso("03/04/2027 é 3 de abril, não 4 de março", () => {
  assert.ok(p.analisarNuances("Vale até 03/04/2027.").notas.some(t => /3 April, not March 4/.test(t)));
});
caso("português europeu é sinalizado", () => {
  assert.equal(p.analisarNuances("O facto é que o telemóvel custa 500 euros.").variante, "pt-PT");
  assert.equal(p.analisarNuances("O fato é que o celular custa R$ 500.").variante, "pt-BR");
});
caso("salário mínimo e Selic são regulamento, mesmo com R$", () => {
  const { inferirTipoPorRegras } = require("./src/tipo-afirmacao");
  assert.equal(inferirTipoPorRegras("O salário mínimo é R$ 1.518."), "regulamento");
  assert.equal(inferirTipoPorRegras("A taxa Selic está em 15%."), "regulamento");
});
console.log(`Resultado: ${n}/${n} casos de português passaram. Sem rede e sem banco.`);
