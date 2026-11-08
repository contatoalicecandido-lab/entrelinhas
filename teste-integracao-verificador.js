require("dotenv").config();

const assert = require("node:assert/strict");

const { verificarTexto } = require("./src/verificador");
const { criarBanco } = require("./src/banco");

function conferirRastreabilidadeModelo(registros) {
  assert.ok(
    Array.isArray(registros),
    "A rastreabilidade do Bifrost precisa ser um array."
  );

  assert.ok(
    registros.length > 0,
    "Nenhuma chamada ao Bifrost foi registrada."
  );

  for (const chamada of registros) {
    assert.ok(chamada.id_chamada, "Chamada sem ID próprio.");
    assert.ok(chamada.id_verificacao, "Chamada sem ID de verificação.");
    assert.ok(chamada.etapa, "Chamada sem etapa.");
    assert.ok(chamada.status, "Chamada sem status.");
    assert.ok(
      chamada.id_requisicao_enviada,
      "Chamada sem ID da requisição enviada."
    );

    assert.ok(
      [
        "SUCESSO",
        "ERRO_HTTP",
        "ERRO",
        "ERRO_TRANSPORTE",
        "TIMEOUT",
        "RESPOSTA_INVALIDA"
      ].includes(chamada.status),
      `Status desconhecido do Bifrost: ${chamada.status}`
    );

    if (chamada.status === "SUCESSO") {
      assert.ok(
        chamada.id_bifrost,
        "Chamada bem-sucedida sem ID retornado pelo Bifrost."
      );

      assert.ok(
        chamada.id_trace,
        "Chamada bem-sucedida sem ID de rastreamento do Bifrost."
      );
    }
  }

  const etapasObrigatorias = [
    "DECOMPOSICAO",
    "CORRESPONDENCIA",
    "CLASSIFICACAO"
  ];

  for (const etapa of etapasObrigatorias) {
    const chamadasDaEtapa = registros.filter(
      chamada => chamada.etapa === etapa
    );

    assert.ok(
      chamadasDaEtapa.length > 0,
      `Nenhuma chamada registrada para ${etapa}.`
    );

    assert.ok(
      chamadasDaEtapa.some(
        chamada => chamada.status === "SUCESSO"
      ),
      `A etapa ${etapa} não possui nenhuma chamada bem-sucedida.`
    );
  }

  const falhas = registros.filter(
    chamada => chamada.status !== "SUCESSO"
  );

  console.log("Rastreabilidade Bifrost: aprovada.");
  console.log("Total de chamadas:", registros.length);
  console.log("Tentativas com falha registradas:", falhas.length);
}

function conferirRastreabilidadePesquisa(registros) {
  assert.ok(
    Array.isArray(registros),
    "A rastreabilidade do Tavily precisa ser uma lista."
  );

  assert.ok(
    registros.length > 0,
    "Nenhum registro de rastreabilidade do Tavily foi encontrado."
  );

  for (const registro of registros) {
    assert.ok(
      registro.id_operacao,
      "Registro Tavily sem id_operacao."
    );

    assert.ok(
      registro.id_verificacao,
      "Registro Tavily sem id_verificacao."
    );

    assert.ok(
      ["BUSCA", "EXTRACAO"].includes(registro.etapa),
      `Etapa Tavily inválida: ${registro.etapa}`
    );

    assert.ok(
      ["SUCESSO", "ERRO", "IGNORADA"].includes(registro.status),
      `Status Tavily inválido: ${registro.status}`
    );

    if (registro.status === "SUCESSO") {
      assert.ok(
        registro.request_id,
        `Registro Tavily da etapa ${registro.etapa} sem request_id.`
      );
    }
  }

  const buscas = registros.filter(
    (registro) => registro.etapa === "BUSCA"
  );

  const extracoes = registros.filter(
    (registro) => registro.etapa === "EXTRACAO"
  );

  assert.ok(buscas.length > 0, "Nenhuma busca Tavily foi registrada.");

  assert.ok(
    extracoes.length > 0,
    "Nenhuma extração Tavily foi registrada."
  );

  assert.ok(
    registros.some((registro) => registro.status === "SUCESSO"),
    "Nenhuma operação Tavily foi concluída com sucesso."
  );

  console.log("Rastreabilidade Tavily: aprovada.");
}


