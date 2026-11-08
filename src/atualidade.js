
const VALIDADE_MAX_DIAS = {
  preco: 30,
  versao_api: 90,
  regulamento: 365,
  empresa: 180
};

const TIPOS_FONTE_VALIDOS = [
  "tavily_search",
  "tavily_extract"
];

const CAMPOS_DE_DATA = [
  "data_publicacao",
  "data_atualizacao"
];

function validarData(dataTexto) {
  if (typeof dataTexto !== "string") {
    return false;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataTexto)) {
    return false;
  }

  const data = new Date(`${dataTexto}T00:00:00Z`);

  return (
    !Number.isNaN(data.getTime()) &&
    data.toISOString().slice(0, 10) === dataTexto
  );
}

function avaliarAtualidade(
  evidencia,
  tipoAfirmacao,
  dataReferencia = new Date()
) {
  if (
    !evidencia ||
    typeof evidencia !== "object" ||
    Array.isArray(evidencia)
  ) {
    return {
      status: "UNVERIFIABLE",
      motivo: "INVALID_EVIDENCE"
    };
  }

  if (!TIPOS_FONTE_VALIDOS.includes(evidencia.tipo_fonte)) {
    return {
      status: "UNVERIFIABLE",
      motivo: "INVALID_SOURCE_TYPE"
    };
  }

  if (!Object.hasOwn(VALIDADE_MAX_DIAS, tipoAfirmacao)) {
    return {
      status: "UNVERIFIABLE",
      motivo: "UNKNOWN_CLAIM_TYPE"
    };
  }

  if (
    !(dataReferencia instanceof Date) ||
    Number.isNaN(dataReferencia.getTime())
  ) {
    return {
      status: "UNVERIFIABLE",
      motivo: "INVALID_REFERENCE_DATE"
    };
  }

  for (const campo of CAMPOS_DE_DATA) {
    const valor = evidencia[campo];

    if (valor !== null && valor !== undefined && !validarData(valor)) {
      return {
        status: "UNVERIFIABLE",
        motivo: "INVALID_SOURCE_DATE",
        campo
      };
    }
  }

  const dataPublicacao = evidencia.data_publicacao;
  const dataAtualizacao = evidencia.data_atualizacao;

  if (!dataPublicacao && !dataAtualizacao) {
    return {
      status: "UNVERIFIABLE",
      motivo: "MISSING_SOURCE_DATE"
    };
  }

  if (
    dataPublicacao &&
    dataAtualizacao &&
    dataAtualizacao < dataPublicacao
  ) {
    return {
      status: "UNVERIFIABLE",
      motivo: "UPDATE_BEFORE_PUBLICATION"
    };
  }

  const dataMaisRecente = dataAtualizacao || dataPublicacao;
  const referenciaTexto = dataReferencia.toISOString().slice(0, 10);

  const dataEvidencia = new Date(`${dataMaisRecente}T00:00:00Z`);
  const referencia = new Date(`${referenciaTexto}T00:00:00Z`);

  if (dataEvidencia > referencia) {
    return {
      status: "UNVERIFIABLE",
      motivo: "FUTURE_SOURCE_DATE"
    };
  }

  const idadeDias = Math.floor(
    (referencia - dataEvidencia) / (1000 * 60 * 60 * 24)
  );

  const validadeMaxima = VALIDADE_MAX_DIAS[tipoAfirmacao];

  if (idadeDias > validadeMaxima) {
    return {
      status: "STALE",
      motivo: "EVIDENCE_EXPIRED",
      idade_dias: idadeDias,
      validade_maxima_dias: validadeMaxima,
      data_utilizada: dataMaisRecente
    };
  }

  return {
    status: "FRESH",
    motivo: "WITHIN_VALIDITY_PERIOD",
    idade_dias: idadeDias,
    validade_maxima_dias: validadeMaxima,
    data_utilizada: dataMaisRecente
  };
}

module.exports = {
  avaliarAtualidade,
  validarData,
  VALIDADE_MAX_DIAS,
  TIPOS_FONTE_VALIDOS
};
