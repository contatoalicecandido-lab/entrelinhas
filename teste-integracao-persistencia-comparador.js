
const assert = require("node:assert/strict");

const { criarBanco } = require("./src/banco");
const {
  compararHistoricoFonte
} = require("./src/comparador-fontes");

const URL = "https://exemplo.com/produto";

function criarVerificacao(conteudo, data, dataPublicacao, dataAtualizacao) {
  return {
    texto_original: "Verificar as informações do produto.",
    verificado_em: data,
    afirmacoes: [
      {
        id: "afirmacao-produto",
        texto: "O produto custa determinado valor.",
        evidencias: [
          {
            fonte: {
              titulo: "Página do produto",
              url: URL,
              tipo_fonte: "WEBSITE",
              conteudo,
              coletado_em: data,
              data_publicacao: dataPublicacao,
              data_atualizacao: dataAtualizacao
            }
          }
        ]
      }
    ]
  };
}

function executar() {
  const banco = criarBanco({
    caminho: ":memory:"
  });

  let testesPassaram = 0;
  const totalTestes = 16;

  function verificar(descricao, funcao) {
    funcao();
    testesPassaram++;
    console.log(`OK ${testesPassaram}: ${descricao}`);
  }

  try {
    const idPrimeiraVerificacao = banco.salvarVerificacao(
      criarVerificacao(
        "O produto custa R$ 49,90 e está disponível.",
        "2026-11-01T10:00:00.000Z",
        "2026-10-28",
        "2026-10-31"
      )
    );

    banco.salvarVerificacao(
      criarVerificacao(
        "O produto custa R$ 59,90 e está disponível.",
        "2026-11-02T10:00:00.000Z",
        "2026-10-29",
        "2026-11-01"
      )
    );

    const historico = banco.listarHistoricoFonte(URL);

    verificar(
      "O histórico contém duas coletas",
      () => assert.equal(historico.length, 2)
    );

    verificar(
      "As duas coletas possuem IDs de evidência",
      () => {
        assert.ok(historico[0].id_evidencia);
        assert.ok(historico[1].id_evidencia);
        assert.notEqual(
          historico[0].id_evidencia,
          historico[1].id_evidencia
        );
      }
    );

    verificar(
      "As datas de publicação foram persistidas no SQLite",
      () => {
        assert.equal(historico[0].data_publicacao, "2026-10-28");
        assert.equal(historico[1].data_publicacao, "2026-10-29");
      }
    );

    verificar(
      "As datas de atualização foram persistidas no SQLite",
      () => {
        assert.equal(historico[0].data_atualizacao, "2026-10-31");
        assert.equal(historico[1].data_atualizacao, "2026-11-01");
      }
    );

    verificar(
      "O JSON original preserva as datas da primeira evidência",
      () => {
        assert.equal(
          historico[0].fonte.data_publicacao,
          "2026-10-28"
        );
        assert.equal(
          historico[0].fonte.data_atualizacao,
          "2026-10-31"
        );
      }
    );

    const verificacaoRecuperada =
      banco.obterVerificacao(idPrimeiraVerificacao);

    verificar(
      "A verificação recuperada preserva as datas da evidência",
      () => {
        const fonte =
          verificacaoRecuperada.afirmacoes[0].evidencias[0].fonte;

        assert.equal(fonte.data_publicacao, "2026-10-28");
        assert.equal(fonte.data_atualizacao, "2026-10-31");
      }
    );

    const primeiraComparacao =
      compararHistoricoFonte(banco, URL);

    verificar(
      "O comparador detecta a alteração textual",
      () => assert.equal(primeiraComparacao.status, "CHANGED")
    );

    verificar(
      "A comparação retorna confirmação de persistência",
      () => {
        assert.equal(
          primeiraComparacao.persistencia.status,
          "PERSISTED"
        );
        assert.ok(primeiraComparacao.id_comparacao);
      }
    );

    verificar(
      "A avaliação de impacto confirma a persistência",
      () => {
        assert.equal(
          primeiraComparacao.persistencia_impacto.status,
          "PERSISTED"
        );
      }
    );

    const avaliacoesAntes =
      banco.listarAvaliacoesImpacto(
        primeiraComparacao.id_comparacao
      );

    verificar(
      "A avaliação de impacto foi gravada no SQLite",
      () => assert.equal(avaliacoesAntes.length, 1)
    );

    verificar(
      "O registro contém método, versão e alterações avaliadas",
      () => {
        const registro = avaliacoesAntes[0];
        const avaliacao = registro.avaliacao;

        assert.equal(
          registro.metodo,
          "HEURISTICO_REGRAS"
        );

        assert.equal(
          registro.versao_regra,
          "1.0.0"
        );

        assert.ok(Array.isArray(avaliacao.avaliacoes));
        assert.ok(avaliacao.avaliacoes.length > 0);

        assert.ok(
          avaliacao.avaliacoes.some(
            item => item.impacto?.status === "CLASSIFICADO"
          )
        );
      }
    );

    verificar(
      "A alteração de preço é consolidada com o maior nível de impacto",
      () => {
        assert.equal(
          avaliacoesAntes[0].avaliacao.nivel,
          "ALTO"
        );
      }
    );

    const comparacoesAntes =
      banco.listarComparacoesFonte(URL);

    verificar(
      "A comparação aparece no histórico do banco",
      () => assert.equal(comparacoesAntes.length, 1)
    );

    verificar(
      "O resultado original foi preservado",
      () => {
        const registro = comparacoesAntes[0];

        const resultadoSalvo =
          typeof registro.resultado_json === "string"
            ? JSON.parse(registro.resultado_json)
            : registro.resultado_json;

        assert.equal(resultadoSalvo.status, "CHANGED");
        assert.equal(
          resultadoSalvo.hash_anterior,
          primeiraComparacao.hash_anterior
        );
        assert.equal(
          resultadoSalvo.hash_atual,
          primeiraComparacao.hash_atual
        );
      }
    );

    const segundaComparacao =
      compararHistoricoFonte(banco, URL);

    const comparacoesDepois =
      banco.listarComparacoesFonte(URL);

    verificar(
      "A segunda execução não cria comparação duplicada",
      () => assert.equal(comparacoesDepois.length, 1)
    );

    verificar(
      "A segunda execução mantém o mesmo ID e não duplica a avaliação",
      () => {
        assert.equal(
          segundaComparacao.id_comparacao,
          primeiraComparacao.id_comparacao
        );

        const avaliacoesDepois =
          banco.listarAvaliacoesImpacto(
            primeiraComparacao.id_comparacao
          );

        assert.equal(avaliacoesDepois.length, 1);
        assert.equal(
          avaliacoesDepois[0].id_avaliacao,
          avaliacoesAntes[0].id_avaliacao
        );
      }
    );

    console.log("\n======================================");
    console.log("RESULTADO FINAL");
    console.log("======================================");
    console.log(`TESTES EXECUTADOS: ${totalTestes}`);
    console.log(`TESTES APROVADOS: ${testesPassaram}`);
    console.log(
      `STATUS: ${
        testesPassaram === totalTestes
          ? "TODOS PASSARAM"
          : "FALHA"
      }`
    );

    if (testesPassaram !== totalTestes) {
      process.exitCode = 1;
    }
  } catch (erro) {
    console.error("\nTESTE FALHOU:");
    console.error(erro);
    process.exitCode = 1;
  } finally {
    banco.fechar();
  }
}

executar();
