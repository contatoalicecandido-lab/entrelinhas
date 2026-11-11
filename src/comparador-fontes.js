const { createHash } = require("node:crypto");

const {
  normalizarFonte,
  VERSAO_NORMALIZACAO
} = require("./normalizar-fonte");

const {
  avaliarImpacto
} = require("./avaliador-impacto");

// Limites para controlar o custo da comparação.
const LIMITE_TOKENS_DIFF = 1200;
const LIMITE_TOKENS_CONTEXTO = 5;
const LIMITE_TOKENS_ENTRE_ALTERACOES = 1;

// Identificação estável da versão do comparador.
const ALGORITMO_COMPARACAO = "SHA256+LCS";
const VERSAO_ALGORITMO = "1.2.0";
const METODO_AVALIACAO_IMPACTO = "HEURISTICO_REGRAS";
const VERSAO_REGRA_IMPACTO = "1.0.0";

/*
 * Mantida para compatibilidade com chamadas anteriores.
 * O comparador utiliza obterNormalizacaoColeta para comparar
 * os conteúdos com a nova regra de normalização.
 */
function normalizarConteudo(conteudo) {
  if (typeof conteudo !== "string" || conteudo.trim() === "") {
    return null;
  }

  return conteudo
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();
}

function obterNormalizacaoColeta(coleta) {
  const fonte = coleta?.fonte ?? {};
  const normalizacaoPersistida =
    fonte.normalizacao ?? coleta?.normalizacao ?? null;

  const versaoPersistida =
    normalizacaoPersistida?.versao ?? null;

  if (
    normalizacaoPersistida?.status === "NORMALIZED" &&
    versaoPersistida === VERSAO_NORMALIZACAO &&
    typeof normalizacaoPersistida.conteudo_normalizado === "string" &&
    normalizacaoPersistida.conteudo_normalizado.trim() !== ""
  ) {
    return {
      conteudo: normalizacaoPersistida.conteudo_normalizado,
      origem: "PERSISTED",
      versao: VERSAO_NORMALIZACAO,
      versao_persistida: versaoPersistida
    };
  }

  const resultado = normalizarFonte(coleta?.conteudo);

  if (
    resultado.status !== "NORMALIZED" ||
    typeof resultado.conteudo_normalizado !== "string" ||
    resultado.conteudo_normalizado.trim() === ""
  ) {
    return {
      conteudo: null,
      origem: "REGENERATED",
      versao: VERSAO_NORMALIZACAO,
      versao_persistida: versaoPersistida
    };
  }

  return {
    conteudo: resultado.conteudo_normalizado,
    origem: "REGENERATED",
    versao: VERSAO_NORMALIZACAO,
    versao_persistida: versaoPersistida
  };
}

function obterMetadadosNormalizacao(anterior, atual) {
  return {
    versao_normalizacao: VERSAO_NORMALIZACAO,
    origem_normalizacao: {
      anterior: anterior.origem,
      atual: atual.origem
    },
    versoes_normalizacao_origem: {
      anterior: anterior.versao_persistida,
      atual: atual.versao_persistida
    }
  };
}

/*
 * Obtém a data da coleta considerando tanto o formato
 * direto do histórico quanto o objeto de coleta aninhado.
 */
function obterDataColeta(registro) {
  return registro?.coletado_em ??
    registro?.coleta?.coletado_em ??
    null;
}

/*
 * Aceita datas ISO 8601 completas com indicação de fuso horário.
 * Também verifica os componentes da data para impedir que datas
 * impossíveis sejam aceitas por normalizações automáticas do JavaScript.
 */
