
const { randomUUID, createHash } = require("node:crypto");
const { validarEvidencia } = require("./evidencia");
const { normalizarFonte } = require("./normalizar-fonte");
const sinaisTemporais = require("./sinais-temporais");

const MAX_RESULTADOS_BUSCA = 5;
const MAX_FONTES_EXTRAIDAS = 3;
const VERSAO_CANONICALIZACAO = "1.0.0";

async function notificarRastreabilidade(callback, dados) {
  if (typeof callback !== "function") {
    return;
  }

  try {
    await callback(dados);
  } catch (erro) {
    console.warn(
      "Não foi possível registrar a rastreabilidade da Tavily:",
      erro.message
    );
  }
}

// Converte a data retornada pela Tavily para YYYY-MM-DD.
function normalizarDataPublicacao(data) {
  if (typeof data !== "string" || data.trim() === "") {
    return null;
  }

  const dataInterpretada = new Date(data);

  if (Number.isNaN(dataInterpretada.getTime())) {
    return null;
  }

  return dataInterpretada.toISOString().slice(0, 10);
}

// Canonicalização conservadora.
// Preserva protocolo, caminho, parâmetros e fragmento.
function canonicalizarUrl(urlOriginal) {
  if (
    typeof urlOriginal !== "string" ||
    urlOriginal.trim() === ""
  ) {
    throw new Error("URL inválida para canonicalização.");
  }

  const url = new URL(urlOriginal);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(
      "A canonicalização aceita somente URLs HTTP ou HTTPS."
    );
  }

  url.hostname = url.hostname.toLowerCase();

  if (
    (url.protocol === "http:" && url.port === "80") ||
    (url.protocol === "https:" && url.port === "443")
  ) {
    url.port = "";
  }

  return url.toString();
}

function gerarHashConteudo(conteudo) {
  if (typeof conteudo !== "string") {
    throw new Error("O conteúdo precisa ser uma string.");
  }

  return createHash("sha256")
    .update(conteudo, "utf8")
    .digest("hex");
}

// Tempo máximo de uma chamada à Tavily. Sem isso, uma conexão travada
// deixaria a verificação inteira esperando indefinidamente.
const TEMPO_LIMITE_TAVILY_MS = 45000;

async function fazerRequisicaoTavily(endpoint, corpo) {
  let resposta;
  try {
    resposta = await fetch(
      `https://api.tavily.com/${endpoint}`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.TAVILY_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(TEMPO_LIMITE_TAVILY_MS)
      }
    );
  } catch (erro) {
    if (erro?.name === "TimeoutError" || erro?.name === "AbortError") {
      throw new Error(`Erro Tavily: sem resposta em ${TEMPO_LIMITE_TAVILY_MS / 1000} segundos (${endpoint}).`);
    }
    throw erro;
  }

  let dados;
  try {
    dados = await resposta.json();
  } catch {
    throw new Error(`Erro Tavily (${resposta.status}): resposta não é JSON válido.`);
  }

  if (!resposta.ok) {
    throw new Error(
      `Erro Tavily (${resposta.status}): ${JSON.stringify(dados)}`
    );
  }

  return dados;
}

function criarRegistroBase(opcoes, etapa, consulta) {
  return {
    id_operacao: randomUUID(),
    id_verificacao: opcoes.idVerificacao ?? null,
    id_afirmacao: opcoes.idAfirmacao ?? null,
    provedor: "tavily",
    etapa,
    consulta,
    status: "INICIADA",
    iniciada_em: new Date().toISOString(),
    finalizada_em: null,
    duracao_ms: null,
    request_id: null,
    response_time: null,
    erro: null
  };
}

