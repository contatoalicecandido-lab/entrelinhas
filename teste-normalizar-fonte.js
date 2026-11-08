
const assert = require("node:assert/strict");

const {
  normalizarFonte,
  VERSAO_NORMALIZACAO
} = require("./src/normalizar-fonte");

let totalTestes = 0;

function executarTeste(nome, funcao) {
  totalTestes++;

  try {
    funcao();
    console.log(`OK ${totalTestes}: ${nome}`);
  } catch (erro) {
    console.error(`FALHA: ${nome}`);
    throw erro;
  }
}

try {
  console.log("\n======================================");
  console.log("ENTRELINHAS — TESTES DE NORMALIZAÇÃO");
  console.log("======================================");

  executarTeste("Normaliza conteúdo válido", () => {
    const resultado = normalizarFonte("Texto de exemplo.");

    assert.equal(resultado.status, "NORMALIZED");
    assert.equal(resultado.conteudo_normalizado, "Texto de exemplo.");
  });

  executarTeste("Identifica versão da normalização", () => {
    const resultado = normalizarFonte("Texto.");

    assert.equal(resultado.versao, VERSAO_NORMALIZACAO);
  });

  executarTeste("Preserva conteúdo original", () => {
    const original = "Preço: R$ 49,90.\nVálido até dezembro.";

    const resultado = normalizarFonte(original);

    assert.equal(resultado.conteudo_normalizado, original);
  });

  executarTeste("Padroniza Unicode equivalente", () => {
    const resultado = normalizarFonte(
      "Informac\u0327a\u0303o"
    );

    assert.equal(
      resultado.conteudo_normalizado,
      "Informação"
    );

    assert.ok(
      resultado.transformacoes.some(
        item => item.regra === "UNICODE_NFC"
      )
    );
  });

  executarTeste("Padroniza finais de linha Windows", () => {
    const resultado = normalizarFonte("Linha 1\r\nLinha 2");

    assert.equal(
      resultado.conteudo_normalizado,
      "Linha 1\nLinha 2"
    );

    assert.ok(
      resultado.transformacoes.some(
        item => item.regra === "LINE_ENDINGS"
      )
    );
  });

  executarTeste("Preserva parágrafos e espaços", () => {
    const original = "Primeiro parágrafo.\n\nSegundo   parágrafo.";

    const resultado = normalizarFonte(original);

    assert.equal(resultado.conteudo_normalizado, original);
  });

  executarTeste("Rejeita conteúdo vazio", () => {
    const resultado = normalizarFonte("   ");

    assert.equal(resultado.status, "INDETERMINADO");
    assert.equal(resultado.conteudo_normalizado, null);
  });

  executarTeste("Rejeita conteúdo que não seja texto", () => {
    const resultado = normalizarFonte(null);

    assert.equal(resultado.status, "INDETERMINADO");
  });

  executarTeste("Não registra transformações inexistentes", () => {
    const resultado = normalizarFonte("Texto sem alterações.");

    assert.deepEqual(resultado.transformacoes, []);
  });

  console.log("\n======================================");
  console.log("RESULTADO FINAL");
  console.log("======================================");
  console.log(`TESTES EXECUTADOS: ${totalTestes}`);
  console.log("STATUS: TODOS PASSARAM");

} catch (erro) {
  console.error("\nFALHA NOS TESTES:", erro.message);
  process.exitCode = 1;
}
