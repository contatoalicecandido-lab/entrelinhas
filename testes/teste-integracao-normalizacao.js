
const assert = require("node:assert/strict");

const { criarBanco } = require("../src/banco");

const {
  normalizarFonte,
  VERSAO_NORMALIZACAO
} = require("../src/normalizar-fonte");

const banco = criarBanco({ caminho: ":memory:" });

const url = "https://exemplo.com/normalizacao";

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

try {
  console.log("\n======================================");
  console.log("ENTRELINHAS — INTEGRAÇÃO DA NORMALIZAÇÃO");
  console.log("======================================");

  const conteudoOriginal =
    "Primeiro parágrafo.\r\nSegundo   parágrafo.";

  const normalizacao = normalizarFonte(conteudoOriginal);

  const verificacao = {
    sistema: "Entrelinhas",
    texto_original: "Teste de persistência da normalização.",
    verificado_em: "2026-11-05T10:00:00.000Z",
    afirmacoes: [
      {
        id: "afirmacao_1",
        texto: "Teste de persistência da normalização.",
        evidencias: [
          {
            fonte: {
              titulo: "Fonte de teste",
              url,
              tipo_fonte: "tavily_extract",
              conteudo: conteudoOriginal,
              normalizacao,
              coletado_em: "2026-11-05T10:00:00.000Z",
              data_publicacao: null,
              data_atualizacao: null,
              relevancia: 0.9
            }
          }
        ]
      }
    ]
  };

  const id = banco.salvarVerificacao(verificacao);

  executarTeste("A verificação foi salva", () => {
    assert.ok(id);
  });

  const historico = banco.listarHistoricoFonte(url);

  executarTeste("O histórico recuperou a evidência", () => {
    assert.equal(historico.length, 1);
  });

  const fonteRecuperada = historico[0].fonte;

  executarTeste("O conteúdo original foi preservado", () => {
    assert.equal(
      fonteRecuperada.conteudo,
      conteudoOriginal
    );
  });

  executarTeste("A normalização foi persistida", () => {
    assert.deepEqual(
      fonteRecuperada.normalizacao,
      normalizacao
    );
  });

  executarTeste("A versão atual da normalização foi preservada", () => {
    assert.equal(
      fonteRecuperada.normalizacao.versao,
      VERSAO_NORMALIZACAO
    );

    assert.equal(VERSAO_NORMALIZACAO, "2.0.0");
  });

  executarTeste("O conteúdo normalizado foi recuperado", () => {
    assert.equal(
      fonteRecuperada.normalizacao.conteudo_normalizado,
      "Primeiro parágrafo.\nSegundo parágrafo."
    );
  });

  executarTeste("As transformações foram registradas", () => {
    const regras = fonteRecuperada.normalizacao.transformacoes.map(
      item => item.regra
    );

    assert.ok(regras.includes("LINE_ENDINGS"));
    assert.ok(regras.includes("HORIZONTAL_WHITESPACE"));
  });

  executarTeste("A estrutura dos parágrafos foi preservada", () => {
    assert.equal(
      fonteRecuperada.normalizacao.conteudo_normalizado.split("\n").length,
      2
    );
  });

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

} catch (erro) {
  console.error("\nERRO NA EXECUÇÃO:", erro);
  process.exitCode = 1;

} finally {
  banco.fechar();
}
