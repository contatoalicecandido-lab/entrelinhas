
const assert = require("node:assert/strict");

const {
  calcularDiferencas
} = require("../src/comparador-fontes");

let totalTestes = 0;

function executarTeste(nome, funcao) {
  funcao();
  totalTestes++;
  console.log(`✔ ${nome}`);
}

function obterPrimeiroImpacto(antigo, atual) {
  const resultado = calcularDiferencas(antigo, atual);

  assert.equal(resultado.status, "COMPLETO");
  assert.ok(resultado.alteracoes.length > 0);

  return resultado.alteracoes[0].impacto;
}

try {
  console.log("\n======================================");
  console.log("ENTRELINHAS — TESTES DE INTEGRAÇÃO DE IMPACTO");
  console.log("======================================");

  executarTeste("Integra impacto em alteração de preço", () => {
    const impacto = obterPrimeiroImpacto(
      "Plano básico custa R$ 49,90 por mês.",
      "Plano básico custa R$ 59,90 por mês."
    );

    assert.equal(impacto.status, "CLASSIFICADO");
    assert.equal(impacto.nivel, "ALTO");
    assert.ok(impacto.sinais_detectados.includes("preco"));
  });

  executarTeste("Integra impacto em alteração de prazo", () => {
    const impacto = obterPrimeiroImpacto(
      "Oferta válida até 30 de novembro de 2026.",
      "Oferta válida até 15 de dezembro de 2026."
    );

    assert.equal(impacto.nivel, "ALTO");
    assert.ok(impacto.sinais_detectados.includes("dataPrazo"));
  });

  executarTeste("Integra impacto em remoção de negação", () => {
    const impacto = obterPrimeiroImpacto(
      "O plano não inclui suporte prioritário.",
      "O plano inclui suporte prioritário."
    );

    assert.equal(impacto.nivel, "ALTO");
    assert.ok(impacto.sinais_detectados.includes("negacao"));
  });

  executarTeste("Integra impacto em mudança de condição", () => {
    const impacto = obterPrimeiroImpacto(
      "Preço válido somente para pagamento via Pix.",
      "Preço válido somente para pagamento via cartão."
    );

    assert.equal(impacto.nivel, "ALTO");
    assert.ok(impacto.sinais_detectados.includes("condicao"));
  });

  executarTeste("Integra impacto em alteração de ressalva", () => {
    const impacto = obterPrimeiroImpacto(
      "Benefício sujeito à disponibilidade.",
      "Benefício conforme disponibilidade."
    );

    assert.equal(impacto.nivel, "MEDIO");
    assert.ok(impacto.sinais_detectados.includes("ressalva"));
    assert.ok(!impacto.sinais_detectados.includes("condicao"));
  });

  executarTeste("Integra impacto baixo em alteração sem indicadores", () => {
    const impacto = obterPrimeiroImpacto(
      "Conheça nossa equipe de atendimento.",
      "Conheça nosso time de atendimento."
    );

    assert.equal(impacto.status, "CLASSIFICADO");
    assert.equal(impacto.nivel, "BAIXO");
  });

  executarTeste("Classifica separadamente alterações distantes", () => {
    const resultado = calcularDiferencas(
      "Plano custa R$ 49,90 por mês. O atendimento funciona normalmente todos os dias.",
      "Plano custa R$ 59,90 por mês. O atendimento funciona normalmente em horário comercial."
    );

    assert.equal(resultado.alteracoes.length, 2);

    const alteracoes = resultado.alteracoes;

    assert.equal(alteracoes[0].impacto.nivel, "ALTO");
    assert.ok(alteracoes[0].impacto.sinais_detectados.includes("preco"));

    assert.equal(alteracoes[1].impacto.nivel, "BAIXO");

    for (const alteracao of alteracoes) {
      assert.ok(alteracao.impacto);
      assert.ok(alteracao.impacto.nivel);
    }
  });

  executarTeste("Mantém campos anteriores de compatibilidade", () => {
    const resultado = calcularDiferencas(
      "Plano custa R$ 49,90.",
      "Plano custa R$ 59,90."
    );

    assert.ok(Array.isArray(resultado.trechos_removidos));
    assert.ok(Array.isArray(resultado.trechos_adicionados));
    assert.ok(Array.isArray(resultado.alteracoes));

    const alteracao = resultado.alteracoes[0];

    assert.ok(Array.isArray(alteracao.trechos_removidos));
    assert.ok(Array.isArray(alteracao.trechos_adicionados));
    assert.ok(alteracao.trecho_anterior_contextualizado);
    assert.ok(alteracao.trecho_atual_contextualizado);
    assert.ok(alteracao.impacto);
  });

  console.log("\n======================================");
  console.log("RESULTADO FINAL");
  console.log("======================================");
  console.log(`TESTES EXECUTADOS: ${totalTestes}`);
  console.log("STATUS: TODOS PASSARAM");

} catch (erro) {
  console.error("\nTESTE NÃO APROVADO:", erro.message);
  process.exitCode = 1;
}
