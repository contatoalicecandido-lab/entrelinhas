
const assert = require("node:assert/strict");

const {
  avaliarImpacto
} = require("./src/avaliador-impacto");

let totalTestes = 0;

function executarTeste(nome, funcao) {
  funcao();
  totalTestes++;
  console.log(`✔ ${nome}`);
}

function criarAlteracao(
  removido,
  adicionado,
  anterior,
  atual
) {
  return {
    trechos_removidos: [removido],
    trechos_adicionados: [adicionado],
    trecho_anterior_contextualizado: anterior,
    trecho_atual_contextualizado: atual
  };
}

try {
  console.log("\n======================================");
  console.log("ENTRELINHAS — TESTES DE FALSOS POSITIVOS");
  console.log("======================================");

  executarTeste("Não classifica negação preservada como mudança", () => {
    const resultado = avaliarImpacto(
      criarAlteracao(
        "chat",
        "telefone",
        "O plano não inclui suporte prioritário. Atendimento via chat.",
        "O plano não inclui suporte prioritário. Atendimento via telefone."
      )
    );

    assert.equal(resultado.nivel, "BAIXO");
  });

  executarTeste("Não classifica preço preservado como mudança", () => {
    const resultado = avaliarImpacto(
      criarAlteracao(
        "chat",
        "telefone",
        "Plano custa R$ 49,90 por mês. Atendimento via chat.",
        "Plano custa R$ 49,90 por mês. Atendimento via telefone."
      )
    );

    assert.equal(resultado.nivel, "BAIXO");
  });

  executarTeste("Não classifica condição preservada em outra frase como mudança", () => {
    const resultado = avaliarImpacto(
      criarAlteracao(
        "Chat",
        "Telefone",
        "Atendimento somente para novos clientes. Chat disponível.",
        "Atendimento somente para novos clientes. Telefone disponível."
      )
    );

    assert.equal(resultado.nivel, "BAIXO");
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
