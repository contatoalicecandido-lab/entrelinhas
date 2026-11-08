const assert = require("node:assert/strict");

const {
  avaliarImpacto
} = require("./src/avaliador-impacto");

let totalTestes = 0;

function executarTeste(nome, funcao) {
  totalTestes++;
  funcao();
  console.log(`✔ ${nome}`);
}

function criarAlteracao(
  removido,
  adicionado,
  contextoAnterior = "",
  contextoAtual = ""
) {
  return {
    trechos_removidos: [removido],
    trechos_adicionados: [adicionado],
    trecho_anterior_contextualizado: contextoAnterior,
    trecho_atual_contextualizado: contextoAtual
  };
}

try {
  console.log("\n======================================");
  console.log("ENTRELINHAS — TESTES DE IMPACTO");
  console.log("======================================");

  executarTeste("Classifica alteração de preço como ALTO", () => {
    const resultado = avaliarImpacto(
      criarAlteracao(
        "49,90",
        "59,90",
        "Plano básico custa R$ 49,90 por mês.",
        "Plano básico custa R$ 59,90 por mês."
      )
    );

    assert.equal(resultado.nivel, "ALTO");
    assert.ok(resultado.sinais_detectados.includes("preco"));
  });

  executarTeste("Classifica alteração de prazo como ALTO", () => {
    const resultado = avaliarImpacto(
      criarAlteracao(
        "30 de novembro de 2026",
        "15 de dezembro de 2026",
        "Oferta válida até 30 de novembro de 2026.",
        "Oferta válida até 15 de dezembro de 2026."
      )
    );

    assert.equal(resultado.nivel, "ALTO");
    assert.ok(resultado.sinais_detectados.includes("dataPrazo"));
  });

  executarTeste("Classifica remoção de negação como ALTO", () => {
    const resultado = avaliarImpacto(
      criarAlteracao(
        "não",
        "",
        "O plano não inclui suporte prioritário.",
        "O plano inclui suporte prioritário."
      )
    );

    assert.equal(resultado.nivel, "ALTO");
    assert.ok(resultado.sinais_detectados.includes("negacao"));
  });

  executarTeste("Classifica mudança de condição como ALTO", () => {
    const resultado = avaliarImpacto(
      criarAlteracao(
        "Pix",
        "cartão",
        "Preço válido somente para pagamento via Pix.",
        "Preço válido somente para pagamento via cartão."
      )
    );

    assert.equal(resultado.nivel, "ALTO");
    assert.ok(resultado.sinais_detectados.includes("condicao"));
  });

  executarTeste("Classifica ressalva como MEDIO", () => {
    const resultado = avaliarImpacto(
      criarAlteracao(
        "sujeito à disponibilidade",
        "conforme disponibilidade",
        "Benefício sujeito à disponibilidade.",
        "Benefício conforme disponibilidade."
      )
    );

    console.log("  Nível retornado:", resultado.nivel);
    console.log("  Sinais detectados:", resultado.sinais_detectados);

    assert.equal(resultado.nivel, "MEDIO");
    assert.ok(resultado.sinais_detectados.includes("ressalva"));
    assert.ok(!resultado.sinais_detectados.includes("condicao"));
  });

  executarTeste("Classifica alteração sem indicadores como BAIXO", () => {
    const resultado = avaliarImpacto(
      criarAlteracao(
        "conheça nossa equipe",
        "veja nossa equipe",
        "Conheça nossa equipe.",
        "Veja nossa equipe."
      )
    );

    assert.equal(resultado.nivel, "BAIXO");
    assert.equal(resultado.sinais_detectados.length, 0);
  });

  executarTeste("Retorna INDETERMINADO sem conteúdo", () => {
    const resultado = avaliarImpacto({
      trechos_removidos: [],
      trechos_adicionados: []
    });

    assert.equal(resultado.nivel, "INDETERMINADO");
  });

  executarTeste("Retorna INDETERMINADO para entrada inválida", () => {
    const resultado = avaliarImpacto(null);

    assert.equal(resultado.nivel, "INDETERMINADO");
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