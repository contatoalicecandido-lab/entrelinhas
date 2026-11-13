
require("dotenv").config();

const fs = require("fs");
const path = require("path");

const benchmarkInicial = require("../dados/benchmark-inicial");
const benchmarkDesafiador = require("../dados/benchmark-desafiador");

const {
  avaliarCorrespondencia
} = require("../src/correspondencia");

const {
  classificarEvidencia
} = require("../src/classificador");

const INTERVALO_ENTRE_CHAMADAS = 11000;

const ARQUIVO_RESULTADOS = path.join(
  path.join(__dirname, ".."),
  "dados",
  "resultado-benchmark.json"
);

let ultimaChamada = 0;
let interromperBenchmark = false;

function aguardar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function identificarBloqueioDeCota(erro) {
  const mensagem = String(erro?.message || erro);

  return (
    /tokens per day/i.test(mensagem) ||
    /TPD/i.test(mensagem) ||
    /daily.*limit/i.test(mensagem) ||
    /daily.*quota/i.test(mensagem) ||
    /quota.*exceeded/i.test(mensagem)
  );
}

function identificarErro429(erro) {
  const mensagem = String(erro?.message || erro);

  return (
    /429/.test(mensagem) ||
    /rate_limit_exceeded/i.test(mensagem) ||
    /too many requests/i.test(mensagem)
  );
}

function carregarResultados() {
  if (!fs.existsSync(ARQUIVO_RESULTADOS)) {
    return {};
  }

  try {
    const conteudo = fs.readFileSync(
      ARQUIVO_RESULTADOS,
      "utf8"
    );

    const dados = JSON.parse(conteudo);

    console.log("\nProgresso anterior encontrado.");
    console.log(
      `Casos registrados: ${Object.keys(dados).length}`
    );

    return dados;

  } catch (erro) {
    console.error(
      "\nNão foi possível ler o arquivo de resultados:",
      erro.message
    );

    throw new Error(
      "Arquivo de progresso inválido. Não será sobrescrito."
    );
  }
}

function salvarResultados(resultados) {
  fs.writeFileSync(
    ARQUIVO_RESULTADOS,
    JSON.stringify(resultados, null, 2),
    "utf8"
  );
}

function resultadoCompativel(resultado, caso) {
  return (
    resultado &&
    resultado.correspondencia_esperada ===
      caso.correspondencia_esperada &&
    resultado.postura_esperada ===
      caso.postura_esperada
  );
}

async function chamarModeloComControle(funcao) {
  const tempoDesdeUltimaChamada =
    Date.now() - ultimaChamada;

  const esperaNecessaria =
    INTERVALO_ENTRE_CHAMADAS - tempoDesdeUltimaChamada;

  if (ultimaChamada > 0 && esperaNecessaria > 0) {
    console.log(
      `Aguardando ${Math.ceil(esperaNecessaria / 1000)} segundos entre chamadas...`
    );

    await aguardar(esperaNecessaria);
  }

  ultimaChamada = Date.now();

  try {
    return await funcao();

  } catch (erro) {
    if (identificarBloqueioDeCota(erro)) {
      const erroCota = new Error(
        "COTA_DIARIA_ESGOTADA: a API atingiu o limite diário de tokens."
      );

      erroCota.codigo = "COTA_DIARIA_ESGOTADA";

      throw erroCota;
    }

    if (identificarErro429(erro)) {
      const erroLimite = new Error(
        "LIMITE_API: a API recusou a chamada por limite de uso. O benchmark será pausado para evitar esperas longas."
      );

      erroLimite.codigo = "LIMITE_API";

      throw erroLimite;
    }

    throw erro;
  }
}

function calcularMetricas(resultados, campoReal, campoEsperado) {
  const avaliados = resultados.filter(
    resultado => resultado[campoReal] !== null
  );

  const acertos = avaliados.filter(
    resultado => resultado[campoReal] === resultado[campoEsperado]
  ).length;

  return {
    total_casos: resultados.length,
    avaliados: avaliados.length,
    nao_avaliados: resultados.length - avaliados.length,
    acertos,
    erros: avaliados.length - acertos,
    acuracia: avaliados.length > 0
      ? Number((acertos / avaliados.length * 100).toFixed(2))
      : null
  };
}