function interpretarDataColeta(valor) {
  if (
    typeof valor !== "string" ||
    valor.trim() === ""
  ) {
    return null;
  }

  const correspondencia = valor.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/
  );

  if (!correspondencia) {
    return null;
  }

  const ano = Number(correspondencia[1]);
  const mes = Number(correspondencia[2]);
  const dia = Number(correspondencia[3]);
  const hora = Number(correspondencia[4]);
  const minuto = Number(correspondencia[5]);
  const segundo = Number(correspondencia[6]);
  const fuso = correspondencia[8];

  if (
    mes < 1 ||
    mes > 12 ||
    hora > 23 ||
    minuto > 59 ||
    segundo > 59
  ) {
    return null;
  }

  const dataCalendario = new Date(Date.UTC(ano, mes - 1, dia));

  if (
    dataCalendario.getUTCFullYear() !== ano ||
    dataCalendario.getUTCMonth() !== mes - 1 ||
    dataCalendario.getUTCDate() !== dia
  ) {
    return null;
  }

  if (fuso !== "Z") {
    const horasFuso = Number(fuso.slice(1, 3));
    const minutosFuso = Number(fuso.slice(4, 6));

    if (
      horasFuso > 23 ||
      minutosFuso > 59
    ) {
      return null;
    }
  }

  const timestamp = Date.parse(valor);

  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return timestamp;
}

/*
 * Valida se existe uma ordem temporal confiável entre as duas coletas.
 */
function validarOrdemTemporal(anterior, atual) {
  const dataAnteriorOriginal = obterDataColeta(anterior);
  const dataAtualOriginal = obterDataColeta(atual);

  const timestampAnterior =
    interpretarDataColeta(dataAnteriorOriginal);

  const timestampAtual =
    interpretarDataColeta(dataAtualOriginal);

  if (
    timestampAnterior === null ||
    timestampAtual === null
  ) {
    return {
      valida: false,
      status: "NOT_COMPUTED_INVALID_DATE",
      justificativa:
        "Uma ou ambas as coletas não possuem uma data ISO 8601 válida e interpretável."
    };
  }

  if (timestampAtual <= timestampAnterior) {
    return {
      valida: false,
      status: "NOT_COMPUTED_UNORDERABLE_DATE",
      justificativa:
        "Não foi possível confirmar uma ordem temporal válida: a coleta atual precisa ser posterior à coleta anterior."
    };
  }

  return {
    valida: true,
    timestamp_anterior: timestampAnterior,
    timestamp_atual: timestampAtual
  };
}

function gerarHash(conteudo) {
  return createHash("sha256")
    .update(conteudo, "utf8")
    .digest("hex");
}

function tokenizar(conteudo) {
  return conteudo.match(/\n+|[^\s]+/g) ?? [];
}

function agruparTokens(tokens) {
  if (tokens.length === 0) {
    return [];
  }

  return [tokens.join(" ")];
}