async function extrairConteudo(urls, pergunta, opcoes = {}) {
  const registro = criarRegistroBase(
    opcoes,
    "EXTRACAO",
    pergunta
  );

  registro.urls_solicitadas = [...urls];

  const parametrosExtracao = {
    urls,
    extract_depth: "basic",
    format: "markdown",
    include_images: false
  };

  registro.parametros = parametrosExtracao;

  if (!Array.isArray(urls) || urls.length === 0) {
    registro.status = "IGNORADA";
    registro.finalizada_em = new Date().toISOString();
    registro.duracao_ms = 0;
    registro.quantidade_resultados = 0;
    registro.urls_extraidas = [];

    await notificarRastreabilidade(
      opcoes.onMetadata,
      registro
    );

    return {
      resultados: [],
      erro: null,
      registro
    };
  }

  const inicio = Date.now();

  try {
    const dados = await fazerRequisicaoTavily(
      "extract",
      parametrosExtracao
    );

    const resultados = Array.isArray(dados.results)
      ? dados.results
      : [];

    registro.status = "SUCESSO";
    registro.request_id = dados.request_id ?? null;
    registro.response_time = dados.response_time ?? null;
    registro.quantidade_resultados = resultados.length;
    registro.urls_extraidas = resultados.map(
      resultado => resultado.url
    );
    registro.finalizada_em = new Date().toISOString();
    registro.duracao_ms = Date.now() - inicio;

    await notificarRastreabilidade(
      opcoes.onMetadata,
      registro
    );

    return {
      resultados,
      erro: null,
      request_id: dados.request_id ?? null,
      response_time: dados.response_time ?? null,
      registro
    };

  } catch (erro) {
    registro.status = "ERRO";
    registro.erro = erro.message;
    registro.quantidade_resultados = 0;
    registro.urls_extraidas = [];
    registro.finalizada_em = new Date().toISOString();
    registro.duracao_ms = Date.now() - inicio;

    await notificarRastreabilidade(
      opcoes.onMetadata,
      registro
    );

    return {
      resultados: [],
      erro: erro.message,
      registro
    };
  }
}

function normalizarDominiosOficiais(dominios) {
  if (dominios == null) return [];
  if (!Array.isArray(dominios)) {
    throw new Error("dominiosOficiais precisa ser uma lista.");
  }

  return [...new Set(dominios.map(valor => {
    if (typeof valor !== "string" || !valor.trim()) {
      throw new Error("A lista de domínios oficiais contém um valor inválido.");
    }

    const entrada = valor.includes("://") ? valor : `https://${valor}`;
    const url = new URL(entrada);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Domínios oficiais precisam usar HTTP ou HTTPS.");
    }
    return url.hostname.toLowerCase().replace(/^www\./, "");
  }))];
}

async function executarBusca(pergunta, opcoes, dominiosOficiais = []) {
  const registro = criarRegistroBase(opcoes, "BUSCA", pergunta);
  const parametros = {
    query: pergunta,
    search_depth: "basic",
    max_results: MAX_RESULTADOS_BUSCA,
    include_answer: false,
    include_published_date: true
  };

  if (dominiosOficiais.length > 0) {
    parametros.include_domains = dominiosOficiais;
    registro.modo_busca = "DOMINIOS_OFICIAIS";
  } else {
    registro.modo_busca = "GERAL";
  }
  registro.parametros = parametros;

  const inicio = Date.now();
  try {
    const dados = await fazerRequisicaoTavily("search", parametros);
    if (!Array.isArray(dados.results)) {
      throw new Error("A Tavily não retornou uma lista válida de resultados.");
    }

    registro.status = "SUCESSO";
    registro.request_id = dados.request_id ?? null;
    registro.response_time = dados.response_time ?? null;
    registro.quantidade_resultados = dados.results.length;
    registro.resultados = dados.results.map(resultado => ({
      resultado_id: resultado.id ?? null,
      titulo: resultado.title ?? null,
      url: resultado.url ?? null,
      relevancia: resultado.score ?? null,
      data_publicacao: normalizarDataPublicacao(resultado.published_date)
    }));
    registro.finalizada_em = new Date().toISOString();
    registro.duracao_ms = Date.now() - inicio;
    await notificarRastreabilidade(opcoes.onMetadata, registro);
    return { dados, registro, erro: null };
  } catch (erro) {
    registro.status = "ERRO";
    registro.erro = erro.message;
    registro.finalizada_em = new Date().toISOString();
    registro.duracao_ms = Date.now() - inicio;
    await notificarRastreabilidade(opcoes.onMetadata, registro);
    return { dados: null, registro, erro };
  }
}

