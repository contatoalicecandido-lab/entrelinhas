
const { validarData } = require("./atualidade");

const VERSAO_REGRAS = "1.1.0";

const VEREDITOS = [
  "ATUAL",
  "CONTRADITA_POR_FONTE_ATUAL",
  "CONFLITO",
  "SUPORTE_FRACO",
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

      const oficial = dominioEhOficial(
        dominio,
        dominiosOficiais
      );

      const possuiDataVerificavel = dataVerificavel(fonte);

      const atual =
        utilizavel &&
        atualidade.status === "FRESH" &&
        possuiDataVerificavel;

      return {
        titulo: fonte.titulo ?? null,
        url: fonte.url ?? null,
        dominio,
        tipo_fonte: fonte.tipo_fonte ?? null,
        postura: utilizavel ? postura : null,
        utilizavel,
        oficial,
        atual,
        status_atualidade: atualidade.status ?? "UNVERIFIABLE",
        data_publicacao: fonte.data_publicacao ?? null,
        data_atualizacao: fonte.data_atualizacao ?? null,
        justificativa: classificacao.justificativa ?? null
      };
    })
    .filter(evidencia => evidencia.utilizavel);
}

function agruparPorDominio(evidencias) {
  const grupos = new Map();

  for (const evidencia of evidencias) {
    if (!grupos.has(evidencia.dominio)) {
      grupos.set(evidencia.dominio, {
        dominio: evidencia.dominio,
        oficial: evidencia.oficial,
        atual: false,
        posturas: new Set(),
        evidencias: []
      });
    }

    const grupo = grupos.get(evidencia.dominio);

    grupo.atual = grupo.atual || evidencia.atual;
    grupo.posturas.add(evidencia.postura);
    grupo.evidencias.push(evidencia);
  }

  return [...grupos.values()].map(grupo => ({
    ...grupo,
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

  const independencia = Math.round(
    Math.min(totalFontes, 2) / 2 * 20
  );

  const concordancia = totalFontes === 0
    ? 0
    : haConflito ? 0 : 10;

  const total =
    autoridade +
    atualidade +
    independencia +
    concordancia;

  return {
    valor: total,
    escala: "0-100",
    natureza: "HEURISTICA",
    interpretacao: "Qualidade estrutural das evidências, não probabilidade de verdade.",
    componentes: {
      autoridade,
      atualidade,
      independencia,
      concordancia
    }
  };
}

function determinarVeredito(grupos) {
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
    // Uma contradição atual independente ainda merece conflito.
    const haContradicaoAtual = grupos.some(
      grupo => grupo.atual && grupo.postura === "CONTRADICTS"
    );

    return haContradicaoAtual
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
    return "CONFLITO";
  }

  if (haApoio) {
    return "SUPORTE_FRACO";
  }

  return "NAO_VERIFICAVEL";
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

  const evidencias = prepararEvidencias(
    afirmacao,
    configuracao.dominiosOficiais
  );

  const grupos = agruparPorDominio(evidencias);

  const veredito = determinarVeredito(grupos);
  const score = calcularScore(grupos);

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

  if (!evidencias.some(evidencia => evidencia.oficial)) {
    limitacoes.push(
      "Nenhuma fonte pertence ao cadastro de domínios oficiais informado."
    );
  }

  if (grupos.length < evidencias.length) {
    limitacoes.push(
      "Evidências do mesmo domínio foram agrupadas e não contam como fontes independentes."
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
    veredito,
    afirmacao: afirmacao.texto,
    score_qualidade_evidencia: score,
    versao_regras: VERSAO_REGRAS,
    metodo: "AGREGACAO_DETERMINISTICA",
    fontes_independentes: grupos.length,
    total_evidencias_utilizaveis: evidencias.length,
    fontes: grupos.map(grupo => ({
      dominio: grupo.dominio,
      oficial: grupo.oficial,
      atual: grupo.atual,
      postura: grupo.postura,
      quantidade_evidencias: grupo.evidencias.length,
      urls: grupo.evidencias.map(evidencia => evidencia.url),
      evidencias: grupo.evidencias.map(evidencia => ({
        titulo: evidencia.titulo,
        url: evidencia.url,
        postura: evidencia.postura,
        atual: evidencia.atual,
        status_atualidade: evidencia.status_atualidade,
        data_publicacao: evidencia.data_publicacao,
        data_atualizacao: evidencia.data_atualizacao
      }))
    })),
    limitacoes,
    avaliado_em: new Date().toISOString()
  };
}

module.exports = {
  agregarEvidencias,
  determinarVeredito,
  calcularScore,
  normalizarDominio,
  VERSAO_REGRAS,
  VEREDITOS
};
