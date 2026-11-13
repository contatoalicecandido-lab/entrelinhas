
const { validarData, VALIDADE_MAX_DIAS } = require("./atualidade");
const { calculateClaimFreshnessScore, calculatePageDateRecency } = require("./freshness-score");
const { calcularAtualidadeAfirmacao, JANELA_GERAL_DIAS } = require("./atualidade-afirmacao");
const { clusterizarDependencias } = require("./independencia-fontes");
const { calcularConcordancia, estaCorroborada } = require("./concordancia");
const { classificarFonte } = require("./tipo-fonte");

const VERSAO_REGRAS = "1.2.0";

const VEREDITOS = [
  "ATUAL",
  "CORROBORADA",
  "CONTRADITA_POR_FONTE_ATUAL",
  "CONFLITO",
  "SUPORTE_FRACO",
  "CONTRADICAO_FRACA",
  "NAO_VERIFICAVEL"
];

const POSTURAS_UTILIZAVEIS = ["SUPPORTS", "CONTRADICTS"];

function normalizarDominio(valor) {
  if (typeof valor !== "string" || !valor.trim()) {
    return null;
  }

  try {
    const entrada = valor.includes("://")
      ? valor
      : `https://${valor}`;

    const dominio = new URL(entrada).hostname
      .toLowerCase()
      .replace(/^www\./, "")
      .replace(/\.$/, "");

    return dominio || null;
  } catch {
    return null;
  }
}

function validarOpcoes(opcoes = {}) {
  if (!opcoes || typeof opcoes !== "object" || Array.isArray(opcoes)) {
    throw new Error("As opções do agregador são inválidas.");
  }

  const dominios = opcoes.dominiosOficiais ?? [];

  if (!Array.isArray(dominios)) {
    throw new Error("dominiosOficiais precisa ser uma lista.");
  }

  const dominiosNormalizados = dominios.map(normalizarDominio);

  if (dominiosNormalizados.some(dominio => !dominio)) {
    throw new Error("A lista contém um domínio oficial inválido.");
  }

  return {
    dominiosOficiais: [...new Set(dominiosNormalizados)]
  };
}

function dominioEhOficial(dominio, dominiosOficiais) {
  if (!dominio) return false;

  return dominiosOficiais.some(oficial =>
    dominio === oficial || dominio.endsWith(`.${oficial}`)
  );
}

function normalizarDataFonte(valor) {
  if (typeof valor !== "string" || !valor.trim()) {
    return null;
  }

  const dataTexto = valor.trim();

  // Formato principal utilizado pelo Entrelinhas.
  if (validarData(dataTexto)) {
    return dataTexto;
  }

  // Compatibilidade com datas ISO completas já existentes.
  const formatoISO =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

  if (!formatoISO.test(dataTexto)) {
    return null;
  }

  const data = new Date(dataTexto);

  if (Number.isNaN(data.getTime())) {
    return null;
  }

  const dataCalendario = dataTexto.slice(0, 10);

  return validarData(dataCalendario)
    ? dataCalendario
    : null;
}

function dataVerificavel(fonte) {
  const publicacao = fonte?.data_publicacao;
  const atualizacao = fonte?.data_atualizacao;

  const temPublicacao =
    publicacao !== null && publicacao !== undefined;

  const temAtualizacao =
    atualizacao !== null && atualizacao !== undefined;

  if (!temPublicacao && !temAtualizacao) {
    return false;
  }

  const dataPublicacao = temPublicacao
    ? normalizarDataFonte(publicacao)
    : null;

  const dataAtualizacao = temAtualizacao
    ? normalizarDataFonte(atualizacao)
    : null;

  if (temPublicacao && !dataPublicacao) {
    return false;
  }

  if (temAtualizacao && !dataAtualizacao) {
    return false;
  }

  if (
    dataPublicacao &&
    dataAtualizacao &&
    dataAtualizacao < dataPublicacao
  ) {
    return false;
  }

  return true;
}

function obterStatusDatasDeclaradas(fonte) {
  const temPublicacao = fonte?.data_publicacao !== null &&
    fonte?.data_publicacao !== undefined;
  const temAtualizacao = fonte?.data_atualizacao !== null &&
    fonte?.data_atualizacao !== undefined;

  if (!temPublicacao && !temAtualizacao) return "AUSENTE";
  return dataVerificavel(fonte) ? "VERIFICAVEL" : "INVALIDA_OU_INCOERENTE";
}

