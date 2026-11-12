
const LIMITE_CARACTERES = 8000;

const PALAVRAS_IGNORADAS = new Set([
  "a", "o", "as", "os", "um", "uma", "uns", "umas",
  "de", "da", "do", "das", "dos", "em", "no", "na",
  "nos", "nas", "por", "para", "com", "sem", "e",
  "ou", "que", "se", "ao", "aos", "mais", "menos",
  "como", "entre", "ate", "ser", "estar", "ter",
  "tem", "foi", "sao", "seu", "sua", "seus", "suas",

  // Termos genéricos que não identificam o assunto.
  "oferece", "oferecer", "oferecem", "oferecido",
  "oferecida", "possui", "possuem", "disponibiliza",
  "disponibilizam", "empresa", "companhia",
  "servico", "servicos", "cliente", "clientes",
  "informacao", "informacoes", "geral", "detalhes",
  "atendimento", "suporte", "tecnico", "tecnica",
  "adicional", "adicionais", "funcionamento",
  "numero", "conteudo", "sobre", "diversos",
  "diversas", "realiza", "realizam", "conta",
  "contam", "dispoe", "dispoem"
]);

const TERMOS_CONDICIONAIS = [
  "desconto", "promocao", "promocional",
  "vencimento", "pagamento", "pix", "boleto",
  "condicao", "condicoes", "exceto", "somente",
  "apenas", "durante", "primeiros", "validade",
  "apos", "antes", "juros", "multa",
  "restricao", "restricoes"
];

const TERMOS_NEGACAO = [
  "nao", "nunca", "sem", "exceto",
  "invalido", "indisponivel", "descontinuado"
];

function normalizar(texto) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function extrairTermos(texto) {
  return normalizar(texto)
    .match(/[a-z0-9]+(?:[.,][0-9]+)?/g) || [];
}

function obterTermosSignificativos(texto) {
  return extrairTermos(texto).filter(termo => (
    termo.length > 1 &&
    !PALAVRAS_IGNORADAS.has(termo)
  ));
}

function dividirEmTrechos(texto) {
  return texto
    .replace(/\r/g, "\n")
    .split(/(?<=[.!?;])\s+|\n+/)
    .map(trecho => trecho.trim())
    .filter(trecho => trecho.length > 0);
}

function pontuarTrecho(trecho, termosAfirmacao) {
  const termosTrecho = extrairTermos(trecho);
  const termosUnicos = new Set(termosTrecho);
  const trechoNormalizado = normalizar(trecho);

  let pontuacao = 0;
  let correspondenciasEspecificas = 0;

  for (const termo of termosAfirmacao) {
    if (termosUnicos.has(termo)) {
      pontuacao += 2;
      correspondenciasEspecificas++;
    }
  }

  for (const termo of TERMOS_CONDICIONAIS) {
    if (
      trechoNormalizado.includes(termo) &&
      termosAfirmacao.includes(termo)
    ) {
      pontuacao += 4;
    }
  }

  for (const termo of TERMOS_NEGACAO) {
    if (
      trechoNormalizado.includes(termo) &&
      termosAfirmacao.includes(termo)
    ) {
      pontuacao += 5;
    }
  }

  const numerosAfirmacao = termosAfirmacao.filter(
    termo => /\d/.test(termo)
  );

  for (const numero of numerosAfirmacao) {
    if (termosTrecho.includes(numero)) {
      pontuacao += 5;
    }
  }

  if (/R\$\s*[\d.,]+/i.test(trecho)) {
    pontuacao += 2;
  }

  return {
    pontuacao,
    correspondencias_especificas: correspondenciasEspecificas
  };
}

function validarEntrada(afirmacao, evidencia) {
  if (
    typeof afirmacao !== "string" ||
    afirmacao.trim() === ""
  ) {
    throw new Error("A afirmação precisa ser um texto não vazio.");
  }

  if (
    !evidencia ||
    typeof evidencia !== "object" ||
    Array.isArray(evidencia)
  ) {
    throw new Error("A evidência precisa ser um objeto válido.");
  }

  if (
    typeof evidencia.conteudo !== "string" ||
    evidencia.conteudo.trim() === ""
  ) {
    throw new Error("O conteúdo da evidência está vazio.");
  }
}

function montarConteudo(cabecalho, trechos, indicesSelecionados) {
  const trechosOrdenados = [...indicesSelecionados]
    .sort((a, b) => a - b)
    .map(indice => trechos[indice]);

  return [
    cabecalho,
    "CONTEÚDO SELECIONADO PARA ANÁLISE:",
    trechosOrdenados.join("\n\n")
  ].join("\n");
}