function agruparAlteracoes(operacoes) {
  const removidos = [];
  const adicionados = [];
  const alteracoes = [];

  let indice = 0;

  while (indice < operacoes.length) {
    if (operacoes[indice].tipo === "IGUAL") {
      indice++;
      continue;
    }

    const inicio = indice;
    let cursor = indice;

    while (cursor < operacoes.length) {
      while (
        cursor < operacoes.length &&
        operacoes[cursor].tipo !== "IGUAL"
      ) {
        cursor++;
      }

      if (cursor >= operacoes.length) {
        break;
      }

      let proximaAlteracao = cursor;

      while (
        proximaAlteracao < operacoes.length &&
        operacoes[proximaAlteracao].tipo === "IGUAL"
      ) {
        proximaAlteracao++;
      }

      const quantidadeIguais = proximaAlteracao - cursor;
      const existeOutraAlteracao = proximaAlteracao < operacoes.length;

      if (
        existeOutraAlteracao &&
        quantidadeIguais <= LIMITE_TOKENS_ENTRE_ALTERACOES
      ) {
        cursor = proximaAlteracao;
        continue;
      }

      break;
    }

    const fim = cursor;
    const segmento = operacoes.slice(inicio, fim);

    const tokensRemovidos = segmento
      .filter(item => item.tipo === "REMOVIDO")
      .map(item => item.token);

    const tokensAdicionados = segmento
      .filter(item => item.tipo === "ADICIONADO")
      .map(item => item.token);

    const tokensAnteriores = segmento
      .filter(item => item.tipo !== "ADICIONADO")
      .map(item => item.token);

    const tokensAtuais = segmento
      .filter(item => item.tipo !== "REMOVIDO")
      .map(item => item.token);

    removidos.push(...tokensRemovidos);
    adicionados.push(...tokensAdicionados);

    const contextoAntes = operacoes
      .slice(0, inicio)
      .filter(item => item.tipo === "IGUAL")
      .slice(-LIMITE_TOKENS_CONTEXTO)
      .map(item => item.token);

    const contextoDepois = operacoes
      .slice(fim)
      .filter(item => item.tipo === "IGUAL")
      .slice(0, LIMITE_TOKENS_CONTEXTO)
      .map(item => item.token);

    const trechoAnterior = [
      ...contextoAntes,
      ...tokensAnteriores,
      ...contextoDepois
    ].join(" ");

    const trechoAtual = [
      ...contextoAntes,
      ...tokensAtuais,
      ...contextoDepois
    ].join(" ");

    const alteracao = {
      tipo: "ALTERACAO_TEXTUAL",
      trechos_removidos: tokensRemovidos.length
        ? [tokensRemovidos.join(" ")]
        : [],
      trechos_adicionados: tokensAdicionados.length
        ? [tokensAdicionados.join(" ")]
        : [],
      contexto_antes: contextoAntes.join(" "),
      contexto_depois: contextoDepois.join(" "),
      trecho_anterior_contextualizado: trechoAnterior,
      trecho_atual_contextualizado: trechoAtual
    };

    alteracao.impacto = avaliarImpacto(alteracao);

    alteracoes.push(alteracao);

    indice = fim;
  }

  return {
    trechos_removidos: agruparTokens(removidos),
    trechos_adicionados: agruparTokens(adicionados),
    alteracoes
  };
}

function calcularDiferencas(conteudoAnterior, conteudoAtual) {
  const normalizacaoAnterior = normalizarFonte(conteudoAnterior);
  const normalizacaoAtual = normalizarFonte(conteudoAtual);

  if (
    normalizacaoAnterior.status !== "NORMALIZED" ||
    normalizacaoAtual.status !== "NORMALIZED"
  ) {
    return {
      status: "NOT_COMPUTED_INVALID_CONTENT",
      justificativa:
        "Não foi possível calcular as diferenças porque um ou ambos os conteúdos não possuem texto suficiente.",
      trechos_removidos: [],
      trechos_adicionados: [],
      alteracoes: []
    };
  }

  const textoAnterior =
    normalizacaoAnterior.conteudo_normalizado;

  const textoAtual =
    normalizacaoAtual.conteudo_normalizado;

  const tokensAnteriores = tokenizar(textoAnterior);
  const tokensAtuais = tokenizar(textoAtual);

  if (
    tokensAnteriores.length > LIMITE_TOKENS_DIFF ||
    tokensAtuais.length > LIMITE_TOKENS_DIFF
  ) {
    return {
      status: "NOT_COMPUTED_LIMIT",
      justificativa:
        "O conteúdo ultrapassou o limite de tokens definido para comparação detalhada. A mudança foi detectada pelos hashes, mas os trechos não foram calculados.",
      limite_tokens: LIMITE_TOKENS_DIFF,
      tokens_anterior: tokensAnteriores.length,
      tokens_atual: tokensAtuais.length,
      trechos_removidos: [],
      trechos_adicionados: [],
      alteracoes: []
    };
  }

  const quantidadeAnterior = tokensAnteriores.length;
  const quantidadeAtual = tokensAtuais.length;
  const colunas = quantidadeAtual + 1;

  const matriz = new Uint32Array(
    (quantidadeAnterior + 1) * colunas
  );

  for (let i = quantidadeAnterior - 1; i >= 0; i--) {
    for (let j = quantidadeAtual - 1; j >= 0; j--) {
      const indice = i * colunas + j;

      if (tokensAnteriores[i] === tokensAtuais[j]) {
        matriz[indice] =
          1 + matriz[(i + 1) * colunas + (j + 1)];
      } else {
        matriz[indice] = Math.max(
          matriz[(i + 1) * colunas + j],
          matriz[i * colunas + (j + 1)]
        );
      }
    }
  }

  const operacoes = [];
  let i = 0;
  let j = 0;

  while (i < quantidadeAnterior && j < quantidadeAtual) {
    if (tokensAnteriores[i] === tokensAtuais[j]) {
      operacoes.push({
        tipo: "IGUAL",
        token: tokensAnteriores[i]
      });
      i++;
      j++;
    } else if (
      matriz[(i + 1) * colunas + j] >=
      matriz[i * colunas + (j + 1)]
    ) {
      operacoes.push({
        tipo: "REMOVIDO",
        token: tokensAnteriores[i]
      });
      i++;
    } else {
      operacoes.push({
        tipo: "ADICIONADO",
        token: tokensAtuais[j]
      });
      j++;
    }
  }

  while (i < quantidadeAnterior) {
    operacoes.push({
      tipo: "REMOVIDO",
      token: tokensAnteriores[i]
    });
    i++;
  }

  while (j < quantidadeAtual) {
    operacoes.push({
      tipo: "ADICIONADO",
      token: tokensAtuais[j]
    });
    j++;
  }

  const diferencas = agruparAlteracoes(operacoes);

  return {
    status: "COMPLETO",
    algoritmo: "LCS",
    limite_tokens: LIMITE_TOKENS_DIFF,
    tokens_anterior: quantidadeAnterior,
    tokens_atual: quantidadeAtual,
    ...diferencas
  };
}