function prepararEvidencias(afirmacao, dominiosOficiais) {
  const evidencias = afirmacao.evidencias ?? [];

  if (!Array.isArray(evidencias)) {
    throw new Error("As evidências da afirmação precisam ser uma lista.");
  }

  return evidencias
    .map(evidencia => {
      const fonte = evidencia?.fonte ?? {};
      const correspondencia = evidencia?.correspondencia ?? {};
      const classificacao = evidencia?.classificacao ?? {};
      const atualidade = evidencia?.atualidade ?? {};

      const dominio = normalizarDominio(fonte.url);
      const postura = classificacao.postura;

      const utilizavel =
        correspondencia.status === "MATCH" &&
        POSTURAS_UTILIZAVEIS.includes(postura) &&
        Boolean(dominio);

      // Oficial: domínio configurado, governo, ou o próprio site da entidade
      // citada na afirmação (classificado na coleta).
      const oficial = dominioEhOficial(
        dominio,
        dominiosOficiais
      ) || fonte.categoria_fonte === "OFICIAL";

      const possuiDataVerificavel = dataVerificavel(fonte);
      const dataVinculadaAoAtributo = fonte.escopo_data === "ATTRIBUTE";
      const statusDatasDeclaradas = obterStatusDatasDeclaradas(fonte);
      const consultadoEm = fonte.coletado_em ?? evidencia?.coleta?.coletado_em ?? null;

      const atual =
        utilizavel &&
        atualidade.status === "FRESH" &&
        possuiDataVerificavel &&
        dataVinculadaAoAtributo;

      return {
        titulo: fonte.titulo ?? null,
        url: fonte.url ?? null,
        conteudo: fonte.conteudo ?? "",
        dominio,
        tipo_fonte: fonte.tipo_fonte ?? null,
        categoria_fonte: fonte.categoria_fonte ??
          classificarFonte(fonte.url, { dominiosOficiais }).tipo,
        postura: utilizavel ? postura : null,
        utilizavel,
        oficial,
        atual,
        // false: o modelo tomou posição sem uma citação conferida no texto.
        citacao_verificada: evidencia?.preparacao?.citacao_verificada ?? null,
        data_vinculada_ao_atributo: dataVinculadaAoAtributo,
        status_atualidade: atualidade.status ?? "UNVERIFIABLE",
        status_datas_declaradas: statusDatasDeclaradas,
        consultado_em: consultadoEm,
        data_publicacao: fonte.data_publicacao ?? null,
        data_atualizacao: fonte.data_atualizacao ?? null,
        escopo_data: fonte.escopo_data ?? "PAGE",
        sinais_data: fonte.metadados_provedor?.sinais_data ?? [],
        canonical_url: fonte.canonical_url ?? null,
        id_evidencia: evidencia.id_evidencia ?? null,
        justificativa: classificacao.justificativa ?? null
      };
    })
    .filter(evidencia => evidencia.utilizavel);
}

function agruparPorDominio(evidencias) {
  const grupos = new Map();

  for (const evidencia of evidencias) {
    const chaveGrupo = evidencia.grupo_dependencia_id ?? evidencia.dominio;
    if (!grupos.has(chaveGrupo)) {
      grupos.set(chaveGrupo, {
        grupo_dependencia_id: chaveGrupo,
        dominios: new Set(),
        oficial: evidencia.oficial,
        atual: false,
        posturas: new Set(),
        evidencias: []
      });
    }

    const grupo = grupos.get(chaveGrupo);
    grupo.dominios.add(evidencia.dominio);
    grupo.oficial = grupo.oficial || evidencia.oficial;
    grupo.atual = grupo.atual || evidencia.atual;
    grupo.posturas.add(evidencia.postura);
    grupo.evidencias.push(evidencia);
  }

  return [...grupos.values()].map(grupo => ({
    ...grupo,
    dominios: [...grupo.dominios],
    dominio: [...grupo.dominios][0] ?? null,
    posturas: [...grupo.posturas],
    postura: grupo.posturas.size > 1
      ? "CONFLITO"
      : grupo.posturas.values().next().value
  }));
}

