
const assert = require("node:assert/strict");
const { criarBanco } = require("../src/banco");

const banco = criarBanco({ caminho: ":memory:" });

let testes = 0;

function testar(nome, funcao) {
  try {
    funcao();
    testes++;
    console.log(`OK ${testes}: ${nome}`);
  } catch (erro) {
    console.error(`FALHOU: ${nome}`);
    throw erro;
  }
}

try {
  const url = "https://exemplo.com/produto";

  function criarVerificacao(conteudo, data) {
    return banco.salvarVerificacao({
      texto_original: "O produto possui determinada condição.",
      verificado_em: data,
      afirmacoes: [
        {
          id: "afirmacao-1",
          texto: "O produto possui determinada condição.",
          evidencias: [
            {
              fonte: {
                titulo: "Página do produto",
                url,
                tipo_fonte: "website",
                conteudo,
                coletado_em: data
              }
            }
          ]
        }
      ]
    });
  }

  criarVerificacao(
    "O produto custa R$ 100 e está disponível.",
    "2026-11-01T10:00:00.000Z"
  );

  criarVerificacao(
    "O produto custa R$ 120 e está disponível.",
    "2026-11-02T10:00:00.000Z"
  );

  const historico = banco.listarHistoricoFonte(url);

  testar("O histórico retorna duas coletas", () => {
    assert.equal(historico.length, 2);
  });

  testar("Cada coleta possui um ID de evidência", () => {
    assert.ok(Number.isInteger(historico[0].id_evidencia));
    assert.ok(Number.isInteger(historico[1].id_evidencia));
  });

  const comparacao = {
    status: "CHANGED",
    hash_anterior: "hash-antigo",
    hash_atual: "hash-atual",
    detalhamento: {
      status: "COMPLETO",
      trechos_removidos: ["R$ 100"],
      trechos_adicionados: ["R$ 120"]
    }
  };

  const dadosComparacao = {
    url,
    id_evidencia_anterior: historico[0].id_evidencia,
    id_evidencia_atual: historico[1].id_evidencia,
    algoritmo: "LCS",
    versao_algoritmo: "1.0.0",
    resultado: comparacao
  };

  const idComparacao = banco.salvarComparacao(dadosComparacao);

  testar("A comparação é persistida", () => {
    const lista = banco.listarComparacoesFonte(url);

    assert.equal(lista.length, 1);
    assert.equal(lista[0].id, idComparacao);
    assert.equal(lista[0].status, "CHANGED");
  });

  testar("O resultado original da comparação é preservado", () => {
    const lista = banco.listarComparacoesFonte(url);

    assert.deepEqual(lista[0].resultado, comparacao);
  });

  testar("A mesma comparação não é duplicada", () => {
    const segundoId = banco.salvarComparacao(dadosComparacao);

    assert.equal(segundoId, idComparacao);
    assert.equal(banco.listarComparacoesFonte(url).length, 1);
  });

  const avaliacao = {
    status: "CLASSIFICADO",
    nivel: "ALTO",
    motivos: [
      "Foi identificada uma mudança no indicador de preço."
    ],
    sinais_detectados: ["preco"]
  };

  const dadosAvaliacao = {
    comparacao_id: idComparacao,
    metodo: "regras_heuristicas",
    versao_regra: "1.0.0",
    avaliacao
  };

  const idAvaliacao = banco.salvarAvaliacaoImpacto(
    dadosAvaliacao
  );

  testar("A avaliação é persistida separadamente", () => {
    const lista = banco.listarAvaliacoesImpacto(idComparacao);

    assert.equal(lista.length, 1);
    assert.equal(lista[0].id, idAvaliacao);
    assert.equal(lista[0].nivel_estimado, "ALTO");
  });

  testar("A avaliação preserva sua natureza estimativa", () => {
    const lista = banco.listarAvaliacoesImpacto(idComparacao);

    assert.deepEqual(lista[0].avaliacao, avaliacao);
    assert.equal(lista[0].metodo, "regras_heuristicas");
    assert.equal(lista[0].versao_regra, "1.0.0");
  });

  testar("Uma nova versão de regra pode gerar outra avaliação", () => {
    banco.salvarAvaliacaoImpacto({
      comparacao_id: idComparacao,
      metodo: "regras_heuristicas",
      versao_regra: "1.1.0",
      avaliacao: {
        status: "INDETERMINADO",
        nivel: "INDETERMINADO",
        motivos: ["Nova regra exige mais contexto."],
        sinais_detectados: []
      }
    });

    const lista = banco.listarAvaliacoesImpacto(idComparacao);

    assert.equal(lista.length, 2);
    assert.equal(lista[0].versao_regra, "1.0.0");
    assert.equal(lista[1].versao_regra, "1.1.0");
  });

  testar("A mesma versão de regra não gera duplicação", () => {
    const segundoId = banco.salvarAvaliacaoImpacto(
      dadosAvaliacao
    );

    assert.equal(segundoId, idAvaliacao);
    assert.equal(
      banco.listarAvaliacoesImpacto(idComparacao).length,
      2
    );
  });

  testar("Uma comparação não aceita evidências de URLs diferentes", () => {
    assert.throws(() => {
      banco.salvarComparacao({
        ...dadosComparacao,
        url: "https://outra-fonte.com"
      });
    }, /não pertencem à URL/);
  });

  testar("Uma avaliação não aceita comparação inexistente", () => {
    assert.throws(() => {
      banco.salvarAvaliacaoImpacto({
        ...dadosAvaliacao,
        comparacao_id: "id-inexistente"
      });
    }, /não foi encontrada/);
  });

  testar("O conteúdo das evidências originais permanece intacto", () => {
    const historicoDepois = banco.listarHistoricoFonte(url);

    assert.equal(
      historicoDepois[0].conteudo,
      "O produto custa R$ 100 e está disponível."
    );

    assert.equal(
      historicoDepois[1].conteudo,
      "O produto custa R$ 120 e está disponível."
    );
  });

const totalEsperado = 12;

console.log(`\nResultado: ${testes}/${totalEsperado} testes passaram.`);

assert.equal(
  testes,
  totalEsperado,
  `Quantidade incorreta de testes: esperados ${totalEsperado}, executados ${testes}.`
);

} finally {
  banco.fechar();
}
