
const VERSAO_NORMALIZACAO = "1.0.0";

function normalizarFonte(conteudo) {
  if (
    typeof conteudo !== "string" ||
    conteudo.trim() === ""
  ) {
    return {
      status: "INDETERMINADO",
      versao: VERSAO_NORMALIZACAO,
      conteudo_normalizado: null,
      transformacoes: [],
      justificativa: "Não existe conteúdo textual suficiente para normalização."
    };
  }

  let resultado = conteudo;
  const transformacoes = [];

  // 1. Padroniza representações Unicode equivalentes.
  const unicodeNormalizado = resultado.normalize("NFC");

  if (unicodeNormalizado !== resultado) {
    transformacoes.push({
      regra: "UNICODE_NFC",
      descricao: "Padronização de caracteres Unicode equivalentes."
    });
  }

  resultado = unicodeNormalizado;

  // 2. Padroniza finais de linha.
  const linhasNormalizadas = resultado.replace(/\r\n?/g, "\n");

  if (linhasNormalizadas !== resultado) {
    transformacoes.push({
      regra: "LINE_ENDINGS",
      descricao: "Conversão de finais de linha para LF."
    });
  }

  resultado = linhasNormalizadas;

  return {
    status: "NORMALIZED",
    versao: VERSAO_NORMALIZACAO,
    conteudo_normalizado: resultado,
    transformacoes
  };
}

module.exports = {
  normalizarFonte,
  VERSAO_NORMALIZACAO
};