function obterIdComparacao(resultado) {
  if (typeof resultado === "number" || typeof resultado === "string") {
    return resultado;
  }

  if (resultado && typeof resultado === "object") {
    return (
      resultado.id_comparacao ??
      resultado.lastInsertRowid ??
      resultado.id ??
      null
    );
  }

  return null;
}

function persistirComparacao(banco, dados) {
  if (typeof banco.salvarComparacao !== "function") {
    throw new Error("O banco não possui o método salvarComparacao.");
  }

  const resultadoBanco = banco.salvarComparacao({
    url: dados.url,
    id_evidencia_anterior: dados.id_evidencia_anterior,
    id_evidencia_atual: dados.id_evidencia_atual,
    algoritmo: ALGORITMO_COMPARACAO,
    versao_algoritmo: VERSAO_ALGORITMO,
    resultado: dados.resultado
  });

  const idComparacao = obterIdComparacao(resultadoBanco);

  let persistenciaImpacto = {
    status: "NOT_APPLICABLE",
    justificativa:
      "Não há avaliações de impacto aplicáveis a esta comparação."
  };

  const detalhamento = dados.resultado?.detalhamento;

  const podePersistirImpacto =
    dados.resultado?.status === "CHANGED" &&
    detalhamento?.status === "COMPLETO" &&
    Array.isArray(detalhamento.alteracoes) &&
    detalhamento.alteracoes.length > 0;

  if (podePersistirImpacto) {
    if (
      typeof idComparacao !== "string" ||
      !idComparacao.trim()
    ) {
      persistenciaImpacto = {
        status: "NOT_PERSISTED",
        justificativa:
          "Não foi possível obter um ID válido da comparação."
      };
    } else if (typeof banco.salvarAvaliacaoImpacto !== "function") {
      persistenciaImpacto = {
        status: "NOT_PERSISTED",
        justificativa:
          "O banco não possui o método salvarAvaliacaoImpacto."
      };
    } else {
      const avaliacoes = detalhamento.alteracoes.map(
        (alteracao, indice) => ({
          indice_alteracao: indice,
          tipo: alteracao.tipo,
          trechos_removidos: alteracao.trechos_removidos,
          trechos_adicionados: alteracao.trechos_adicionados,
          impacto: alteracao.impacto
        })
      );

      const classificadas = avaliacoes.filter(
        item => item.impacto?.status === "CLASSIFICADO"
      );

      const indeterminadas =
        avaliacoes.length - classificadas.length;

      const statusConsolidado =
        classificadas.length === 0
          ? "INDETERMINADO"
          : indeterminadas === 0
            ? "CLASSIFICADO"
            : "PARCIALMENTE_CLASSIFICADO";

      const niveis = ["ALTO", "MEDIO", "BAIXO"];

      const nivelConsolidado =
        niveis.find(nivel =>
          classificadas.some(
            item => item.impacto?.nivel === nivel
          )
        ) ?? "INDETERMINADO";

      const avaliacaoConsolidada = {
        status: statusConsolidado,
        nivel: nivelConsolidado,
        quantidade_alteracoes: avaliacoes.length,
        quantidade_classificadas: classificadas.length,
        quantidade_indeterminadas: indeterminadas,
        avaliacoes
      };

      const idAvaliacao = banco.salvarAvaliacaoImpacto({
        comparacao_id: idComparacao,
        metodo: METODO_AVALIACAO_IMPACTO,
        versao_regra: VERSAO_REGRA_IMPACTO,
        avaliacao: avaliacaoConsolidada
      });

      persistenciaImpacto = {
        status: "PERSISTED",
        id_avaliacao: idAvaliacao,
        metodo: METODO_AVALIACAO_IMPACTO,
        versao_regra: VERSAO_REGRA_IMPACTO,
        quantidade_avaliacoes: avaliacoes.length
      };
    }
  }

  return {
    ...dados.resultado,
    id_comparacao: idComparacao,
    persistencia: {
      status: "PERSISTED",
      algoritmo: ALGORITMO_COMPARACAO,
      versao_algoritmo: VERSAO_ALGORITMO
    },
    persistencia_impacto: persistenciaImpacto
  };
}

