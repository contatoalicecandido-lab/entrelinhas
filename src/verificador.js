
const { decomporEmAfirmacoes } = require("./afirmacoes");
const { pesquisarComTavily } = require("./tavily");
const { classificarEvidencia } = require("./classificador");
const { avaliarCorrespondencia } = require("./correspondencia");
const { prepararEvidencia } = require("./preparar-evidencia");
const { criarBanco } = require("./banco");
const { agregarEvidencias, normalizarDominio } = require("./agregador");
const { randomUUID } = require("node:crypto");
const { resolverTipoAfirmacao } = require("./tipo-afirmacao");
const { analisarFontesEmLote } = require("./analise-lote");
const { avaliarRiscoDesatualizacao } = require("./risco-desatualizacao");
const { gerarRespostaCorrigida } = require("./resposta-corrigida");
const { analisarNuances } = require("./portugues");
const { pedeEvidenciaCientifica } = require("./tipo-fonte");

const {
  avaliarAtualidade,
  janelaDeValidade,
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
    limite > 6
  ) {
    throw new Error(
      "O limite de evidências precisa ser um inteiro entre 1 e 6."
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

  const dominiosOficiais = opcoes.dominiosOficiais ?? [];

  if (!Array.isArray(dominiosOficiais)) {
    throw new Error("dominiosOficiais precisa ser uma lista.");
  }

  function validarMapaDeDominios(valor, nome) {
    if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
      throw new Error(`${nome} precisa ser um objeto de listas de domínios.`);
    }
    for (const [chave, dominios] of Object.entries(valor)) {
      if (!chave.trim() || !Array.isArray(dominios)) {
        throw new Error(`${nome} contém uma chave ou lista inválida.`);
      }
    }
    return valor;
  }

  const dominiosOficiaisPorTipo = validarMapaDeDominios(
    opcoes.dominiosOficiaisPorTipo ?? {},
    "dominiosOficiaisPorTipo"
  );
  const dominiosOficiaisPorAfirmacao = validarMapaDeDominios(
    opcoes.dominiosOficiaisPorAfirmacao ?? {},
    "dominiosOficiaisPorAfirmacao"
  );

  if (opcoes.inferirTipo !== undefined && typeof opcoes.inferirTipo !== "boolean") {
    throw new Error("inferirTipo precisa ser verdadeiro ou falso.");
  }

  const maxAfirmacoes = opcoes.maxAfirmacoes ?? null;

  if (
    maxAfirmacoes !== null &&
    (!Number.isInteger(maxAfirmacoes) || maxAfirmacoes < 1 || maxAfirmacoes > 50)
  ) {
    throw new Error("maxAfirmacoes precisa ser um inteiro entre 1 e 50.");
  }

  for (const chave of ["analiseEmLote", "incluirNoticias", "fontesDiversas", "paisAutomatico", "cienciaAutomatica"]) {
    if (opcoes[chave] !== undefined && typeof opcoes[chave] !== "boolean") {
      throw new Error(`${chave} precisa ser verdadeiro ou falso.`);
    }
  }

  return {
    maxEvidencias: limite,
    analiseEmLote: opcoes.analiseEmLote ?? false,
    incluirNoticias: opcoes.incluirNoticias ?? false,
    fontesDiversas: opcoes.fontesDiversas ?? false,
    paisAutomatico: opcoes.paisAutomatico ?? false,
    cienciaAutomatica: opcoes.cienciaAutomatica ?? false,
    maxAfirmacoes,
    inferirTipo: opcoes.inferirTipo ?? true,
    dataReferencia,
    tiposPorAfirmacao,
    dominiosOficiais,
    dominiosOficiaisPorTipo,
    dominiosOficiaisPorAfirmacao
  };
}

function obterDominiosOficiais(resultado, opcoes) {
  return opcoes.dominiosOficiaisPorAfirmacao[resultado.id] ??
    opcoes.dominiosOficiaisPorTipo[resultado.tipo_afirmacao] ??
    opcoes.dominiosOficiais;
}

