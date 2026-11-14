
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

// Janelas por ENTIDADE: alguns valores oficiais mudam bem mais rápido que a
// regra geral de "leis e regras, cerca de um ano". Cada janela tem um motivo
// público e verificável. Valem para qualquer categoria em que o termo apareça.
const JANELAS_POR_ENTIDADE = [
  { entidade: "selic", padrao: /\bselic\b/i, dias: 45,
    motivo: "Brazil's Copom reviews the Selic rate about every 45 days (8 meetings a year)" },
  { entidade: "salario_minimo", padrao: /sal[áa]rio m[íi]nimo/i, dias: 365,
    motivo: "Brazil's minimum wage is set once a year, in force from 1 January" },
  { entidade: "inflacao", padrao: /\b(ipca|inpc|infla[çc][ãa]o|inflation rate|consumer price index|CPI)\b/i, dias: 30,
    motivo: "official inflation figures are published every month" }
];

// Janela de validade de uma afirmação: a da entidade, se houver; senão, a da
// categoria. Devolve null quando não há categoria nem entidade conhecida.
function janelaDeValidade(tipoAfirmacao, texto = "") {
  const entidade = JANELAS_POR_ENTIDADE.find(j => j.padrao.test(String(texto)));
  if (entidade) return { dias: entidade.dias, origem: "ENTITY", entidade: entidade.entidade, motivo: entidade.motivo };
  const dias = VALIDADE_MAX_DIAS[tipoAfirmacao];
  return Number.isInteger(dias) ? { dias, origem: "CATEGORY", entidade: null, motivo: null } : null;
}

function avaliarAtualidade(
  evidencia,
  tipoAfirmacao,
  dataReferencia = new Date(),
  janelaDias = null
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

  const validadeMaxima = Number.isInteger(janelaDias) && janelaDias > 0 ? janelaDias : VALIDADE_MAX_DIAS[tipoAfirmacao];

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
  JANELAS_POR_ENTIDADE,
  janelaDeValidade,
  TIPOS_FONTE_VALIDOS
};
