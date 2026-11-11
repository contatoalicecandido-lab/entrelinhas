
const assert = require("node:assert/strict");

const {
  normalizarFonte,
  VERSAO_NORMALIZACAO
} = require("./src/normalizar-fonte");

let totalTestes = 0;
let testesAprovados = 0;
let testesFalhos = 0;

function executarTeste(nome, funcao) {
  totalTestes++;

  try {
    funcao();
    testesAprovados++;
    console.log(`OK ${totalTestes}: ${nome}`);
  } catch (erro) {
    testesFalhos++;
    console.error(`FALHA ${totalTestes}: ${nome}`);
    console.error(`  ${erro.message}`);
  }
}

console.log("\n======================================");
console.log("ENTRELINHAS — TESTES DE NORMALIZAÇÃO");
console.log("======================================");

// 1. Normalização de espaços e estrutura textual

executarTeste("Ignora espaços repetidos entre palavras", () => {
  const a = normalizarFonte("O produto custa R$ 49,90.");
  const b = normalizarFonte("O produto   custa R$ 49,90.");

  assert.equal(
    a.conteudo_normalizado,
    b.conteudo_normalizado
  );
});

executarTeste("Ignora espaços nas extremidades das linhas", () => {
  const a = normalizarFonte("  Produto custa R$ 49,90.  ");
  const b = normalizarFonte("Produto custa R$ 49,90.");

  assert.equal(
    a.conteudo_normalizado,
    b.conteudo_normalizado
  );
});

executarTeste("Preserva separação entre parágrafos", () => {
  const resultado = normalizarFonte(
    "Primeiro parágrafo.\n\nSegundo parágrafo."
  );

  assert.equal(
    resultado.conteudo_normalizado,
    "Primeiro parágrafo.\n\nSegundo parágrafo."
  );
});

executarTeste("Preserva alteração de pontuação", () => {
  const a = normalizarFonte("O produto custa R$ 49,90.");
  const b = normalizarFonte("O produto custa R$ 49,90!");

  assert.notEqual(
    a.conteudo_normalizado,
    b.conteudo_normalizado
  );
});

executarTeste("Preserva alterações numéricas e monetárias", () => {
  const a = normalizarFonte("O produto custa R$ 49,90.");
  const b = normalizarFonte("O produto custa R$ 59,90.");

  assert.notEqual(
    a.conteudo_normalizado,
    b.conteudo_normalizado
  );
});

executarTeste("Preserva alterações de negação", () => {
  const a = normalizarFonte("O produto está disponível.");
  const b = normalizarFonte("O produto não está disponível.");

  assert.notEqual(
    a.conteudo_normalizado,
    b.conteudo_normalizado
  );
});

// 2. Comportamentos básicos

executarTeste("Normaliza conteúdo válido", () => {
  const resultado = normalizarFonte("Texto de exemplo.");

  assert.equal(resultado.status, "NORMALIZED");
  assert.equal(resultado.conteudo_normalizado, "Texto de exemplo.");
});

executarTeste("Identifica versão da normalização", () => {
  const resultado = normalizarFonte("Texto.");

  assert.equal(resultado.versao, VERSAO_NORMALIZACAO);
});

executarTeste("Preserva conteúdo textual sem espaços excedentes", () => {
  const original = "Preço: R$ 49,90.\nVálido até dezembro.";

  const resultado = normalizarFonte(original);

  assert.equal(resultado.conteudo_normalizado, original);
});

// 3. Unicode e finais de linha

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

executarTeste("Preserva parágrafos e normaliza espaços repetidos", () => {
  const original = "Primeiro parágrafo.\n\nSegundo   parágrafo.";

  const resultado = normalizarFonte(original);

  assert.equal(
    resultado.conteudo_normalizado,
    "Primeiro parágrafo.\n\nSegundo parágrafo."
  );
});

// 4. Conteúdo inválido

executarTeste("Rejeita conteúdo vazio", () => {
  const resultado = normalizarFonte("   ");

  assert.equal(resultado.status, "INDETERMINADO");
  assert.equal(resultado.conteudo_normalizado, null);
});

executarTeste("Rejeita conteúdo que não seja texto", () => {
  const resultado = normalizarFonte(null);

  assert.equal(resultado.status, "INDETERMINADO");
  assert.equal(resultado.conteudo_normalizado, null);
});

// 5. Rastreabilidade das transformações

executarTeste("Não registra transformações inexistentes", () => {
  const resultado = normalizarFonte("Texto sem alterações.");

  assert.deepEqual(resultado.transformacoes, []);
});

// 6. Resultado final

console.log("\n======================================");
console.log("RESULTADO FINAL");
console.log("======================================");
console.log(`TESTES EXECUTADOS: ${totalTestes}`);
console.log(`APROVADOS: ${testesAprovados}`);
console.log(`FALHOS: ${testesFalhos}`);

if (testesFalhos === 0) {
  console.log("STATUS: TODOS PASSARAM");
} else {
  console.log("STATUS: EXISTEM FALHAS");
  process.exitCode = 1;
}

console.log("======================================\n");