async function executarCaso(caso, resultadosSalvos) {
  console.log(`\nExecutando ${caso.id} — ${caso.categoria}`);

  const resultadoAnterior = resultadosSalvos[caso.id];

  const resultado = resultadoCompativel(resultadoAnterior, caso)
    ? { ...resultadoAnterior }
    : {
        id: caso.id,
        categoria: caso.categoria,

        correspondencia_esperada: caso.correspondencia_esperada,
        postura_esperada: caso.postura_esperada,

        correspondencia_obtida: null,
        postura_obtida: null,

        acertou_correspondencia: null,
        acertou_postura: null,

        erro: null
      };

  try {
    // Reutiliza a correspondência se ela já foi concluída.
    if (resultado.correspondencia_obtida === null) {
      const correspondencia = await chamarModeloComControle(() =>
        avaliarCorrespondencia(
          caso.afirmacao,
          caso.evidencia
        )
      );

      resultado.correspondencia_obtida = correspondencia.status;

      resultado.acertou_correspondencia =
        correspondencia.status === caso.correspondencia_esperada;
    }

    // Só classifica quando a correspondência é MATCH.
    if (
      resultado.correspondencia_obtida === "MATCH" &&
      resultado.postura_obtida === null
    ) {
      const classificacao = await chamarModeloComControle(() =>
        classificarEvidencia(
          caso.afirmacao,
          caso.evidencia
        )
      );

      resultado.postura_obtida = classificacao.postura;
    }

    if (
      resultado.correspondencia_obtida === "RELATED_INSUFFICIENT"
    ) {
      resultado.postura_obtida = "INSUFFICIENT";
    }

    if (
      resultado.correspondencia_obtida === "UNRELATED"
    ) {
      resultado.postura_obtida = "IRRELEVANT";
    }

    resultado.erro = null;

  } catch (erro) {
    resultado.erro = erro.message;

    if (
      erro.codigo === "COTA_DIARIA_ESGOTADA" ||
      erro.codigo === "LIMITE_API"
    ) {
      interromperBenchmark = true;
    }
  }

  resultado.acertou_correspondencia =
    resultado.correspondencia_obtida !== null
      ? resultado.correspondencia_obtida ===
        resultado.correspondencia_esperada
      : null;

  resultado.acertou_postura =
    resultado.postura_obtida !== null
      ? resultado.postura_obtida === resultado.postura_esperada
      : null;

  resultadosSalvos[caso.id] = resultado;
  salvarResultados(resultadosSalvos);

  console.log(
    `Correspondência: ${resultado.correspondencia_obtida || "NÃO AVALIADA"} | Esperado: ${caso.correspondencia_esperada} | ${
      resultado.acertou_correspondencia === null
        ? "SEM RESULTADO"
        : resultado.acertou_correspondencia
          ? "PASSOU"
          : "FALHOU"
    }`
  );

  console.log(
    `Postura: ${resultado.postura_obtida || "NÃO AVALIADA"} | Esperado: ${caso.postura_esperada} | ${
      resultado.acertou_postura === null
        ? "SEM RESULTADO"
        : resultado.acertou_postura
          ? "PASSOU"
          : "FALHOU"
    }`
  );

  if (resultado.erro) {
    console.log("Erro de execução:", resultado.erro);
  }

  return resultado;
}