function calcularScore(grupos) {
  const totalFontes = grupos.length;

  const fontesOficiais = grupos.filter(
    grupo => grupo.oficial
  ).length;

  const fontesAtuais = grupos.filter(
    grupo => grupo.atual
  ).length;

  const haConflito = grupos.some(
    grupo => grupo.postura === "CONFLITO"
  ) || (
    grupos.some(grupo => grupo.postura === "SUPPORTS") &&
    grupos.some(grupo => grupo.postura === "CONTRADICTS")
  );

  const autoridade = totalFontes === 0
    ? 0
    : Math.round((fontesOficiais / totalFontes) * 40);

  const atualidade = totalFontes === 0
    ? 0
    : Math.round((fontesAtuais / totalFontes) * 30);

  const diversidade = Math.round(
    Math.min(totalFontes, 2) / 2 * 20
  );

  const concordancia = totalFontes === 0
    ? 0
    : haConflito ? 0 : 10;

  const total =
    autoridade +
    atualidade +
    diversidade +
    concordancia;

  return {
    valor: total,
    escala: "0-100",
    natureza: "HEURISTICA",
    interpretacao: "Qualidade estrutural das evidências, não probabilidade de verdade.",
    componentes: {
      autoridade,
      atualidade,
      diversidade_fontes: diversidade,
      concordancia
    }
  };
}

function determinarVeredito(grupos, concordancia = null) {
  if (grupos.length === 0) {
    return "NAO_VERIFICAVEL";
  }

  // Posturas divergentes dentro do mesmo domínio
  // também representam conflito.
  const conflitoInterno = grupos.some(
    grupo => grupo.postura === "CONFLITO"
  );

  if (conflitoInterno) {
    return "CONFLITO";
  }

  const oficiaisAtuais = grupos.filter(
    grupo => grupo.oficial && grupo.atual
  );

  const oficiaisAtuaisApoiando = oficiaisAtuais.some(
    grupo => grupo.postura === "SUPPORTS"
  );

  const oficiaisAtuaisContradizendo = oficiaisAtuais.some(
    grupo => grupo.postura === "CONTRADICTS"
  );

  if (oficiaisAtuaisApoiando && oficiaisAtuaisContradizendo) {
    return "CONFLITO";
  }

  // Uma fonte oficial atual que contradiz a afirmação
  // prevalece sobre apoio de fontes mais fracas.
  if (oficiaisAtuaisContradizendo) {
    return "CONTRADITA_POR_FONTE_ATUAL";
  }

  if (oficiaisAtuaisApoiando) {
    // Uma contradição atual independente ainda merece conflito. E nunca é
    // verde ("It holds") quando a maioria ponderada das fontes discorda,
    // mesmo que as fontes que discordam só tenham data de página.
    const haContradicaoAtual = grupos.some(
      grupo => grupo.atual && grupo.postura === "CONTRADICTS"
    );
    const maioriaDiscorda = concordancia && Number.isFinite(concordancia.score) && concordancia.score < 50;

    return haContradicaoAtual || maioriaDiscorda
      ? "CONFLITO"
      : "ATUAL";
  }

  // Sem fonte oficial atual que resolva a divergência,
  // posturas opostas entre domínios independentes geram conflito,
  // mesmo quando as datas não são verificáveis.
  const haApoio = grupos.some(
    grupo => grupo.postura === "SUPPORTS"
  );

  const haContradicao = grupos.some(
    grupo => grupo.postura === "CONTRADICTS"
  );

  if (haApoio && haContradicao) {
    // Contradição dominante: fontes independentes de tipos mais fortes
    // contradizem e só sobra apoio fraco (ex.: um blog antigo). Sinaliza como
    // contradita. O inverso (apoio dominante) continua CONFLITO, de propósito:
    // o sistema só arrisca na direção de alertar, nunca na de tranquilizar.
    if (
      concordancia &&
      concordancia.score !== null &&
      concordancia.score <= 20 &&
      concordancia.contradicting >= 2 &&
      concordancia.split === 0
    ) {
      return "CONTRADICAO_FRACA";
    }
    return "CONFLITO";
  }

  if (haApoio) {
    // Sem fonte oficial com data, mas várias fontes independentes de tipos
    // diferentes concordam e nenhuma contradiz: corroborada.
    if (concordancia && estaCorroborada(concordancia)) {
      return "CORROBORADA";
    }
    return "SUPORTE_FRACO";
  }

  // Só há contradição, mas sem fonte oficial com data ligada ao fato:
  // sinal relevante de resposta desatualizada ou incorreta, não definitivo.
  // Exige peso mínimo: um único blog ou fórum que discorda não basta para
  // dizer "contradita"; fica como não verificável (amarelo, "olhe de perto").
  if (haContradicao) {
    return concordancia && Number.isFinite(concordancia.contradict_weight) && concordancia.contradict_weight < 1
      ? "NAO_VERIFICAVEL"
      : "CONTRADICAO_FRACA";
  }

  return "NAO_VERIFICAVEL";
}