function selecionarTrechos(trechos, pontuacoes, limiteDisponivel) {
  const selecionados = new Set();

  const candidatos = pontuacoes
    .filter(item => (
      item.pontuacao > 0 &&
      item.correspondencias_especificas > 0
    ))
    .sort((a, b) => {
      if (b.pontuacao !== a.pontuacao) {
        return b.pontuacao - a.pontuacao;
      }

      return a.indice - b.indice;
    });

  for (const candidato of candidatos) {
    const grupo = [
      candidato.indice - 1,
      candidato.indice,
      candidato.indice + 1
    ].filter(indice => (
      indice >= 0 && indice < trechos.length
    ));

    const novosIndices = grupo.filter(
      indice => !selecionados.has(indice)
    );

    const tamanhoAdicional = novosIndices.reduce(
      (total, indice) => total + trechos[indice].length + 2,
      0
    );

    const tamanhoAtual = [...selecionados].reduce(
      (total, indice) => total + trechos[indice].length + 2,
      0
    );

    if (tamanhoAtual + tamanhoAdicional <= limiteDisponivel) {
      for (const indice of novosIndices) {
        selecionados.add(indice);
      }
    }
  }

  return selecionados;
}

function prepararEvidencia(afirmacao, evidencia) {
  validarEntrada(afirmacao, evidencia);

  const titulo = evidencia.titulo || "Título não informado";
  const url = evidencia.url || "URL não informada";
  const conteudoOriginal = evidencia.conteudo.trim();

  const cabecalho = [
    `TÍTULO DA FONTE: ${titulo}`,
    `URL DA FONTE: ${url}`,
    ""
  ].join("\n");

  const textoCompleto = [
    cabecalho,
    "CONTEÚDO DA FONTE:",
    conteudoOriginal
  ].join("\n");

  if (textoCompleto.length <= LIMITE_CARACTERES) {
    return {
      titulo,
      url,
      conteudo_original: conteudoOriginal,
      conteudo_para_analise: textoCompleto,
      reducao_aplicada: false,
      conteudo_incompleto: false,
      motivo_preparacao: "CONTEUDO_DENTRO_DO_LIMITE",
      caracteres_originais: textoCompleto.length,
      caracteres_preparados: textoCompleto.length
    };
  }

  const termosAfirmacao = obterTermosSignificativos(afirmacao);

  const trechos = dividirEmTrechos(conteudoOriginal);

  const pontuacoes = trechos.map((texto, indice) => {
    const pontuacao = pontuarTrecho(texto, termosAfirmacao);

    return {
      indice,
      ...pontuacao
    };
  });

  const limiteDisponivel =
    LIMITE_CARACTERES -
    cabecalho.length -
    "CONTEÚDO SELECIONADO PARA ANÁLISE:\n".length;

  const selecionados = selecionarTrechos(
    trechos,
    pontuacoes,
    limiteDisponivel
  );

  if (selecionados.size === 0) {
    return {
      titulo,
      url,
      conteudo_original: conteudoOriginal,
      conteudo_para_analise: textoCompleto,
      reducao_aplicada: false,
      conteudo_incompleto: false,
      motivo_preparacao: "FALLBACK_SEM_CORRESPONDENCIA_LEXICAL",
      caracteres_originais: textoCompleto.length,
      caracteres_preparados: textoCompleto.length
    };
  }

  const conteudoPreparado = montarConteudo(
    cabecalho,
    trechos,
    selecionados
  );

  if (conteudoPreparado.length > LIMITE_CARACTERES) {
    throw new Error(
      "Não foi possível preparar a evidência dentro do limite."
    );
  }

  return {
    titulo,
    url,
    conteudo_original: conteudoOriginal,
    conteudo_para_analise: conteudoPreparado,
    reducao_aplicada: true,
    conteudo_incompleto: true,
    motivo_preparacao: "TRECHOS_RELEVANTES_SELECIONADOS",
    caracteres_originais: textoCompleto.length,
    caracteres_preparados: conteudoPreparado.length
  };
}

// Remove ruído de páginas extraídas em markdown: imagens, links sem texto,
// listas de navegação e linhas muito curtas sem número.
function limparRuidoPagina(texto) {
  return String(texto ?? "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\((?:[^()]|\([^)]*\))*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .split(/\n+/)
    .map(linha => linha.replace(/^[\s>#*|\-_=]+/, "").replace(/\s+/g, " ").trim())
    .filter(linha => linha.length >= 25 || (/\d/.test(linha) && linha.length >= 6))
    .join("\n");
}

// Seleciona, dentro de um limite pequeno, os trechos mais relevantes para a
// afirmação (com vizinhos), na ordem do documento. Usado na análise em lote.
function selecionarTrechosParaLimite(afirmacao, texto, limite) {
  const limpo = limparRuidoPagina(texto);
  if (limpo.length <= limite) return limpo;
  const termos = obterTermosSignificativos(afirmacao);
  const trechos = dividirEmTrechos(limpo);
  const pontuacoes = trechos.map((t, indice) => ({ indice, ...pontuarTrecho(t, termos) }));
  const selecionados = selecionarTrechos(trechos, pontuacoes, limite);
  if (selecionados.size === 0) return limpo.slice(0, limite);
  return [...selecionados].sort((a, b) => a - b).map(i => trechos[i]).join(" … ");
}

module.exports = {
  prepararEvidencia,
  limparRuidoPagina,
  selecionarTrechosParaLimite,
  LIMITE_CARACTERES
};