function montarResultadoSemPersistencia(resultado, justificativa) {
  return {
    ...resultado,
    persistencia: {
      status: "NOT_PERSISTED",
      justificativa
    }
  };
}

function montarResultadoNaoComparavel(dadosBase, validacaoTemporal) {
  return {
    status: "NOT_COMPARABLE",
    justificativa: validacaoTemporal.justificativa,
    ...dadosBase,
    detalhamento: {
      status: validacaoTemporal.status,
      justificativa: validacaoTemporal.justificativa
    },
    persistencia: {
      status: "NOT_PERSISTED",
      justificativa:
        "Comparações sem identidade de fonte ou ordem temporal confiável não são registradas como válidas."
    }
  };
}

function validarCompatibilidadeUrlCanonica(anterior, atual) {
  function normalizarUrl(valor) {
    if (typeof valor !== "string" || valor.trim() === "") {
      return null;
    }

    try {
      const url = new URL(valor);
      if (!["http:", "https:"].includes(url.protocol)) {
        return null;
      }
      return url.toString();
    } catch {
      return null;
    }
  }

  const canonicaAnterior = anterior?.coleta?.url_canonica;
  const canonicaAtual = atual?.coleta?.url_canonica;
  const ambasLegadas =
    canonicaAnterior == null && canonicaAtual == null;

  // Registros legados não armazenavam metadados de coleta. Quando ambos
  // são legados, a URL registrada na evidência é a única identidade comum
  // disponível; não se cria ID de coleta nem se mistura legado com coleta nova.
  const urlAnterior = ambasLegadas
    ? normalizarUrl(anterior?.url)
    : normalizarUrl(canonicaAnterior);
  const urlAtual = ambasLegadas
    ? normalizarUrl(atual?.url)
    : normalizarUrl(canonicaAtual);

  if (!urlAnterior || !urlAtual) {
    return {
      valida: false,
      status: "NOT_COMPUTED_INVALID_CANONICAL_URL",
      justificativa:
        "Uma ou ambas as coletas não possuem URL canônica HTTP(S) válida. Não é possível confirmar que representam a mesma fonte."
    };
  }

  if (urlAnterior !== urlAtual) {
    return {
      valida: false,
      status: "NOT_COMPUTED_INCOMPATIBLE_CANONICAL_URL",
      justificativa:
        "As coletas possuem URLs canônicas diferentes. Não é seguro comparar seus conteúdos como versões da mesma fonte."
    };
  }

  return { valida: true };
}


