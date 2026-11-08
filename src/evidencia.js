
const TIPOS_FONTE = ["tavily_search", "tavily_extract"];

// Valida datas no formato ISO completo, com horário e fuso.
function validarDataISO(data) {
  if (typeof data !== "string") {
    return false;
  }

  const formatoISO =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

  const partes = data.match(formatoISO);

  if (!partes) {
    return false;
  }

  const [, ano, mes, dia, hora, minuto, segundo, fuso] = partes;

  const dataCalendario = new Date(
    Date.UTC(Number(ano), Number(mes) - 1, Number(dia))
  );

  if (
    dataCalendario.getUTCFullYear() !== Number(ano) ||
    dataCalendario.getUTCMonth() !== Number(mes) - 1 ||
    dataCalendario.getUTCDate() !== Number(dia)
  ) {
    return false;
  }

  if (
    Number(hora) > 23 ||
    Number(minuto) > 59 ||
    Number(segundo) > 59
  ) {
    return false;
  }

  if (fuso !== "Z") {
    const [horasFuso, minutosFuso] = fuso
      .slice(1)
      .split(":")
      .map(Number);

    if (horasFuso > 23 || minutosFuso > 59) {
      return false;
    }
  }

  return Number.isFinite(Date.parse(data));
}

// Valida datas de publicação e atualização.
// Aceita AAAA-MM-DD ou timestamp ISO completo.
function validarDataFonte(data) {
  if (typeof data !== "string") {
    return false;
  }

  const formatoData =
    /^(\d{4})-(\d{2})-(\d{2})$/;

  const partes = data.match(formatoData);

  if (partes) {
    const [, ano, mes, dia] = partes;

    const dataCalendario = new Date(
      Date.UTC(Number(ano), Number(mes) - 1, Number(dia))
    );

    return (
      dataCalendario.getUTCFullYear() === Number(ano) &&
      dataCalendario.getUTCMonth() === Number(mes) - 1 &&
      dataCalendario.getUTCDate() === Number(dia)
    );
  }

  return validarDataISO(data);
}

function validarEvidencia(evidencia) {
  const erros = [];

  if (
    !evidencia ||
    typeof evidencia !== "object" ||
    Array.isArray(evidencia)
  ) {
    return {
      valida: false,
      erros: ["A evidência precisa ser um objeto."]
    };
  }

  if (
    typeof evidencia.url !== "string" ||
    evidencia.url.trim() === ""
  ) {
    erros.push("URL ausente ou inválida.");
  } else {
    try {
      const url = new URL(evidencia.url);

      if (!["http:", "https:"].includes(url.protocol)) {
        erros.push("A URL precisa usar HTTP ou HTTPS.");
      }
    } catch {
      erros.push("Formato de URL inválido.");
    }
  }

  if (
    typeof evidencia.titulo !== "string" ||
    evidencia.titulo.trim() === ""
  ) {
    erros.push("Título ausente ou inválido.");
  }

  if (
    typeof evidencia.conteudo !== "string" ||
    evidencia.conteudo.trim() === ""
  ) {
    erros.push("Conteúdo ausente ou inválido.");
  }

  if (!TIPOS_FONTE.includes(evidencia.tipo_fonte)) {
    erros.push("Tipo de fonte desconhecido.");
  }

  if (!validarDataISO(evidencia.coletado_em)) {
    erros.push("Data de coleta ausente ou inválida.");
  }

  // Datas de publicação e atualização são opcionais.
  // Quando preenchidas, precisam ser datas válidas.

  for (const campo of ["data_publicacao", "data_atualizacao"]) {
    const data = evidencia[campo];

    if (
      data !== null &&
      data !== undefined &&
      !validarDataFonte(data)
    ) {
      erros.push(
        `${campo} precisa ser uma data válida no formato AAAA-MM-DD ou ISO completo.`
      );
    }
  }

  if (
    evidencia.relevancia !== null &&
    evidencia.relevancia !== undefined &&
    (
      typeof evidencia.relevancia !== "number" ||
      !Number.isFinite(evidencia.relevancia) ||
      evidencia.relevancia < 0 ||
      evidencia.relevancia > 1
    )
  ) {
    erros.push("Relevância precisa ser um número entre 0 e 1.");
  }

  return {
    valida: erros.length === 0,
    erros
  };
}

module.exports = {
  validarEvidencia,
  validarDataISO,
  validarDataFonte,
  TIPOS_FONTE
};