async function main() {
  const banco = criarBanco({ caminho: ":memory:" });

  try {
    const texto =
      "O Node.js é um ambiente de execução de JavaScript.";

    console.log("\n======================================");
    console.log("ENTRELINHAS — TESTE DE INTEGRAÇÃO REAL");
    console.log("======================================");

    console.log("\n1. Executando verificação...");
    console.log("Texto:", texto);

    const resultado = await verificarTexto(texto, {
      maxEvidencias: 1,
      banco
    });

    assert.ok(
      resultado.total_afirmacoes > 0,
      "A decomposição não retornou nenhuma afirmação."
    );

    console.log("\n2. Resultado da verificação:");

    console.log("ID:", resultado.id_verificacao);
    console.log("Total de afirmações:", resultado.total_afirmacoes);

    resultado.afirmacoes.forEach((afirmacao, indice) => {
      console.log(`\nAfirmação ${indice + 1}:`);
      console.log(afirmacao.texto);
      console.log("Tipo:", afirmacao.tipo_afirmacao);
      console.log("Evidências:", afirmacao.evidencias.length);

      afirmacao.evidencias.forEach((evidencia, i) => {
        console.log(`\n  Evidência ${i + 1}:`);
        console.log("  Fonte:", evidencia.fonte.titulo);
        console.log(
          "  Correspondência:",
          evidencia.correspondencia.status
        );
        console.log(
          "  Classificação:",
          evidencia.classificacao.postura
        );
        console.log("  Atualidade:", evidencia.atualidade.status);
      });
    });

    console.log("\n3. Conferindo rastreabilidade do Bifrost...");

    conferirRastreabilidadeModelo(resultado.rastreabilidade_modelo);

    console.log(
      "Chamadas registradas:",
      resultado.rastreabilidade_modelo.length
    );

    console.log("Etapas:");

    for (const etapa of [
      "DECOMPOSICAO",
      "CORRESPONDENCIA",
      "CLASSIFICACAO"
    ]) {
      const quantidade = resultado.rastreabilidade_modelo.filter(
        item => item.etapa === etapa
      ).length;

      console.log(`- ${etapa}: ${quantidade}`);
    }

    console.log("\n4. Conferindo rastreabilidade da Tavily...");

    conferirRastreabilidadePesquisa(resultado.rastreabilidade_pesquisa);

    console.log(
      "Operações registradas:",
      resultado.rastreabilidade_pesquisa.length
    );

    for (const etapa of ["BUSCA", "EXTRACAO"]) {
      const quantidade = resultado.rastreabilidade_pesquisa.filter(
        item => item.etapa === etapa
      ).length;

      console.log(`- ${etapa}: ${quantidade}`);
    }

    console.log("\n5. Conferindo persistência no SQLite...");

    const historico = banco.listarVerificacoes();

    const registro = historico.find(
      item => item.id === resultado.id_verificacao
    );

    assert.ok(
      registro,
      "A verificação não foi encontrada no histórico."
    );

    const recuperada = banco.obterVerificacao(
      resultado.id_verificacao
    );

    assert.ok(
      recuperada,
      "Não foi possível recuperar a verificação."
    );

    assert.ok(
      recuperada.total_afirmacoes > 0,
      "A verificação recuperada não contém afirmações."
    );

    console.log("Verificação encontrada no banco: SIM");
    console.log("ID recuperado:", recuperada.id_verificacao);

    console.log("\n6. Conferindo rastreabilidade recuperada...");

    assert.deepEqual(
      recuperada.rastreabilidade_modelo,
      resultado.rastreabilidade_modelo,
      "Os metadados do Bifrost mudaram após a persistência."
    );

    assert.deepEqual(
      recuperada.rastreabilidade_pesquisa,
      JSON.parse(JSON.stringify(resultado.rastreabilidade_pesquisa)),
      "Os metadados da Tavily mudaram após a persistência."
    );

    conferirRastreabilidadeModelo(
      recuperada.rastreabilidade_modelo
    );

    conferirRastreabilidadePesquisa(
      recuperada.rastreabilidade_pesquisa
    );

    console.log("Metadados do Bifrost preservados: SIM");
    console.log("Metadados da Tavily preservados: SIM");

    console.log("\n======================================");
    console.log("TESTE DE INTEGRAÇÃO APROVADO!");
    console.log("======================================");

  } catch (erro) {
    console.error("\nTESTE NÃO APROVADO:", erro.message);
    process.exitCode = 1;

  } finally {
    banco.fechar();
  }
}

main();