function determinarConclusaoFactual(grupos) {
  if (grupos.length === 0) {
    return {
      status: "NAO_VERIFICAVEL",
      resumo: "Não há evidências utilizáveis para avaliar se a afirmação é apoiada ou contradita."
    };
  }

  const temConflitoInterno = grupos.some(grupo => grupo.postura === "CONFLITO");
  const temApoio = grupos.some(grupo => grupo.posturas.includes("SUPPORTS"));
  const temContradicao = grupos.some(grupo => grupo.posturas.includes("CONTRADICTS"));

  if (temConflitoInterno || (temApoio && temContradicao)) {
    return {
      status: "CONFLITO",
      resumo: "As evidências analisadas apoiam e contradizem a afirmação; o conflito permanece sem resolução."
    };
  }

  if (temApoio) {
    return {
      status: "APOIA",
      resumo: "As evidências utilizáveis apoiam a afirmação. Isso, por si só, não demonstra que ela continua válida agora."
    };
  }

  if (temContradicao) {
    return {
      status: "CONTRADIZ",
      resumo: "As evidências utilizáveis contradizem a afirmação."
    };
  }

  return {
    status: "INSUFICIENTE",
    resumo: "As evidências não permitem determinar se a afirmação é apoiada ou contradita."
  };
}

function criarResumo(veredito) {
  const resumos = {
    ATUAL:
      "As evidências utilizáveis incluem uma fonte oficial atual que apoia a afirmação, sem contradição atual identificada entre as fontes analisadas. Isso não é uma garantia absoluta de verdade.",
    CONTRADITA_POR_FONTE_ATUAL:
      "Uma fonte oficial atual contradiz a afirmação. As evidências analisadas não sustentam a afirmação como foi apresentada.",
    CONFLITO:
      "As fontes utilizáveis apresentam posições divergentes. Não foi possível resolver o conflito com as evidências disponíveis.",
    CORROBORADA:
      "Várias fontes independentes, de tipos diferentes, apoiam a afirmação e nenhuma a contradiz, mas nenhuma fonte oficial com data ligada ao fato a confirma. Isso não é garantia absoluta de verdade.",
    SUPORTE_FRACO:
      "Há evidências que apoiam a afirmação, mas não foi identificada uma fonte oficial atual suficiente para uma conclusão mais forte.",
    CONTRADICAO_FRACA:
      "As evidências utilizáveis contradizem a afirmação, mas nenhuma fonte oficial com data ligada ao fato confirma a contradição. Trate a afirmação como possivelmente desatualizada ou incorreta e revise as fontes.",
    NAO_VERIFICAVEL:
      "Não foi possível verificar a afirmação com as evidências utilizáveis encontradas. Isso não significa que ela seja falsa."
  };

  return resumos[veredito];
}

function criarResumoComDatas(veredito, evidencias) {
  if (veredito === "SUPORTE_FRACO") {
    const apoioOficialSemDataDeclarada = evidencias.some(evidencia =>
      evidencia.oficial &&
      evidencia.postura === "SUPPORTS" &&
      evidencia.status_datas_declaradas === "AUSENTE"
    );

    if (apoioOficialSemDataDeclarada) {
      return "Uma fonte oficial apoia a afirmação, mas não declara data de publicação ou atualização verificável. A data da consulta informa quando a página foi observada, não quando seu conteúdo foi atualizado; por isso, não é possível confirmar a atualidade.";
    }

    const apoioOficialSemDataDeAtributo = evidencias.some(evidencia =>
      evidencia.oficial &&
      evidencia.postura === "SUPPORTS" &&
      !evidencia.data_vinculada_ao_atributo
    );

    if (apoioOficialSemDataDeAtributo) {
      return "Uma fonte oficial apoia a afirmação, mas a data disponível não está vinculada ao atributo verificado. Ela pode ser uma data da página ou do resultado de busca; por isso, a atualidade do atributo permanece inconclusiva.";
    }
  }

  return criarResumo(veredito);
}

