
require("dotenv").config();

const assert = require("node:assert/strict");

const { pesquisarComTavily } = require("../src/tavily");
const { criarBanco } = require("../src/banco");
const {
  compararHistoricoFonte
} = require("../src/comparador-fontes");

const banco = criarBanco({ caminho: ":memory:" });

const PERGUNTA =
  "Node.js official documentation JavaScript runtime environment";

function salvarEvidencia(evidencia, numeroColeta) {
  const resultado = {
    sistema: "Entrelinhas",
    texto_original: PERGUNTA,
    verificado_em: new Date(
      Date.now() + numeroColeta
    ).toISOString(),
    total_afirmacoes: 1,
    afirmacoes: [
      {
        id: `afirmacao_${numeroColeta}`,
        texto: PERGUNTA,
        tipo_afirmacao: "informacao_tecnica",
        erro_busca: null,
        evidencias: [
          {
            fonte: evidencia,
            correspondencia: {
              status: "MATCH",
              justificativa: "Registro técnico do teste de integração."
            },
            classificacao: {
              postura: "SUPPORTS",
              justificativa: "Classificação sintética para testar persistência."
            },
            atualidade: {
              status: "UNVERIFIABLE",
              motivo: "MISSING_SOURCE_DATE"
            }
          }
        ]
      }
    ]
  };

  return banco.salvarVerificacao(resultado);
}

async function coletar() {
  const evidencias = await pesquisarComTavily(PERGUNTA);

  if (!Array.isArray(evidencias) || evidencias.length === 0) {
    throw new Error("A Tavily não retornou evidências.");
  }

  return evidencias;
}

async function main() {
  try {
    console.log("\n======================================");
    console.log("ENTRELINHAS — INTEGRAÇÃO DE FONTES");
    console.log("======================================");

    console.log("\n1. Primeira coleta com Tavily...");

    const primeiraColeta = await coletar();

    console.log("Evidências recebidas:", primeiraColeta.length);

    primeiraColeta.forEach((evidencia, indice) => {
      console.log(`\nFonte ${indice + 1}:`);
      console.log("Título:", evidencia.titulo);
      console.log("URL:", evidencia.url);
      console.log("Tipo:", evidencia.tipo_fonte);
      console.log("Caracteres:", evidencia.conteudo.length);
      console.log(
        "Extração concluída:",
        evidencia.metadados_provedor?.extracao?.concluida ?? false
      );
    });

    console.log("\n2. Segunda coleta com Tavily...");

    const segundaColeta = await coletar();

    console.log("Evidências recebidas:", segundaColeta.length);

    const fontesSegundaColeta = new Map(
      segundaColeta.map(evidencia => [
        evidencia.url,
        evidencia
      ])
    );

    const fontesEmComum = primeiraColeta.filter(
      evidencia => fontesSegundaColeta.has(evidencia.url)
    );

    if (fontesEmComum.length === 0) {
      console.log("\nTESTE INCONCLUSIVO");
      console.log(
        "As duas buscas não retornaram nenhuma URL em comum."
      );
      console.log(
        "A integração com a Tavily foi executada, mas não foi possível comparar versões."
      );
      process.exitCode = 2;
      return;
    }

    const evidenciaAnterior = fontesEmComum[0];
    const evidenciaAtual = fontesSegundaColeta.get(
      evidenciaAnterior.url
    );

    console.log("\nFonte selecionada para comparação:");
    console.log("Título:", evidenciaAtual.titulo);
    console.log("URL:", evidenciaAtual.url);

    console.log("\n3. Salvando as duas coletas no SQLite...");

    const idPrimeira = salvarEvidencia(evidenciaAnterior, 1);
    const idSegunda = salvarEvidencia(evidenciaAtual, 2);

    console.log("Primeira verificação:", idPrimeira);
    console.log("Segunda verificação:", idSegunda);

    console.log("\n4. Conferindo a preservação do conteúdo...");

    const historico = banco.listarHistoricoFonte(
      evidenciaAtual.url
    );

    assert.equal(
      historico.length,
      2,
      "O banco deveria conter as duas coletas da mesma URL."
    );

    assert.equal(
      historico[0].conteudo,
      evidenciaAnterior.conteudo,
      "O conteúdo da primeira coleta não foi preservado."
    );

    assert.equal(
      historico[1].conteudo,
      evidenciaAtual.conteudo,
      "O conteúdo da segunda coleta não foi preservado."
    );

    console.log("Duas coletas encontradas: SIM");
    console.log("Conteúdo original preservado: SIM");

    console.log("\n5. Comparando as versões...");

    const comparacao = compararHistoricoFonte(
      banco,
      evidenciaAtual.url
    );

    console.log("Status:", comparacao.status);
    console.log("Total de coletas:", comparacao.total_coletas);

    if (comparacao.status === "CHANGED") {
      console.log(
        "Trechos removidos:",
        comparacao.detalhamento.trechos_removidos
      );

      console.log(
        "Trechos adicionados:",
        comparacao.detalhamento.trechos_adicionados
      );
    }

    assert.ok(
      ["CHANGED", "UNCHANGED"].includes(comparacao.status),
      "O comparador retornou um status inesperado."
    );

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
