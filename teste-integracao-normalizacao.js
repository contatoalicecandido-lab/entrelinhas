
const assert = require("node:assert/strict");
const { criarBanco } = require("./src/banco");
const { normalizarFonte } = require("./src/normalizar-fonte");

const banco = criarBanco({ caminho: ":memory:" });
const url = "https://exemplo.com/normalizacao";

try {
  const conteudoOriginal = "Primeiro parágrafo.\r\nSegundo parágrafo.";

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

  assert.ok(id, "A verificação precisa ser salva.");

  const historico = banco.listarHistoricoFonte(url);

  assert.equal(historico.length, 1);

  const fonteRecuperada = historico[0].fonte;

  assert.equal(
    fonteRecuperada.conteudo,
    conteudoOriginal
  );

  assert.deepEqual(
    fonteRecuperada.normalizacao,
    normalizacao
  );

  assert.equal(
    fonteRecuperada.normalizacao.versao,
    "1.0.0"
  );

  assert.equal(
    fonteRecuperada.normalizacao.conteudo_normalizado,
    "Primeiro parágrafo.\nSegundo parágrafo."
  );

  console.log("OK 1: A verificação foi salva.");
  console.log("OK 2: O histórico recuperou a evidência.");
  console.log("OK 3: O conteúdo original foi preservado.");
  console.log("OK 4: A normalização foi persistida.");
  console.log("OK 5: A versão da normalização foi preservada.");
  console.log("OK 6: O conteúdo normalizado foi recuperado.");

  console.log("\nSTATUS: TODOS OS TESTES PASSARAM");

} catch (erro) {
  console.error("\nFALHA:", erro.message);
  process.exitCode = 1;

} finally {
  banco.fechar();
}