function agregarEvidencias(afirmacao, opcoes = {}) {
  if (
    !afirmacao ||
    typeof afirmacao !== "object" ||
    Array.isArray(afirmacao)
  ) {
    throw new Error("A afirmação informada é inválida.");
  }

  if (
    typeof afirmacao.texto !== "string" ||
    !afirmacao.texto.trim()
  ) {
    throw new Error("O texto da afirmação é obrigatório.");
  }

  const configuracao = validarOpcoes(opcoes);

  const evidenciasPreparadas = prepararEvidencias(
    afirmacao,
    configuracao.dominiosOficiais
  );

  const evidencias = clusterizarDependencias(evidenciasPreparadas);

  const grupos = agruparPorDominio(evidencias);

  const conclusaoFactual = determinarConclusaoFactual(grupos);
  const concordancia = calcularConcordancia(grupos);
  const veredito = determinarVeredito(grupos, concordancia);
  const score = calcularScore(grupos);
  // Janela da entidade (Selic 45 d, inflação 30 d) quando houver; senão, a da categoria.
  const validade = afirmacao.janela_validade?.dias ?? VALIDADE_MAX_DIAS[afirmacao.tipo_afirmacao];
  const freshnessScore = calculateClaimFreshnessScore(
    evidencias.map(evidencia => ({
      match: true,
      postura: evidencia.postura,
      sourceType: evidencia.categoria_fonte ?? null,
      temporalStatus: evidencia.status_atualidade,
      domain: evidencia.dominio,
      dependencyGroup: evidencia.grupo_dependencia_id,
      publicationDate: evidencia.data_publicacao,
      updateDate: evidencia.data_atualizacao,
      dateScope: evidencia.escopo_data,
      evidenceId: evidencia.id_evidencia,
      official: evidencia.oficial
    })),
    {
      claimType: afirmacao.tipo_afirmacao ?? "unknown",
      validityDays: validade ?? null,
      asOf: opcoes.asOf ?? new Date()
    }
  );

  // Indicador secundário (confiança baixa) pela data da página.
  const recenciaPagina = calculatePageDateRecency(
    evidencias.map(evidencia => ({
      match: true,
      postura: evidencia.postura,
      sourceType: evidencia.categoria_fonte ?? null,
      domain: evidencia.dominio,
      dependencyGroup: evidencia.grupo_dependencia_id,
      publicationDate: evidencia.data_publicacao,
      updateDate: evidencia.data_atualizacao,
      evidenceId: evidencia.id_evidencia
    })),
    {
      claimType: afirmacao.tipo_afirmacao ?? "unknown",
      validityDays: validade ?? null,
      asOf: opcoes.asOf ?? new Date()
    }
  );

  // Sem categoria temporal: recência das páginas numa janela geral, só para
  // que a nota de atualidade da afirmação exista (confiança baixa).
  const recenciaGeral = validade
    ? null
    : calculatePageDateRecency(
        evidencias.map(evidencia => ({
          match: true,
          postura: evidencia.postura,
          sourceType: evidencia.categoria_fonte ?? null,
          domain: evidencia.dominio,
          dependencyGroup: evidencia.grupo_dependencia_id,
          publicationDate: evidencia.data_publicacao,
          updateDate: evidencia.data_atualizacao,
          evidenceId: evidencia.id_evidencia
        })),
        { claimType: "general", validityDays: JANELA_GERAL_DIAS, asOf: opcoes.asOf ?? new Date() }
      );

  const atualidadeAfirmacao = calcularAtualidadeAfirmacao({
    freshness: freshnessScore,
    recenciaPagina,
    recenciaGeral,
    concordancia,
    janelaDias: validade ?? null
  });

  const limitacoes = [];

  if (evidencias.length === 0) {
    limitacoes.push(
      "Nenhuma evidência utilizável com correspondência MATCH e postura válida."
    );
  }

  if (!evidencias.some(evidencia => evidencia.atual)) {
    limitacoes.push(
      "Nenhuma evidência possui data verificável e status de atualidade FRESH."
    );
  }

  if (evidencias.some(evidencia => !evidencia.data_vinculada_ao_atributo)) {
    limitacoes.push(
      "Uma data da página ou do resultado de busca não comprova quando o atributo da afirmação foi publicado ou atualizado."
    );
  }

  if (evidencias.some(evidencia => evidencia.status_datas_declaradas === "AUSENTE")) {
    limitacoes.push(
      "A data da consulta registra quando a página foi observada; não substitui uma data declarada de publicação ou atualização."
    );
  }

  if (!evidencias.some(evidencia => evidencia.oficial)) {
    limitacoes.push(
      "Nenhuma fonte pertence ao cadastro de domínios oficiais informado."
    );
  }

  if (grupos.length < evidencias.length) {
    limitacoes.push(
      "Evidências do mesmo domínio, URL canônica ou conteúdo duplicado/quase duplicado foram agrupadas para não inflar diversidade."
    );
  }

  if (evidencias.some(evidencia => !evidencia.dependencia_detectada)) {
    limitacoes.push(
      "Domínios sem sinal detectado de duplicação não têm independência editorial comprovada; republicação com edição extensa ainda pode passar despercebida."
    );
  }

  if (
    veredito === "ATUAL" &&
    evidencias.some(
      evidencia =>
        evidencia.postura === "CONTRADICTS" &&
        !evidencia.atual
    )
  ) {
    limitacoes.push(
      "Existe uma evidência contraditória antiga ou desatualizada. Ela foi considerada, mas não prevaleceu sobre a fonte oficial atual."
    );
  }

  if (veredito === "CONFLITO") {
    limitacoes.push(
      "Foram encontradas posturas divergentes entre fontes ou evidências do mesmo domínio. O conflito não foi resolvido."
    );
  }

  return {
    status: "CLASSIFICADO",
    conclusao_factual: conclusaoFactual,
    veredito,
    resumo: criarResumoComDatas(veredito, evidencias),
    afirmacao: afirmacao.texto,
    score_qualidade_evidencia: score,
    freshness: freshnessScore,
    concordancia,
    recencia_pagina: recenciaPagina,
    atualidade_afirmacao: atualidadeAfirmacao,
    versao_regras: VERSAO_REGRAS,
    metodo: "AGREGACAO_DETERMINISTICA",
    fontes_independentes: grupos.length,
    grupos_distintos_de_evidencia: grupos.length,
    dependencia_detectada: evidencias.filter(evidencia => evidencia.dependencia_detectada).length,
    dependencia_nao_verificada: evidencias.some(evidencia => !evidencia.dependencia_detectada),
    nota_independencia: "Cópias exatas, quase duplicadas, URLs canônicas iguais e páginas do mesmo domínio são agrupadas; domínios sem sinal de cópia não têm independência editorial comprovada.",
    total_evidencias_utilizaveis: evidencias.length,
    fontes: grupos.map(grupo => ({
      dominio: grupo.dominio,
      dominios: grupo.dominios,
      grupo_dependencia_id: grupo.grupo_dependencia_id,
      oficial: grupo.oficial,
      atual: grupo.atual,
      postura: grupo.postura,
      quantidade_evidencias: grupo.evidencias.length,
      urls: grupo.evidencias.map(evidencia => evidencia.url),
      evidencias: grupo.evidencias.map(evidencia => ({
        titulo: evidencia.titulo,
        url: evidencia.url,
        categoria_fonte: evidencia.categoria_fonte,
        postura: evidencia.postura,
        atual: evidencia.atual,
        data_vinculada_ao_atributo: evidencia.data_vinculada_ao_atributo,
        status_atualidade: evidencia.status_atualidade,
        status_datas_declaradas: evidencia.status_datas_declaradas,
        consultado_em: evidencia.consultado_em,
        data_publicacao: evidencia.data_publicacao,
        data_atualizacao: evidencia.data_atualizacao,
        escopo_data: evidencia.escopo_data,
        sinais_data: evidencia.sinais_data,
        grupo_dependencia_id: evidencia.grupo_dependencia_id,
        dependencia_detectada: evidencia.dependencia_detectada,
        motivo_dependencia: evidencia.motivo_dependencia
      }))
    })),
    limitacoes,
    avaliado_em: new Date().toISOString()
  };
}

module.exports = {
  agregarEvidencias,
  determinarVeredito,
  determinarConclusaoFactual,
  criarResumo,
  calcularScore,
  normalizarDominio,
  VERSAO_REGRAS,
  VEREDITOS
};
