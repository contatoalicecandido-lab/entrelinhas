const assert = require("node:assert/strict");

const {
  calcularDiferencas
} = require("../src/comparador-fontes");

let totalTestes = 0;

function executarTeste(nome, funcao) {
  totalTestes++;
  funcao();
  console.log(`✔ ${nome}`);
}

try {
  console.log("\n======================================");
  console.log("ENTRELINHAS — TESTES DE CONTEXTO");
  console.log("======================================");

  executarTeste("Mostra o contexto de uma alteração de preço", () => {
    const resultado = calcularDiferencas(
      "Plano básico custa R$ 49,90 por mês.",
      "Plano básico custa R$ 59,90 por mês."
    );

    assert.equal(resultado.status, "COMPLETO");
    assert.equal(resultado.alteracoes.length, 1);

    const alteracao = resultado.alteracoes[0];

    assert.ok(
      alteracao.trecho_anterior_contextualizado.includes("49,90")
    );

    assert.ok(
      alteracao.trecho_atual_contextualizado.includes("59,90")
    );

    assert.ok(
      alteracao.contexto_antes.includes("Plano básico")
    );

    assert.ok(
      alteracao.contexto_depois.includes("por mês.")
    );
  });

  executarTeste("Preserva o contexto de uma negação removida", () => {
    const resultado = calcularDiferencas(
      "O plano não inclui suporte prioritário.",
      "O plano inclui suporte prioritário."
    );

    const alteracao = resultado.alteracoes[0];

    assert.ok(
      alteracao.trechos_removidos.includes("não")
    );

    assert.ok(
      alteracao.trecho_anterior_contextualizado.includes(
        "não inclui"
      )
    );

    assert.ok(
      alteracao.trecho_atual_contextualizado.includes(
        "inclui suporte"
      )
    );
  });

  executarTeste("Mantém os campos antigos de compatibilidade", () => {
    const resultado = calcularDiferencas(
      "Oferta válida até 30 de novembro.",
      "Oferta válida até 15 de dezembro."
    );

    assert.ok(Array.isArray(resultado.trechos_removidos));
    assert.ok(Array.isArray(resultado.trechos_adicionados));
    assert.ok(Array.isArray(resultado.alteracoes));
  });

  executarTeste("Retorna contexto para alteração de condição", () => {
    const resultado = calcularDiferencas(
      "Preço válido somente para pagamento via Pix.",
      "Preço válido somente para pagamento via cartão."
    );

    const alteracao = resultado.alteracoes[0];

    assert.ok(
      alteracao.trecho_anterior_contextualizado.includes("Pix.")
    );

    assert.ok(
      alteracao.trecho_atual_contextualizado.includes("cartão.")
    );
  });

  executarTeste("Respeita o limite de contexto", () => {
    const resultado = calcularDiferencas(
      "Um dois três quatro cinco seis sete oito nove dez preço antigo fim.",
      "Um dois três quatro cinco seis sete oito nove dez preço novo fim."
    );

    const alteracao = resultado.alteracoes[0];

    const palavrasAntes = alteracao.contexto_antes.split(/\s+/);

    const palavrasDepois = alteracao.contexto_depois.split(/\s+/);

    assert.ok(palavrasAntes.length <= 5);
    assert.ok(palavrasDepois.length <= 5);
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