function agregarResultadoAfirmacao(resultado, opcoes) {
  const dominiosConfigurados = obterDominiosOficiais(resultado, opcoes);
  // Mapa de autoridades brasileiras: Selic → bcb.gov.br, LGPD → gov.br etc.
  const dominiosAutomaticos = opcoes.paisAutomatico
    ? (resultado.nuances?.dominios_oficiais_sugeridos ?? []).filter(d => !dominiosConfigurados.includes(d))
    : [];
  const dominiosOficiais = [...dominiosConfigurados, ...dominiosAutomaticos];
  resultado.dominios_oficiais_usados = [...dominiosOficiais];
  resultado.dominios_oficiais_automaticos = dominiosAutomaticos;
  resultado.agregacao = agregarEvidencias(
    {
      texto: resultado.texto,
      tipo_afirmacao: resultado.tipo_afirmacao,
      evidencias: resultado.evidencias
    },
    { dominiosOficiais, asOf: opcoes.dataReferencia ?? new Date() }
  );

  return resultado;
}

function priorizarFontesOficiais(evidencias, dominiosOficiais) {
  if (!dominiosOficiais.length) {
    return evidencias;
  }

  return evidencias
    .map((evidencia, indice) => {
      const dominioFonte = normalizarDominio(evidencia.url);
      const oficial = Boolean(
        dominioFonte && dominiosOficiais.some(dominioOficial =>
          dominioFonte === dominioOficial ||
          dominioFonte.endsWith(`.${dominioOficial}`)
        )
      );

      return { evidencia, indice, oficial };
    })
    .sort((a, b) => Number(b.oficial) - Number(a.oficial) || a.indice - b.indice)
    .map(item => item.evidencia);
}

function resumirVerificacao(afirmacoes) {
  if (afirmacoes.length === 0) {
    return {
      veredito: "NAO_VERIFICAVEL",
      resumo:
        "Não foi possível identificar afirmações verificáveis no texto enviado.",
      total_afirmacoes: 0,
      contagem_vereditos: {}
    };
  }

  const contagem = {};
  for (const afirmacao of afirmacoes) {
    const veredito = afirmacao.agregacao?.veredito ?? "NAO_VERIFICAVEL";
    contagem[veredito] = (contagem[veredito] ?? 0) + 1;
  }

  if (afirmacoes.length === 1) {
    return {
      veredito: afirmacoes[0].agregacao.veredito,
      resumo: afirmacoes[0].agregacao.resumo,
      total_afirmacoes: 1,
      contagem_vereditos: contagem
    };
  }

  const partes = Object.entries(contagem).map(
    ([veredito, quantidade]) => `${quantidade} ${veredito}`
  );

  return {
    veredito: "MULTIPLAS_AFIRMACOES",
    resumo:
      `O texto foi dividido em ${afirmacoes.length} afirmações. ` +
      `Resultados por afirmação: ${partes.join(", ")}. Consulte cada afirmação e suas fontes antes de formar uma conclusão geral.`,
    total_afirmacoes: afirmacoes.length,
    contagem_vereditos: contagem
  };
}

// Converte o resultado do lote para o mesmo formato da análise por fonte.
function converterResultadoLote(item) {
  if (!item) {
    return {
      correspondencia: { status: "ERROR", justificativa: "The model did not return an analysis for this source." },
      classificacao: { postura: "ERROR", justificativa: "The analysis was not completed." }
    };
  }
  const correspondencia = { status: item.correspondencia, justificativa: item.motivo };
  if (item.correspondencia === "MATCH") {
    return { correspondencia, classificacao: { postura: item.postura, justificativa: item.motivo } };
  }
  if (item.correspondencia === "RELATED_INSUFFICIENT") {
    return { correspondencia, classificacao: { postura: "INSUFFICIENT", justificativa: item.motivo } };
  }
  return { correspondencia, classificacao: { postura: "IRRELEVANT", justificativa: item.motivo } };
}