async function pesquisarComTavily(pergunta, opcoes = {}) {
  if (typeof pergunta !== "string" || pergunta.trim() === "") {
    throw new Error("A pergunta para a Tavily não pode estar vazia.");
  }

  if (!process.env.TAVILY_API_KEY) {
    throw new Error("A chave da API da Tavily não foi configurada.");
  }

  const dominiosOficiais = normalizarDominiosOficiais(
    opcoes.dominiosOficiais
  );
  const buscaGeral = await executarBusca(pergunta, opcoes);
  if (buscaGeral.erro) throw buscaGeral.erro;

  const buscas = [buscaGeral];
  if (dominiosOficiais.length > 0) {
    const buscaOficial = await executarBusca(
      pergunta,
      opcoes,
      dominiosOficiais
    );
    if (!buscaOficial.erro) buscas.push(buscaOficial);
  }

  const resultadosPorUrl = new Map();
  for (const busca of buscas) {
    for (const resultado of busca.dados.results) {
      if (typeof resultado.url !== "string" || !resultado.url.startsWith("http")) {
        continue;
      }
      let chave;
      try {
        chave = canonicalizarUrl(resultado.url);
      } catch {
        chave = resultado.url;
      }

      const origem = {
        id_operacao: busca.registro.id_operacao,
        request_id: busca.registro.request_id,
        modo_busca: busca.registro.modo_busca,
        resultado_id: resultado.id ?? null,
        parametros: busca.registro.parametros
      };
      const existente = resultadosPorUrl.get(chave);
      if (!existente) {
        resultadosPorUrl.set(chave, {
          ...resultado,
          _origem_principal: origem,
          _origens_busca: [origem]
        });
      } else {
        existente._origens_busca.push(origem);
        if ((resultado.score ?? 0) > (existente.score ?? 0)) {
          existente._origem_principal = origem;
          existente.score = resultado.score;
          existente.content = resultado.content;
          existente.title = resultado.title;
          existente.published_date = resultado.published_date;
          existente.raw_content = resultado.raw_content;
          existente.id = resultado.id;
        }
      }
    }
  }

  const resultadosBusca = [...resultadosPorUrl.values()];
  const dominioEhOficial = resultado => {
    let host;
    try {
      host = new URL(resultado.url).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      return false;
    }
    return dominiosOficiais.some(dominio =>
      host === dominio || host.endsWith(`.${dominio}`)
    );
  };

  if (dominiosOficiais.length > 0) {
    resultadosBusca.sort((a, b) =>
      Number(dominioEhOficial(b)) - Number(dominioEhOficial(a)) ||
      (b.score ?? 0) - (a.score ?? 0)
    );
  }

  // Seleciona até três URLs; fontes oficiais têm prioridade se solicitadas.
  const selecionadosParaExtracao = [...resultadosBusca]
    .filter(resultado =>
      typeof resultado.url === "string" &&
      resultado.url.startsWith("http")
    )
    .sort((a, b) =>
      Number(dominioEhOficial(b)) - Number(dominioEhOficial(a)) ||
      (b.score ?? 0) - (a.score ?? 0)
    )
    .slice(0, MAX_FONTES_EXTRAIDAS);

  const urlsSelecionadas = selecionadosParaExtracao.map(
    resultado => resultado.url
  );

  // Executa a extração e preserva sua identidade operacional.
  const [dadosExtracao, metadadosPaginas] = await Promise.all([
    extrairConteudo(urlsSelecionadas, pergunta, opcoes),
    Promise.all(urlsSelecionadas.map(async url => {
      try {
        const resultado = await sinaisTemporais.obterMetadadosPagina(url, {
          claim: pergunta,
          claimType: opcoes.tipoAfirmacao
        });
        return [url, resultado];
      } catch (erro) {
        return [url, { status: "UNAVAILABLE", reason: "METADATA_FETCH_ERROR", detail: erro.message, signals: [] }];
      }
    }))
  ]);

  const metadadosPaginaPorUrl = new Map(metadadosPaginas);

  const extracoesPorUrl = new Map(
    dadosExtracao.resultados.map(resultado => [
      resultado.url,
      resultado
    ])
  );

  // Combina busca e extração.
  const buscaPrincipal = buscaGeral;
  const evidencias = resultadosBusca.map(resultado => {
    const origemPrincipal = resultado._origem_principal;
    const buscaDaFonte = buscas.find(
      busca => busca.registro.id_operacao === origemPrincipal?.id_operacao
    ) ?? buscaPrincipal;
    const extracao = extracoesPorUrl.get(resultado.url);

    const conteudoExtraido =
      typeof extracao?.raw_content === "string" &&
      extracao.raw_content.trim() !== ""
        ? extracao.raw_content
        : null;

    const extracaoConcluida = Boolean(conteudoExtraido);

    const conteudoOriginal =
      conteudoExtraido ?? resultado.content;

    const tipoFonte = extracaoConcluida
      ? "tavily_extract"
      : "tavily_search";

    const coletadoEm = extracaoConcluida
      ? dadosExtracao.registro.finalizada_em
      : buscaDaFonte.registro.finalizada_em;

    const normalizacao = normalizarFonte(conteudoOriginal);

    const dataPublicacaoOriginal =
      resultado.published_date ?? null;

    const dataPublicacao = normalizarDataPublicacao(
      dataPublicacaoOriginal
    );

    const metadadosPagina = metadadosPaginaPorUrl.get(resultado.url) ?? {
      status: "SKIPPED", reason: "URL_NOT_SELECTED_FOR_METADATA", signals: []
    };
    const sinaisExtraidosDoConteudo = sinaisTemporais.extrairSinaisTemporais({
      html: conteudoOriginal,
      claim: pergunta,
      claimType: opcoes.tipoAfirmacao
    });
    const sinaisData = [
      ...(dataPublicacaoOriginal ? [{
        signal_type: "TAVILY_PUBLISHED_DATE_ESTIMATE",
        field: "published_date",
        value_original: dataPublicacaoOriginal,
        value_normalized: dataPublicacao,
        source: "TAVILY_SEARCH_RESULT",
        scope: "PAGE"
      }] : []),
      ...(metadadosPagina.signals ?? []),
      ...sinaisExtraidosDoConteudo
    ];
    const datasAtributo = [...new Set(sinaisData
      .filter(sinal => sinal.scope === "ATTRIBUTE" && sinal.value_normalized)
      .map(sinal => sinal.value_normalized))];
    const dataAtributo = datasAtributo.length === 1 ? datasAtributo[0] : null;
    if (datasAtributo.length > 1) {
      sinaisData.push({ signal_type: "ATTRIBUTE_DATE_CONFLICT", scope: "UNKNOWN",
        values: datasAtributo, source: "SIGNAL_RECONCILIATION" });
    }
    const sinalCanonical = sinaisData.find(sinal => sinal.signal_type === "HTML_CANONICAL_URL");

    return {
      tipo_fonte: tipoFonte,
      titulo: resultado.title,
      url: resultado.url,
      conteudo: conteudoOriginal,
      normalizacao,
      coletado_em: coletadoEm,
      data_publicacao: dataAtributo ? null : dataPublicacao,
      data_atualizacao: dataAtributo,
      // Tavily Search fornece uma data associada ao resultado/página. Ela não
      // demonstra quando um atributo específico (ex.: preço) foi atualizado.
      escopo_data: dataAtributo ? "ATTRIBUTE" : dataPublicacao ? "PAGE" : "UNKNOWN",
      canonical_url: sinalCanonical?.value_original ?? null,
      relevancia: resultado.score ?? null,

      metadados_provedor: {
        provedor: "tavily",
        request_id: origemPrincipal?.request_id ?? null,
        resultado_id: resultado.id ?? null,
        response_time_busca: buscaDaFonte.registro.response_time,
        response_time_extracao:
          dadosExtracao.response_time ?? null,
        consulta: pergunta,
        origem_principal: origemPrincipal,
        buscas: resultado._origens_busca ?? [],
        raw_content_busca: resultado.raw_content ?? null,
        data_publicacao_original: dataPublicacaoOriginal,
        sinais_data: sinaisData,
        metadados_pagina: {
          status: metadadosPagina.status,
          motivo: metadadosPagina.reason ?? null,
          detalhe: metadadosPagina.detail ?? null,
          url_final: metadadosPagina.final_url ?? null,
          capturado_em: metadadosPagina.captured_at ?? null
        },

        extracao: {
          tentada: urlsSelecionadas.includes(resultado.url),
          concluida: extracaoConcluida,
          request_id: dadosExtracao.request_id ?? null,
          erro: dadosExtracao.erro
        }
      }
    };
  });

  // Valida as evidências antes de criar suas coletas.
  const evidenciasValidas = [];

  for (const evidencia of evidencias) {
    const validacao = validarEvidencia(evidencia);

    if (!validacao.valida) {
      throw new Error(
        `Evidência inválida retornada pela Tavily: ${validacao.erros.join("; ")}`
      );
    }

    const urlCanonica = canonicalizarUrl(evidencia.url);
    const origemPrincipal = evidencia.metadados_provedor.origem_principal;
    const buscaDaFonte = buscas.find(
      busca => busca.registro.id_operacao === origemPrincipal?.id_operacao
    ) ?? buscaPrincipal;

    const coleta = {
      id_coleta: randomUUID(),
      id_verificacao: opcoes.idVerificacao ?? null,

      url_original: evidencia.url,
      url_canonica: urlCanonica,
      versao_canonicalizacao: VERSAO_CANONICALIZACAO,

      tipo_fonte: evidencia.tipo_fonte,
      status_coleta: "SUCCESS",

      conteudo: evidencia.conteudo,
      hash_conteudo: gerarHashConteudo(evidencia.conteudo),
      coletado_em: evidencia.coletado_em,

      id_operacao_busca:
        origemPrincipal?.id_operacao ?? buscaGeral.registro.id_operacao,

      id_operacao_extracao:
  urlsSelecionadas.includes(evidencia.url)
    ? dadosExtracao.registro.id_operacao
    : null,

      consulta: pergunta,

      parametros_busca: { ...buscaDaFonte.registro.parametros },

      parametros_extracao:
        urlsSelecionadas.includes(evidencia.url)
          ? {
              urls: [...urlsSelecionadas],
              extract_depth: "basic",
              format: "markdown",
              include_images: false
            }
          : null,

      metadados: {
        provedor: "tavily",
        request_id_busca: origemPrincipal?.request_id ?? null,
        operacoes_busca: evidencia.metadados_provedor.buscas,
        request_id_extracao:
          dadosExtracao.request_id ?? null,
        resultado_id:
          evidencia.metadados_provedor.resultado_id,
        relevancia: evidencia.relevancia,
        sinais_data: evidencia.metadados_provedor.sinais_data,
        metadados_pagina: evidencia.metadados_provedor.metadados_pagina,
        extracao: {
          tentada:
            evidencia.metadados_provedor.extracao.tentada,
          concluida:
            evidencia.metadados_provedor.extracao.concluida,
          erro:
            evidencia.metadados_provedor.extracao.erro
        }
      }
    };

    evidenciasValidas.push({
      ...evidencia,
      coleta
    });
  }

  return evidenciasValidas;
}

module.exports = {
  pesquisarComTavily
};
