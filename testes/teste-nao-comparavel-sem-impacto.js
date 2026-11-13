const assert = require("node:assert/strict");
const { randomUUID, createHash } = require("node:crypto");

const { criarBanco } = require("../src/banco");
const { compararHistoricoFonte } = require("../src/comparador-fontes");

const URL = "https://exemplo.com/artigo";

function criarColeta(idVerificacao, conteudo, data) {
  return {
    id_coleta: randomUUID(),
    id_verificacao: idVerificacao,
    url_original: URL,
    url_canonica: URL,
    versao_canonicalizacao: "1.0.0",
    tipo_fonte: "tavily_extract",
    status_coleta: "SUCCESS",
    conteudo,
    hash_conteudo: createHash("sha256")
      .update(conteudo)
      .digest("hex"),
    coletado_em: data,
    id_operacao_busca: randomUUID(),
    id_operacao_extracao: randomUUID(),
    consulta: "teste impacto temporal",
    parametros_busca: {},
    parametros_extracao: {}
  };
}

function criarVerificacao(id, coleta, dataVerificacao) {
  return {
    id_verificacao: id,
    texto_original: "Verificar informação do artigo",
    verificado_em: dataVerificacao,
    afirmacoes: [
      {
        id: randomUUID(),
        texto: "O artigo apresenta uma informação.",
        tipo_afirmacao: "FACTUAL",
        evidencias: [
          {
            fonte: {
              titulo: "Artigo de teste",
              url: URL,
              tipo_fonte: "tavily_extract",
              conteudo: coleta.conteudo,
              coletado_em: coleta.coletado_em,
              relevancia: 0.9
            },
            coleta
          }
        ]
      }
    ]
  };
}

function executar() {
  const banco = criarBanco({ caminho: ":memory:" });

  try {
    console.log("==========================================");
    console.log("TESTE — NOT_COMPARABLE SEM IMPACTO");
    console.log("==========================================");

    const idPrimeira = randomUUID();
    const idSegunda = randomUUID();

    const primeiraColeta = criarColeta(
      idPrimeira,
      "O preço original era R$ 100.",
      "2026-11-01T10:00:00.000Z"
    );

    const segundaColeta = criarColeta(
      idSegunda,
      "O preço atualizado passou a R$ 200.",
      "data-invalida"
    );

    banco.salvarVerificacao(
      criarVerificacao(
        idPrimeira,
        primeiraColeta,
        "2026-11-01T10:05:00.000Z"
      )
    );

    banco.salvarVerificacao(
      criarVerificacao(
        idSegunda,
        segundaColeta,
        "2026-11-02T10:05:00.000Z"
      )
    );

    console.log("\n1. Duas coletas registradas.");
    assert.equal(banco.listarHistoricoFonte(URL).length, 2);
    console.log("OK: histórico contém duas evidências.");

    const resultado = compararHistoricoFonte(banco, URL);

    console.log("\n2. Resultado da comparação:", resultado.status);
    assert.equal(resultado.status, "NOT_COMPARABLE");
    console.log("OK: comparação temporal inválida foi bloqueada.");

    console.log("\n3. Persistência da comparação:", resultado.persistencia.status);
    assert.equal(resultado.persistencia.status, "NOT_PERSISTED");
    console.log("OK: resultado não foi persistido como comparação válida.");

    const comparacoes = banco.listarComparacoesFonte(URL);

    console.log("\n4. Comparações persistidas:", comparacoes.length);
    assert.equal(comparacoes.length, 0);
    console.log("OK: nenhuma comparação foi gravada.");

    const avaliacoes = comparacoes.flatMap(comparacao =>
      banco.listarAvaliacoesImpacto(comparacao.id)
    );

    console.log("\n5. Avaliações de impacto vinculadas:", avaliacoes.length);
    assert.equal(avaliacoes.length, 0);
    console.log("OK: nenhuma avaliação de impacto foi gravada.");

    console.log("\n==========================================");
    console.log("RESULTADO: TESTE APROVADO");
    console.log("CRITÉRIO 14: COMPORTAMENTO CONFIRMADO");
    console.log("==========================================");
  } finally {
    banco.fechar();
  }
}

try {
  executar();
} catch (erro) {
  console.error("\nTESTE FALHOU:", erro.message);
  process.exitCode = 1;
}
