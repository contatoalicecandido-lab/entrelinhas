
const PADROES = {
  negacao: /\b(não|nao|nunca|jamais|sem|nem)\b/gi,

  preco: /(?:R\$|US\$|USD|BRL|€|\$)\s*\d+(?:[.,]\d+)?|\b\d+(?:[.,]\d+)?\s*(?:reais|por cento|%)/gi,

  dataPrazo: /\b\d{1,2}\s+de\s+(?:janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+de\s+\d{4})?\b|\b(?:janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+\d{4}\b|\b\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?\b|\b\d+\s+(?:dias?|semanas?|meses?|anos?|horas?)\b/gi,

  condicao: /\b(somente|apenas|desde que|mediante|condicionado|condicionada|obrigatório|obrigatória|obrigatoriamente|exige|exigem|requer|requerem|necessário|necessária|necessita|necessitam)\b/gi,

  ressalva: /\b(sujeito\s+(?:a|à)|sujeita\s+(?:a|à)|salvo|exceto|limitado|limitada|restrito|restrita|exclusivo|exclusiva|não cumulativo|não cumulativa|nao cumulativo|nao cumulativa|consulte condições|consulte condicoes|conforme disponibilidade)\b/gi
};

const PRIORIDADE = {
  negacao: "ALTO",
  preco: "ALTO",
  dataPrazo: "ALTO",
  condicao: "ALTO",
  ressalva: "MEDIO"
};

const DISTANCIA_MAXIMA_CONDICAO = 4;

function obterTexto(valor) {
  if (typeof valor === "string") {
    return valor;
  }

  if (Array.isArray(valor)) {
    return valor
      .filter(item => typeof item === "string")
      .join(" ");
  }

  return "";
}

function normalizarTexto(texto) {
  return texto
    .normalize("NFC")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarToken(token) {
  return normalizarTexto(token)
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

function obterListaTokens(valor) {
  if (Array.isArray(valor)) {
    return valor
      .filter(item => typeof item === "string")
      .flatMap(item => item.split(/\s+/))
      .map(normalizarToken)
      .filter(Boolean);
  }

  return obterTexto(valor)
    .split(/\s+/)
    .map(normalizarToken)
    .filter(Boolean);
}

function dividirFrases(texto) {
  return texto
    .split(/(?<=[.!?;])\s+/)
    .filter(frase => frase.trim() !== "");
}

function obterFrasesAfetadas(texto, tokensAlterados) {
  if (!texto.trim() || tokensAlterados.length === 0) {
    return [];
  }

  const tokens = new Set(tokensAlterados);

  return dividirFrases(texto).filter(frase => {
    const tokensFrase = frase
      .split(/\s+/)
      .map(normalizarToken);

    return tokensFrase.some(token => tokens.has(token));
  });
}

function extrairIndicadores(texto, padrao) {
  const regex = new RegExp(padrao.source, padrao.flags);

  return [...texto.matchAll(regex)]
    .map(resultado => normalizarTexto(resultado[0]))
    .sort();
}

function indicadoresMudaram(anteriores, atuais) {
  return JSON.stringify(anteriores) !== JSON.stringify(atuais);
}

function localizarCondicao(texto, tokensAlterados) {
  const tokens = texto
    .split(/\s+/)
    .map(normalizarToken);

  const regex = new RegExp(
    PADROES.condicao.source,
    PADROES.condicao.flags
  );

  const marcadores = [];

  for (const resultado of texto.matchAll(regex)) {
    const posicao = resultado.index;

    const indice = texto
      .slice(0, posicao)
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;

    marcadores.push(indice);
  }

  for (const marcador of marcadores) {
    for (
      let distancia = 0;
      distancia <= DISTANCIA_MAXIMA_CONDICAO;
      distancia++
    ) {
      const indice = marcador + distancia;
      const token = tokens[indice];

      if (token && tokensAlterados.includes(token)) {
        return true;
      }
    }
  }

  return false;
}

function avaliarCondicao(
  frasesAnteriores,
  frasesAtuais,
  tokensRemovidos,
  tokensAdicionados
) {
  const anteriores = frasesAnteriores.join(" ");
  const atuais = frasesAtuais.join(" ");

  const marcadoresAnteriores = extrairIndicadores(
    anteriores,
    PADROES.condicao
  );

  const marcadoresAtuais = extrairIndicadores(
    atuais,
    PADROES.condicao
  );

  // A presença ou ausência de um marcador mudou.
  if (
    indicadoresMudaram(
      marcadoresAnteriores,
      marcadoresAtuais
    )
  ) {
    return true;
  }

  // O marcador permaneceu, mas o conteúdo próximo a ele mudou.
  return (
    localizarCondicao(anteriores, tokensRemovidos) ||
    localizarCondicao(atuais, tokensAdicionados)
  );
}

function avaliarRessalva(
  frasesAnteriores,
  frasesAtuais
) {
  const anteriores = frasesAnteriores.join(" ");
  const atuais = frasesAtuais.join(" ");

  const indicadoresAnteriores = extrairIndicadores(
    anteriores,
    PADROES.ressalva
  );

  const indicadoresAtuais = extrairIndicadores(
    atuais,
    PADROES.ressalva
  );

  return indicadoresMudaram(
    indicadoresAnteriores,
    indicadoresAtuais
  );
}

function resultadoIndeterminado(motivo) {
  return {
    status: "INDETERMINADO",
    nivel: "INDETERMINADO",
    motivos: [motivo],
    sinais_detectados: []
  };
}

function avaliarImpacto(alteracao) {
  if (!alteracao || typeof alteracao !== "object") {
    return resultadoIndeterminado(
      "Não foi fornecida uma alteração válida."
    );
  }

  const removidos = obterTexto(
    alteracao.trechos_removidos
  );

  const adicionados = obterTexto(
    alteracao.trechos_adicionados
  );

  const textoAnterior = obterTexto(
    alteracao.trecho_anterior_contextualizado || removidos
  );

  const textoAtual = obterTexto(
    alteracao.trecho_atual_contextualizado || adicionados
  );

  if (!textoAnterior.trim() && !textoAtual.trim()) {
    return resultadoIndeterminado(
      "Não há conteúdo suficiente para avaliar a alteração."
    );
  }

  const tokensRemovidos = obterListaTokens(
    alteracao.trechos_removidos
  );

  const tokensAdicionados = obterListaTokens(
    alteracao.trechos_adicionados
  );

  if (
    tokensRemovidos.length === 0 &&
    tokensAdicionados.length === 0
  ) {
    return resultadoIndeterminado(
      "Não foram encontrados trechos efetivamente alterados."
    );
  }

  const frasesAnteriores = obterFrasesAfetadas(
    textoAnterior,
    tokensRemovidos
  );

  const frasesAtuais = obterFrasesAfetadas(
    textoAtual,
    tokensAdicionados
  );

  if (
    frasesAnteriores.length === 0 &&
    frasesAtuais.length === 0
  ) {
    return resultadoIndeterminado(
      "Não foi possível relacionar os trechos alterados ao contexto disponível."
    );
  }

  const anterior = frasesAnteriores.join(" ");
  const atual = frasesAtuais.join(" ");

  const sinaisDetectados = [];

  // Negação: verifica se a presença ou quantidade mudou.
  const negacoesAnteriores = extrairIndicadores(
    anterior,
    PADROES.negacao
  );

  const negacoesAtuais = extrairIndicadores(
    atual,
    PADROES.negacao
  );

  if (
    indicadoresMudaram(
      negacoesAnteriores,
      negacoesAtuais
    )
  ) {
    sinaisDetectados.push("negacao");
  }

  // Preço: compara os valores encontrados antes e depois.
  const precosAnteriores = extrairIndicadores(
    anterior,
    PADROES.preco
  );

  const precosAtuais = extrairIndicadores(
    atual,
    PADROES.preco
  );

  if (
    indicadoresMudaram(
      precosAnteriores,
      precosAtuais
    )
  ) {
    sinaisDetectados.push("preco");
  }

  // Prazo: compara datas e durações completas.
  const prazosAnteriores = extrairIndicadores(
    anterior,
    PADROES.dataPrazo
  );

  const prazosAtuais = extrairIndicadores(
    atual,
    PADROES.dataPrazo
  );

  if (
    indicadoresMudaram(
      prazosAnteriores,
      prazosAtuais
    )
  ) {
    sinaisDetectados.push("dataPrazo");
  }

  // Condição: verifica mudança no marcador ou no conteúdo
  // diretamente associado a ele.
  if (
    avaliarCondicao(
      frasesAnteriores,
      frasesAtuais,
      tokensRemovidos,
      tokensAdicionados
    )
  ) {
    sinaisDetectados.push("condicao");
  }

  // Ressalva: compara os indicadores entre as versões.
  if (
    avaliarRessalva(
      frasesAnteriores,
      frasesAtuais
    )
  ) {
    sinaisDetectados.push("ressalva");
  }

  if (sinaisDetectados.length === 0) {
    return {
      status: "CLASSIFICADO",
      nivel: "BAIXO",
      motivos: [
        "Nenhuma mudança nos indicadores de preço, prazo, negação, condição ou ressalva foi identificada nas frases afetadas."
      ],
      sinais_detectados: []
    };
  }

  const motivos = sinaisDetectados.map(
    sinal =>
      `Foi identificada uma mudança no indicador de ${sinal} entre as versões comparadas.`
  );

  const nivel = sinaisDetectados.some(
    sinal => PRIORIDADE[sinal] === "ALTO"
  )
    ? "ALTO"
    : "MEDIO";

  return {
    status: "CLASSIFICADO",
    nivel,
    motivos,
    sinais_detectados: sinaisDetectados
  };
}

module.exports = {
  avaliarImpacto
};