function normalizarParametrosBusca(parametros) {
  if (
    !parametros ||
    typeof parametros !== "object" ||
    Array.isArray(parametros)
  ) {
    return null;
  }

  function ordenarChaves(valor) {
    if (Array.isArray(valor)) {
      return valor.map(ordenarChaves);
    }

    if (valor && typeof valor === "object") {
      return Object.keys(valor)
        .sort()
        .reduce((resultado, chave) => {
          resultado[chave] = ordenarChaves(valor[chave]);
          return resultado;
        }, {});
    }

    return valor;
  }

  return JSON.stringify(ordenarChaves(parametros));
}

function validarCompatibilidadeBusca(anterior, atual) {
  const consultaAnterior =
    typeof anterior?.consulta === "string"
      ? anterior.consulta.trim()
      : "";

  const consultaAtual =
    typeof atual?.consulta === "string"
      ? atual.consulta.trim()
      : "";

  const parametrosAnterior = anterior?.parametros_busca;
  const parametrosAtual = atual?.parametros_busca;

  if (!consultaAnterior || !consultaAtual) {
    return {
      valida: false,
      justificativa:
        "Uma ou ambas as coletas de busca não possuem consulta registrada. Não é possível comprovar a compatibilidade dos snippets."
    };
  }

  if (consultaAnterior !== consultaAtual) {
    return {
      valida: false,
      justificativa:
        "As coletas de busca utilizaram consultas diferentes. Os snippets não podem ser interpretados como evolução temporal da mesma busca."
    };
  }

  if (
    !parametrosAnterior ||
    !parametrosAtual ||
    typeof parametrosAnterior !== "object" ||
    typeof parametrosAtual !== "object" ||
    Array.isArray(parametrosAnterior) ||
    Array.isArray(parametrosAtual)
  ) {
    return {
      valida: false,
      justificativa:
        "Uma ou ambas as coletas não possuem parâmetros de busca válidos. Não é possível comprovar a compatibilidade dos snippets."
    };
  }

  if (
    typeof parametrosAnterior.query !== "string" ||
    typeof parametrosAtual.query !== "string" ||
    parametrosAnterior.query.trim() !== consultaAnterior ||
    parametrosAtual.query.trim() !== consultaAtual
  ) {
    return {
      valida: false,
      justificativa:
        "A consulta registrada não corresponde à consulta armazenada nos parâmetros de busca."
    };
  }

  const assinaturaAnterior =
    normalizarParametrosBusca(parametrosAnterior);

  const assinaturaAtual =
    normalizarParametrosBusca(parametrosAtual);

  if (assinaturaAnterior !== assinaturaAtual) {
    return {
      valida: false,
      justificativa:
        "As coletas utilizaram parâmetros de busca diferentes. Não é seguro interpretar a diferença entre snippets como evolução temporal da fonte."
    };
  }

  return {
    valida: true,
    justificativa:
      "As consultas e os parâmetros de busca são compatíveis."
  };
}

function montarResultadoBuscaNaoComparavel(dadosBase, justificativa) {
  return {
    status: "NOT_COMPARABLE",
    justificativa,
    ...dadosBase,
    tipo_fonte_anterior: "tavily_search",
    tipo_fonte_atual: "tavily_search",
    detalhamento: {
      status: "NOT_COMPUTED_INCOMPATIBLE_SEARCH",
      justificativa
    },
    persistencia: {
      status: "NOT_PERSISTED",
      justificativa:
        "Coletas com consultas ou parâmetros de busca incompatíveis não são registradas como comparações válidas."
    }
  };
}

