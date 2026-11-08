
const { decomporEmAfirmacoes } = require("./afirmacoes");
const { pesquisarComTavily } = require("./tavily");
const { classificarEvidencia } = require("./classificador");
const { avaliarCorrespondencia } = require("./correspondencia");
const { prepararEvidencia } = require("./preparar-evidencia");
const { criarBanco } = require("./banco");
const { randomUUID } = require("node:crypto");

const {
  avaliarAtualidade,
  VALIDADE_MAX_DIAS
} = require("./atualidade");

const LIMITE_EVIDENCIAS = 3;
const MAX_TENTATIVAS_MODELO = 3;

let bancoPadrao;

function aguardar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function obterTempoDeEspera(erro, tentativa) {
  const mensagem = String(erro?.message || erro);

  const tempoSegundos = mensagem.match(
    /try again in ([\d.]+)s/i
  );

  if (tempoSegundos) {
    return Math.ceil(Number(tempoSegundos[1]) * 1000) + 1000;
  }

  const tempoMilissegundos = mensagem.match(
    /retry_after_ms["']?\s*:\s*(\d+)/i
  );

  if (tempoMilissegundos) {
    return Number(tempoMilissegundos[1]) + 1000;
  }

  return 10000 * tentativa;
}

function erroTemporario(erro) {
  const mensagem = String(erro?.message || erro);

  return (
    /429/.test(mensagem) ||
    /rate_limit_exceeded/i.test(mensagem) ||
    /too many requests/i.test(mensagem)
  );
}

async function executarComRetentativas(funcao) {
  let ultimoErro;

  for (
    let tentativa = 1;
    tentativa <= MAX_TENTATIVAS_MODELO;
    tentativa++
  ) {
    try {
      return await funcao(tentativa);

    } catch (erro) {
      ultimoErro = erro;

      if (
        !erroTemporario(erro) ||
        tentativa === MAX_TENTATIVAS_MODELO
      ) {
        throw erro;
      }

      const espera = obterTempoDeEspera(erro, tentativa);

      console.log(
        `Limite temporário do modelo. Nova tentativa ${tentativa + 1}/${MAX_TENTATIVAS_MODELO} em ${Math.ceil(espera / 1000)} segundos.`
      );

      await aguardar(espera);
    }
  }

  throw ultimoErro;
}

function validarOpcoes(opcoes) {
  if (
    !opcoes ||
    typeof opcoes !== "object" ||
    Array.isArray(opcoes)
  ) {
    throw new Error("As opções de verificação são inválidas.");
  }

  const limite = opcoes.maxEvidencias ?? LIMITE_EVIDENCIAS;

  if (
    !Number.isInteger(limite) ||
    limite < 1 ||
    limite > 5
  ) {
    throw new Error(
      "O limite de evidências precisa ser um inteiro entre 1 e 5."
    );
  }

  const dataReferencia = opcoes.dataReferencia ?? new Date();

  if (
    !(dataReferencia instanceof Date) ||
    Number.isNaN(dataReferencia.getTime())
  ) {
    throw new Error("A data de referência é inválida.");
  }

  const tiposPorAfirmacao = opcoes.tiposPorAfirmacao ?? {};

  if (
    !tiposPorAfirmacao ||
    typeof tiposPorAfirmacao !== "object" ||
    Array.isArray(tiposPorAfirmacao)
  ) {
    throw new Error("Os tipos de afirmação são inválidos.");
  }

  return {
    maxEvidencias: limite,
    dataReferencia,
    tiposPorAfirmacao
  };
}

function obterTipoAfirmacao(afirmacao, tiposPorAfirmacao) {
  const tipo = tiposPorAfirmacao[afirmacao.id];

  if (!tipo) {
    return null;
  }

  if (!Object.hasOwn(VALIDADE_MAX_DIAS, tipo)) {
    throw new Error(
      `Tipo de afirmação inválido para ${afirmacao.id}: ${tipo}`
    );
  }

  return tipo;
}

async function verificarAfirmacao(afirmacao, opcoes) {
  const resultado = {
    id: afirmacao.id,
    texto: afirmacao.texto,
    tipo_afirmacao: null,
    evidencias: [],
    erro_busca: null
  };

  try {
    resultado.tipo_afirmacao = obterTipoAfirmacao(
      afirmacao,
      opcoes.tiposPorAfirmacao
    );
  } catch (erro) {
    resultado.erro_busca = erro.message;
    return resultado;
  }

  let evidenciasEncontradas;

  try {
    evidenciasEncontradas = await pesquisarComTavily(
      afirmacao.texto,
      {
        idVerificacao: opcoes.idVerificacao,
        idAfirmacao: afirmacao.id,
        onMetadata: opcoes.onMetadataPesquisa
      }
    );
  } catch (erro) {
    resultado.erro_busca = erro.message;
    return resultado;
  }

  const evidenciasSelecionadas = evidenciasEncontradas.slice(
    0,
    opcoes.maxEvidencias
  );

  for (const evidencia of evidenciasSelecionadas) {
    let preparacao;
    let correspondencia;
    let classificacao;

    // 1. Prepara a evidência sem alterar a fonte original.

    try {
      preparacao = prepararEvidencia(
        afirmacao.texto,
        evidencia
      );
    } catch (erro) {
      resultado.evidencias.push({
        fonte: evidencia,
        preparacao: {
          motivo_preparacao: "PREPARATION_ERROR",
          erro: erro.message
        },
        correspondencia: {
          status: "ERROR",
          justificativa: "Não foi possível preparar a evidência."
        },
        classificacao: {
          postura: "ERROR",
          justificativa: "A análise não foi executada."
        },
        atualidade: avaliarAtualidade(
          evidencia,
          resultado.tipo_afirmacao,
          opcoes.dataReferencia
        )
      });

      continue;
    }

    const conteudoParaAnalise =
      preparacao.conteudo_para_analise;

    const {
      conteudo_original,
      conteudo_para_analise,
      ...metadadosPreparacao
    } = preparacao;

    // 2. Avalia se a fonte corresponde ao objeto da afirmação.

    try {
      correspondencia = await executarComRetentativas((tentativa) =>
        avaliarCorrespondencia(
          afirmacao.texto,
          conteudoParaAnalise,
          {
            idVerificacao: opcoes.idVerificacao,
            idAfirmacao: afirmacao.id,
            urlEvidencia: evidencia.url ?? null,
            tentativa,
            onMetadata: opcoes.onMetadata
          }
        )
      );

    } catch (erro) {
      correspondencia = {
        status: "ERROR",
        justificativa: erro.message
      };
    }

    // 3. Classifica a postura somente quando há correspondência.

    if (correspondencia.status === "MATCH") {
      try {
        classificacao = await executarComRetentativas((tentativa) =>
          classificarEvidencia(
            afirmacao.texto,
            conteudoParaAnalise,
            {
              idVerificacao: opcoes.idVerificacao,
              idAfirmacao: afirmacao.id,
              urlEvidencia: evidencia.url ?? null,
              tentativa,
              onMetadata: opcoes.onMetadata
            }
          )
        );

      } catch (erro) {
        classificacao = {
          postura: "ERROR",
          justificativa: erro.message
        };
      }

    } else if (
      correspondencia.status === "RELATED_INSUFFICIENT"
    ) {
      classificacao = {
        postura: "INSUFFICIENT",
        justificativa:
          "A fonte tem relação com a afirmação, mas não permite confirmar que trata do mesmo objeto específico."
      };

    } else if (
      correspondencia.status === "UNRELATED"
    ) {
      classificacao = {
        postura: "IRRELEVANT",
        justificativa:
          "A fonte não corresponde ao objeto específico da afirmação."
      };

    } else {
      classificacao = {
        postura: "ERROR",
        justificativa:
          "Não foi possível classificar a evidência porque a correspondência não foi concluída."
      };
    }

    // 4. Avalia a atualidade usando os metadados originais da fonte.

    const atualidade = avaliarAtualidade(
      evidencia,
      resultado.tipo_afirmacao,
      opcoes.dataReferencia
    );

    // 5. Guarda a fonte original e os dados da preparação.

    resultado.evidencias.push({
      fonte: evidencia,
      preparacao: metadadosPreparacao,
      correspondencia,
      classificacao,
      atualidade
    });
  }

  return resultado;
}

async function verificarTexto(texto, opcoes = {}) {
  if (typeof texto !== "string" || texto.trim() === "") {
    throw new Error("O texto precisa ser uma string não vazia.");
  }

  const configuracao = validarOpcoes(opcoes);

  // Usa o banco fornecido ou inicializa o banco padrão sob demanda.
  const bancoExecucao =
    opcoes.banco ?? (bancoPadrao ??= criarBanco());

  if (
    !bancoExecucao ||
    typeof bancoExecucao.salvarVerificacao !== "function"
  ) {
    throw new Error("A instância do banco fornecida é inválida.");
  }

  // O ID nasce antes da primeira chamada ao modelo.

  const idVerificacao = randomUUID();

  // Registros das chamadas ao Bifrost.

  const chamadasModelo = [];

  function registrarChamadaModelo(metadados) {
    chamadasModelo.push(metadados);
  }

  // Registros das operações da Tavily.

  const chamadasPesquisa = [];

  function registrarChamadaPesquisa(metadados) {
    chamadasPesquisa.push(metadados);
  }

  const opcoesExecucao = {
    ...configuracao,
    idVerificacao,
    onMetadata: registrarChamadaModelo,
    onMetadataPesquisa: registrarChamadaPesquisa
  };

  // 1. Decomposição das afirmações.

  const afirmacoes = await decomporEmAfirmacoes(
    texto,
    {
      idVerificacao,
      onMetadata: registrarChamadaModelo
    }
  );

  // 2. Verificação individual de cada afirmação.

  const resultados = [];

  for (const afirmacao of afirmacoes) {
    const resultado = await verificarAfirmacao(
      afirmacao,
      opcoesExecucao
    );

    resultados.push(resultado);
  }

  // 3. Resultado completo, incluindo rastreabilidade.

  const resultadoFinal = {
    sistema: "Entrelinhas",
    id_verificacao: idVerificacao,
    texto_original: texto.trim(),
    verificado_em: new Date().toISOString(),
    total_afirmacoes: resultados.length,
    afirmacoes: resultados,
    rastreabilidade_modelo: chamadasModelo,
    rastreabilidade_pesquisa: chamadasPesquisa
  };

  // 4. Persistência no SQLite.

  const idSalvo = bancoExecucao.salvarVerificacao(resultadoFinal);

  return {
    ...resultadoFinal,
    id_verificacao: idSalvo
  };
}

module.exports = {
  verificarTexto
};