async function analisarEvidenciasEmLote(afirmacao, evidenciasSelecionadas, resultado, opcoes) {
  const preparadas = [];
  for (const [indice, evidencia] of evidenciasSelecionadas.entries()) {
    const { coleta = null, ...fonte } = evidencia;
    let preparacao = null;
    let erroPreparacao = null;
    try {
      preparacao = prepararEvidencia(afirmacao.texto, fonte);
    } catch (erro) {
      erroPreparacao = erro.message;
    }
    preparadas.push({ id: `S${indice + 1}`, fonte, coleta, preparacao, erroPreparacao });
  }

  const analisaveis = preparadas.filter(p => p.preparacao);
  let analise = new Map();
  let erroLote = null;
  if (analisaveis.length > 0) {
    const chamar = (tentativa) => analisarFontesEmLote(
      afirmacao.texto,
      analisaveis.map(p => ({
        id: p.id,
        url: p.fonte.url ?? "",
        titulo: p.fonte.titulo ?? "",
        tipo: p.fonte.categoria_fonte ?? "OUTRO",
        // Página completa: a análise em lote escolhe os trechos mais
        // relevantes (com a afirmação normalizada: "9 pau" → "R$ 9 mil").
        texto: p.preparacao.conteudo_original
      })),
      {
        dataReferencia: opcoes.dataReferencia,
        nuances: resultado.nuances,
        consultaSelecao: [afirmacao.texto, resultado.nuances?.consulta_busca].filter(Boolean).join(" "),
        idVerificacao: opcoes.idVerificacao,
        idAfirmacao: afirmacao.id,
        tentativa,
        onMetadata: opcoes.onMetadata
      }
    );
    try {
      analise = await executarComRetentativas(chamar);
    } catch (erro) {
      // Uma nova tentativa para respostas malformadas (o modelo não é determinístico).
      try {
        analise = await executarComRetentativas(chamar);
      } catch (erroFinal) {
        erroLote = erroFinal.message;
      }
    }
  }

  for (const p of preparadas) {
    // Data do fato encontrada no texto e conferida pela citação: passa a ser a
    // data ligada ao atributo, a menos que a fonte já tenha uma melhor.
    const dataFato = analise.get(p.id)?.dataFato;
    if (dataFato && p.fonte.escopo_data !== "ATTRIBUTE") {
      // Quando a data do fato é ANTERIOR à publicação da página ("em vigor
      // desde setembro de 2020", numa matéria de outubro de 2026), a página
      // confirma o fato na data em que foi publicada: essa é a data da
      // confirmação. Gravar 2020 como "atualização" tornaria a fonte
      // incoerente (atualizada antes de publicada) e descartaria a melhor
      // evidência. A data do fato fica guardada à parte, em data_fato.
      const publicada = /^\d{4}-\d{2}-\d{2}/.test(String(p.fonte.data_publicacao ?? ""))
        ? String(p.fonte.data_publicacao).slice(0, 10) : null;
      const confirmadaEm = publicada && dataFato.data < publicada ? publicada : dataFato.data;
      p.fonte = {
        ...p.fonte,
        data_atualizacao: confirmadaEm,
        escopo_data: "ATTRIBUTE",
        data_fato: { ...dataFato, origem: "QUOTED_IN_SOURCE_TEXT", confirmada_em: confirmadaEm }
      };
    }
    const atualidade = avaliarAtualidade(p.fonte, resultado.tipo_afirmacao, opcoes.dataReferencia, resultado.janela_validade?.dias);
    if (!p.preparacao) {
      resultado.evidencias.push({
        fonte: p.fonte,
        coleta: p.coleta,
        preparacao: { motivo_preparacao: "PREPARATION_ERROR", erro: p.erroPreparacao },
        correspondencia: { status: "ERROR", justificativa: "The source could not be prepared." },
        classificacao: { postura: "ERROR", justificativa: "The analysis was not executed." },
        atualidade
      });
      continue;
    }
    const item = analise.get(p.id);
    const convertido = erroLote
      ? {
        correspondencia: { status: "ERROR", justificativa: erroLote },
        classificacao: { postura: "ERROR", justificativa: "The batch analysis failed." }
      }
      : converterResultadoLote(item);
    const { conteudo_original, conteudo_para_analise, ...metadadosPreparacao } = p.preparacao;
    resultado.evidencias.push({
      fonte: p.fonte,
      coleta: p.coleta,
      preparacao: {
        ...metadadosPreparacao,
        trecho_analisado: typeof conteudo_para_analise === "string" ? conteudo_para_analise.slice(0, 1200) : null,
        citacao_chave: item?.citacao || null,
        citacao_verificada: item ? Boolean(item.citacaoVerificada) : null,
        metodo_analise: "LOTE"
      },
      ...convertido,
      atualidade
    });
  }
}