async function executarBenchmark(nome, casos, resultadosSalvos) {
  console.log("\n======================================");
  console.log(`BENCHMARK: ${nome}`);
  console.log("======================================");

  console.log(`Total de casos: ${casos.length}`);

  const resultados = [];

  for (const caso of casos) {
    if (interromperBenchmark) {
      break;
    }

    const resultadoSalvo = resultadosSalvos[caso.id];

    if (resultadoCompativel(resultadoSalvo, caso)) {
      const casoCompleto =
        resultadoSalvo.correspondencia_obtida !== null &&
        resultadoSalvo.postura_obtida !== null &&
        resultadoSalvo.erro === null;

      if (casoCompleto) {
        console.log(
          `\n${caso.id} — Resultado anterior reutilizado.`
        );

        resultados.push(resultadoSalvo);
        continue;
      }
    }

    const resultado = await executarCaso(
      caso,
      resultadosSalvos
    );

    resultados.push(resultado);
  }

  return resultados;
}

function consolidarResultados(suites, resultadosSalvos) {
  return suites.flatMap(suite =>
    suite.casos.map(caso => {
      const resultado = resultadosSalvos[caso.id];

      if (resultadoCompativel(resultado, caso)) {
        return resultado;
      }

      return {
        id: caso.id,
        categoria: caso.categoria,

        correspondencia_esperada: caso.correspondencia_esperada,
        postura_esperada: caso.postura_esperada,

        correspondencia_obtida: null,
        postura_obtida: null,

        acertou_correspondencia: null,
        acertou_postura: null,

        erro: null
      };
    })
  );
}

async function main() {
  const suites = [
    {
      nome: "INICIAL",
      casos: benchmarkInicial
    },
    {
      nome: "DESAFIADOR",
      casos: benchmarkDesafiador
    }
  ];

  const resultadosSalvos = carregarResultados();

  const totalCasos = suites.reduce(
    (total, suite) => total + suite.casos.length,
    0
  );

  console.log("\n======================================");
  console.log("ENTRELINHAS — BENCHMARK COMPLETO");
  console.log("======================================");

  console.log(`Conjuntos: ${suites.length}`);
  console.log(`Total de casos: ${totalCasos}`);

  console.log(
    `Intervalo mínimo entre chamadas: ${INTERVALO_ENTRE_CHAMADAS / 1000} segundos`
  );

  for (const suite of suites) {
    await executarBenchmark(
      suite.nome,
      suite.casos,
      resultadosSalvos
    );

    if (interromperBenchmark) {
      break;
    }
  }

  salvarResultados(resultadosSalvos);

  const todosResultados = consolidarResultados(
    suites,
    resultadosSalvos
  );

  console.log("\n======================================");
  console.log("CONSOLIDADO GERAL");
  console.log("======================================");

  console.log("\nCorrespondência:");
  console.log(
    calcularMetricas(
      todosResultados,
      "correspondencia_obtida",
      "correspondencia_esperada"
    )
  );

  console.log("\nClassificação:");
  console.log(
    calcularMetricas(
      todosResultados,
      "postura_obtida",
      "postura_esperada"
    )
  );

  const errosExecucao = todosResultados.filter(
    resultado => resultado.erro !== null
  );

  const casosConcluidos = todosResultados.filter(
    resultado =>
      resultado.erro === null &&
      resultado.correspondencia_obtida !== null &&
      resultado.postura_obtida !== null
  );

  console.log("\n======================================");

  if (interromperBenchmark) {
    console.log("BENCHMARK PAUSADO");
    console.log("======================================");

    console.log(
      "A API atingiu um limite de uso. Nenhuma nova chamada será realizada nesta execução."
    );

    console.log(
      "Os resultados concluídos foram salvos e serão reutilizados na próxima execução."
    );

  } else {
    console.log("BENCHMARK CONCLUÍDO");
    console.log("======================================");
  }

  console.log(`Casos concluídos: ${casosConcluidos.length}/${totalCasos}`);
  console.log(`Erros de execução: ${errosExecucao.length}`);

  console.log(
    `Arquivo de progresso: ${ARQUIVO_RESULTADOS}`
  );

  console.log(
    "Atenção: casos não avaliados não entram no cálculo de acurácia."
  );
}

main().catch(erro => {
  console.error("\nFalha ao executar o benchmark:");
  console.error(erro);
  process.exitCode = 1;
});