function compararHistoricoFonte(banco, url) {
  if (!banco || typeof banco.listarHistoricoFonte !== "function") {
    throw new Error("A conexão com o histórico do banco é inválida.");
  }

  if (typeof url !== "string" || url.trim() === "") {
    throw new Error("Uma URL válida é necessária.");
  }

  const historico = banco.listarHistoricoFonte(url);

  if (!Array.isArray(historico)) {
    throw new Error("O banco retornou um histórico em formato inválido.");
  }

  if (historico.length === 0) {
    return {
      status: "NOT_FOUND",
      justificativa: "Nenhuma coleta dessa URL foi encontrada.",
      total_coletas: 0
    };
  }

  // Consolida as evidências por verificação.
  // Evidências da mesma verificação não representam versões temporais distintas.
  const historicoPorVerificacao = new Map();

  for (const registro of historico) {
    const idVerificacao = registro.id_verificacao;

    const identidade = idVerificacao !== null &&
      idVerificacao !== undefined
      ? `verificacao:${idVerificacao}`
      : `evidencia:${registro.id_evidencia}`;

    historicoPorVerificacao.set(identidade, registro);
  }

  const aquisicoes = [...historicoPorVerificacao.values()];

  const ultimaColeta = aquisicoes[aquisicoes.length - 1];
  const normalizacaoAtual = obterNormalizacaoColeta(ultimaColeta);
  const conteudoAtual = normalizacaoAtual.conteudo;

  const metadadosNormalizacaoAtual = {
    versao_normalizacao: VERSAO_NORMALIZACAO,
    origem_normalizacao: {
      atual: normalizacaoAtual.origem
    },
    versoes_normalizacao_origem: {
      atual: normalizacaoAtual.versao_persistida
    }
  };

  if (aquisicoes.length === 1) {
    const resultado = {
      status: conteudoAtual ? "NEW" : "NOT_ENOUGH_DATA",
      justificativa: conteudoAtual
        ? "Esta é a primeira coleta registrada para essa URL. Ainda não existe uma versão anterior para comparação."
        : "A primeira coleta não contém conteúdo suficiente para comparação.",
      total_coletas: 1,
      ultima_coleta: obterDataColeta(ultimaColeta),
      ...metadadosNormalizacaoAtual,
      detalhamento: {
        status: "NOT_APPLICABLE",
        justificativa: "Não existe uma coleta anterior."
      }
    };

    if (conteudoAtual) {
      resultado.hash_atual = gerarHash(conteudoAtual);
    }

    return resultado;
  }

  const coletaAnterior = aquisicoes[aquisicoes.length - 2];
  const normalizacaoAnterior = obterNormalizacaoColeta(coletaAnterior);
  const conteudoAnterior = normalizacaoAnterior.conteudo;

  const idEvidenciaAnterior = coletaAnterior.id_evidencia;
  const idEvidenciaAtual = ultimaColeta.id_evidencia;

  const metadadosNormalizacao = obterMetadadosNormalizacao(
    normalizacaoAnterior,
    normalizacaoAtual
  );

  const dadosBase = {
    url,
    total_coletas: historico.length,
    coleta_anterior: obterDataColeta(coletaAnterior),
    ultima_coleta: obterDataColeta(ultimaColeta),
    ...metadadosNormalizacao
  };

  const idsValidos =
    idEvidenciaAnterior !== null &&
    idEvidenciaAnterior !== undefined &&
    idEvidenciaAtual !== null &&
    idEvidenciaAtual !== undefined;

  // A comparação temporal precisa ser validada antes de avaliar
  // conteúdo, hashes ou diferenças textuais.
  const validacaoTemporal = validarOrdemTemporal(
    coletaAnterior,
    ultimaColeta
  );

  if (!validacaoTemporal.valida) {
    return montarResultadoNaoComparavel(
      dadosBase,
      validacaoTemporal
    );
  }

  const compatibilidadeUrlCanonica = validarCompatibilidadeUrlCanonica(
    coletaAnterior,
    ultimaColeta
  );

  if (!compatibilidadeUrlCanonica.valida) {
    return montarResultadoNaoComparavel(
      dadosBase,
      compatibilidadeUrlCanonica
    );
  }

  if (!conteudoAnterior || !conteudoAtual) {
    const resultado = {
      status: "NOT_ENOUGH_DATA",
      justificativa:
        "Uma ou ambas as coletas não contêm conteúdo suficiente para comparação.",
      ...dadosBase,
      hash_anterior: conteudoAnterior
        ? gerarHash(conteudoAnterior)
        : null,
      hash_atual: conteudoAtual
        ? gerarHash(conteudoAtual)
        : null
    };

    if (!idsValidos) {
      return montarResultadoSemPersistencia(
        resultado,
        "Uma ou ambas as coletas não possuem ID de evidência."
      );
    }

    return persistirComparacao(banco, {
      ...dadosBase,
      id_evidencia_anterior: idEvidenciaAnterior,
      id_evidencia_atual: idEvidenciaAtual,
      resultado
    });
  }

  const tipoAnterior = coletaAnterior.tipo_fonte;
  const tipoAtual = ultimaColeta.tipo_fonte;

  if (!tipoAnterior || !tipoAtual || tipoAnterior !== tipoAtual) {
    return {
      status: "NOT_COMPARABLE",
      justificativa:
        "As coletas utilizam métodos de obtenção diferentes ou não identificados. Não é seguro interpretar a diferença de conteúdo como uma mudança na fonte.",
      ...dadosBase,
      tipo_fonte_anterior: tipoAnterior ?? null,
      tipo_fonte_atual: tipoAtual ?? null,
      detalhamento: {
        status: "NOT_COMPUTED_INCOMPATIBLE_SOURCE",
        justificativa:
          "A comparação foi interrompida porque os métodos de coleta não são compatíveis."
      },
      persistencia: {
        status: "NOT_PERSISTED",
        justificativa:
          "Tentativas com métodos de coleta incompatíveis não são registradas como comparações válidas."
      }
    };
  }


  if (tipoAtual === "tavily_search") {
    const compatibilidadeBusca = validarCompatibilidadeBusca(
      coletaAnterior.coleta,
      ultimaColeta.coleta
    );

    if (!compatibilidadeBusca.valida) {
      return montarResultadoBuscaNaoComparavel(
        dadosBase,
        compatibilidadeBusca.justificativa
      );
    }
  }

  const hashAnterior = gerarHash(conteudoAnterior);
  const hashAtual = gerarHash(conteudoAtual);
  const houveMudanca = hashAnterior !== hashAtual;

  let resultado;

  if (!houveMudanca) {
    resultado = {
      status: "UNCHANGED",
      justificativa:
        "Os conteúdos normalizados das duas coletas são iguais após padronização Unicode NFC e dos finais de linha.",
      ...dadosBase,
      tipo_fonte: tipoAtual,
      hash_anterior: hashAnterior,
      hash_atual: hashAtual,
      detalhamento: {
        status: "NOT_NEEDED",
        justificativa: "Nenhuma mudança foi detectada nos conteúdos normalizados."
      }
    };
  } else {
    const detalhamento = calcularDiferencas(
      conteudoAnterior,
      conteudoAtual
    );

    resultado = {
      status: "CHANGED",
      justificativa:
        "O conteúdo normalizado armazenado na coleta mais recente é diferente do conteúdo da coleta anterior. Isso não confirma, isoladamente, uma alteração na página original.",
      ...dadosBase,
      tipo_fonte: tipoAtual,
      hash_anterior: hashAnterior,
      hash_atual: hashAtual,
      detalhamento
    };
  }

  if (!idsValidos) {
    return montarResultadoSemPersistencia(
      resultado,
      "Uma ou ambas as coletas não possuem ID de evidência."
    );
  }

  return persistirComparacao(banco, {
    ...dadosBase,
    id_evidencia_anterior: idEvidenciaAnterior,
    id_evidencia_atual: idEvidenciaAtual,
    resultado
  });
}

module.exports = {
  compararHistoricoFonte,
  normalizarConteudo,
  obterNormalizacaoColeta,
  gerarHash,
  calcularDiferencas
};