async function verificarAfirmacao(afirmacao, opcoes) {
  const resultado = {
    id: afirmacao.id,
    texto: afirmacao.texto,
    tipo_afirmacao: null,
    origem_tipo_afirmacao: null,
    nuances: analisarNuances(afirmacao.texto, { dataReferencia: opcoes.dataReferencia }),
    evidencias: [],
    erro_busca: null
  };

  try {
    const tipoResolvido = resolverTipoAfirmacao(
      afirmacao,
      opcoes.tiposPorAfirmacao,
      { inferirTipo: opcoes.inferirTipo }
    );
    resultado.tipo_afirmacao = tipoResolvido.tipo;
    resultado.origem_tipo_afirmacao = tipoResolvido.origem;
    resultado.janela_validade = janelaDeValidade(resultado.tipo_afirmacao, afirmacao.texto);
    resultado.risco_desatualizacao = avaliarRiscoDesatualizacao({
      texto: afirmacao.texto,
      tipo: resultado.tipo_afirmacao,
      janela: resultado.janela_validade,
      nuances: resultado.nuances,
      dataReferencia: opcoes.dataReferencia instanceof Date ? opcoes.dataReferencia : new Date()
    });
  } catch (erro) {
    resultado.erro_busca = erro.message;
    return agregarResultadoAfirmacao(resultado, opcoes);
  }

  const dominiosOficiais = obterDominiosOficiais(resultado, opcoes);
  resultado.dominios_oficiais_usados = [...dominiosOficiais];

  let evidenciasEncontradas;

  try {
    // Afirmações informais em português são buscadas com nomes oficiais
    // ("zap" → WhatsApp, "50 conto" → R$ 50); a análise usa o texto original.
    evidenciasEncontradas = await pesquisarComTavily(
      resultado.nuances?.consulta_busca || afirmacao.texto,
      {
        idVerificacao: opcoes.idVerificacao,
        idAfirmacao: afirmacao.id,
        dominiosOficiais,
        tipoAfirmacao: resultado.tipo_afirmacao,
        onMetadata: opcoes.onMetadataPesquisa,
        incluirNoticias: opcoes.incluirNoticias,
        incluirCiencia: Boolean(opcoes.cienciaAutomatica && pedeEvidenciaCientifica(afirmacao.texto)),
        selecaoDiversa: opcoes.fontesDiversas,
        maxFontes: opcoes.fontesDiversas ? opcoes.maxEvidencias : undefined,
        // Afirmação em português: prioriza resultados do Brasil na busca geral.
        pais: opcoes.paisAutomatico && resultado.nuances?.idioma === "pt" ? "brazil" : undefined
      }
    );
  } catch (erro) {
    resultado.erro_busca = erro.message;
    return agregarResultadoAfirmacao(resultado, opcoes);
  }

  const evidenciasPrioritarias = priorizarFontesOficiais(
    evidenciasEncontradas,
    dominiosOficiais.map(normalizarDominio)
  );

  const evidenciasSelecionadas = evidenciasPrioritarias.slice(
    0,
    opcoes.maxEvidencias
  );

  if (opcoes.analiseEmLote) {
    await analisarEvidenciasEmLote(afirmacao, evidenciasSelecionadas, resultado, opcoes);
    return agregarResultadoAfirmacao(resultado, opcoes);
  }

  for (const evidencia of evidenciasSelecionadas) {
    // Separa os dados de aquisição da fonte original.
    // Compatível com evidências antigas sem objeto de coleta.

    const { coleta = null, ...fonte } = evidencia;

    let preparacao;
    let correspondencia;
    let classificacao;

    // 1. Prepara a evidência sem alterar a fonte original.

    try {
      preparacao = prepararEvidencia(
        afirmacao.texto,
        fonte
      );
    } catch (erro) {
      resultado.evidencias.push({
        fonte,
        coleta,
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
          fonte,
          resultado.tipo_afirmacao,
          opcoes.dataReferencia,
          resultado.janela_validade?.dias
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
            urlEvidencia: fonte.url ?? null,
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
              urlEvidencia: fonte.url ?? null,
              tentativa,
              dataReferencia: opcoes.dataReferencia,
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
      fonte,
      resultado.tipo_afirmacao,
      opcoes.dataReferencia,
      resultado.janela_validade?.dias
    );

    // 5. Guarda a fonte original separada dos dados de coleta.

    resultado.evidencias.push({
      fonte,
      coleta,
      preparacao: {
        ...metadadosPreparacao,
        // Trecho efetivamente enviado ao modelo (encurtado), para explicar o veredito.
        trecho_analisado: typeof conteudo_para_analise === "string"
          ? conteudo_para_analise.slice(0, 6000)
          : null
      },
      correspondencia,
      classificacao,
      atualidade
    });
  }

  return agregarResultadoAfirmacao(resultado, opcoes);
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

  // Limite opcional de custo: afirmações excedentes não são verificadas,
  // mas ficam registradas como omitidas (nunca descartadas em silêncio).

  const afirmacoesVerificadas = configuracao.maxAfirmacoes
    ? afirmacoes.slice(0, configuracao.maxAfirmacoes)
    : afirmacoes;

  const afirmacoesOmitidas = afirmacoes
    .slice(afirmacoesVerificadas.length)
    .map(({ id, texto: textoAfirmacao }) => ({ id, texto: textoAfirmacao }));

  // 2. Verificação individual de cada afirmação.

  const resultados = [];

  for (const afirmacao of afirmacoesVerificadas) {
    const resultado = await verificarAfirmacao(
      afirmacao,
      opcoesExecucao
    );

    resultados.push(resultado);
  }

  // 3. Resposta corrigida, escrita só com as evidências verificadas.
  //    Opcional e não bloqueante: uma falha aqui não invalida a verificação.

  let respostaCorrigida = null;

  if (opcoes.respostaCorrigida === true && resultados.length > 0) {
    try {
      respostaCorrigida = await gerarRespostaCorrigida(texto.trim(), resultados, {
        idVerificacao,
        onMetadata: registrarChamadaModelo,
        dataReferencia: opcoes.dataReferencia
      });
    } catch (erro) {
      respostaCorrigida = { texto: null, erro: erro.message };
    }
  }

  // 4. Resultado completo, incluindo rastreabilidade.

  const resultadoFinal = {
    sistema: "Entrelinhas",
    id_verificacao: idVerificacao,
    texto_original: texto.trim(),
    verificado_em: new Date().toISOString(),
    total_afirmacoes: resultados.length,
    sintese: resumirVerificacao(resultados),
    afirmacoes: resultados,
    afirmacoes_omitidas: afirmacoesOmitidas,
    resposta_corrigida: respostaCorrigida,
    rastreabilidade_modelo: chamadasModelo,
    rastreabilidade_pesquisa: chamadasPesquisa
  };

  // 5. Persistência no SQLite.

  const idSalvo = bancoExecucao.salvarVerificacao(resultadoFinal);

  return {
    ...resultadoFinal,
    id_verificacao: idSalvo
  };
}

module.exports = {
  verificarTexto
};
