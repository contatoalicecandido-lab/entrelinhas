
const VERSAO_NORMALIZACAO = "2.0.0";

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
      justificativa:
        "Não existe conteúdo textual suficiente para normalização."
    };
  }

  let resultado = conteudo;
  const transformacoes = [];

  // 1. Padroniza representações Unicode equivalentes.
  const unicodeNormalizado = resultado.normalize("NFC");

  if (unicodeNormalizado !== resultado) {
    transformacoes.push({
      regra: "UNICODE_NFC",
      descricao:
        "Padronização de caracteres Unicode equivalentes."
    });
  }

  resultado = unicodeNormalizado;

  // 2. Padroniza finais de linha.
  const linhasNormalizadas = resultado.replace(/\r\n?/g, "\n");

  if (linhasNormalizadas !== resultado) {
    transformacoes.push({
      regra: "LINE_ENDINGS",
      descricao:
        "Conversão de finais de linha para LF."
    });
  }

  resultado = linhasNormalizadas;

  // 3. Reduz sequências de espaços horizontais e tabulações.
  // As quebras de linha são preservadas.
  const espacosNormalizados = resultado.replace(/[^\S\n]+/g, " ");

  if (espacosNormalizados !== resultado) {
    transformacoes.push({
      regra: "HORIZONTAL_WHITESPACE",
      descricao:
        "Redução de sequências de espaços e tabulações a um único espaço."
    });
  }

  resultado = espacosNormalizados;

  // 4. Remove espaços horizontais no início e no final de cada linha.
  const linhasSemEspacosNasExtremidades = resultado.replace(
    /^[^\S\n]+|[^\S\n]+$/gm,
    ""
  );

  if (linhasSemEspacosNasExtremidades !== resultado) {
    transformacoes.push({
      regra: "LINE_WHITESPACE_TRIM",
      descricao:
        "Remoção de espaços horizontais nas extremidades das linhas."
    });
  }

  resultado = linhasSemEspacosNasExtremidades;

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
