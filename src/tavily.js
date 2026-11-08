
const { randomUUID } = require("node:crypto");
const { validarEvidencia } = require("./evidencia");
const { normalizarFonte } = require("./normalizar-fonte");

const MAX_RESULTADOS_BUSCA = 5;
const MAX_FONTES_EXTRAIDAS = 3;

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
// Se a data não puder ser interpretada, mantém null.
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

async function fazerRequisicaoTavily(endpoint, corpo) {
  const resposta = await fetch(`https://api.tavily.com/${endpoint}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.TAVILY_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(corpo)
  });

  const dados = await resposta.json();

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
      erro: null
    };
  }

  const inicio = Date.now();

  try {
    const dados = await fazerRequisicaoTavily("extract", {
      urls,
      extract_depth: "basic",
      format: "markdown",
      include_images: false
    });

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
      response_time: dados.response_time ?? null
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
      erro: erro.message
    };
  }
}

async function pesquisarComTavily(pergunta, opcoes = {}) {
  if (typeof pergunta !== "string" || pergunta.trim() === "") {
    throw new Error("A pergunta para a Tavily não pode estar vazia.");
  }

  if (!process.env.TAVILY_API_KEY) {
    throw new Error("A chave da API da Tavily não foi configurada.");
  }

  const registroBusca = criarRegistroBase(
    opcoes,
    "BUSCA",
    pergunta
  );

  const inicioBusca = Date.now();

  let dadosBusca;

  try {
    dadosBusca = await fazerRequisicaoTavily("search", {
      query: pergunta,
      search_depth: "basic",
      max_results: MAX_RESULTADOS_BUSCA,
      include_answer: false,
      include_published_date: true
    });

    if (!Array.isArray(dadosBusca.results)) {
      throw new Error(
        "A Tavily não retornou uma lista válida de resultados."
      );
    }

    registroBusca.status = "SUCESSO";
    registroBusca.request_id = dadosBusca.request_id ?? null;
    registroBusca.response_time = dadosBusca.response_time ?? null;
    registroBusca.quantidade_resultados = dadosBusca.results.length;

    registroBusca.resultados = dadosBusca.results.map(resultado => ({
      resultado_id: resultado.id ?? null,
      titulo: resultado.title ?? null,
      url: resultado.url ?? null,
      relevancia: resultado.score ?? null,
      data_publicacao: normalizarDataPublicacao(
        resultado.published_date
      )
    }));

    registroBusca.finalizada_em = new Date().toISOString();
    registroBusca.duracao_ms = Date.now() - inicioBusca;

    await notificarRastreabilidade(
      opcoes.onMetadata,
      registroBusca
    );

  } catch (erro) {
    registroBusca.status = "ERRO";
    registroBusca.erro = erro.message;
    registroBusca.finalizada_em = new Date().toISOString();
    registroBusca.duracao_ms = Date.now() - inicioBusca;

    await notificarRastreabilidade(
      opcoes.onMetadata,
      registroBusca
    );

    throw erro;
  }

  const coletadoEm = new Date().toISOString();
  const resultadosBusca = dadosBusca.results;

  // Seleciona até três URLs com maior relevância para extração.

  const selecionadosParaExtracao = [...resultadosBusca]
    .filter(resultado =>
      typeof resultado.url === "string" &&
      resultado.url.startsWith("http")
    )
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, MAX_FONTES_EXTRAIDAS);

  const urlsSelecionadas = selecionadosParaExtracao.map(
    resultado => resultado.url
  );

  // Extrai o conteúdo das fontes selecionadas.

  const dadosExtracao = await extrairConteudo(
    urlsSelecionadas,
    pergunta,
    opcoes
  );

  const extracoesPorUrl = new Map(
    dadosExtracao.resultados.map(resultado => [
      resultado.url,
      resultado
    ])
  );

  // Combina busca e extração sem alterar o conteúdo original.

  const evidencias = resultadosBusca.map(resultado => {
    const extracao = extracoesPorUrl.get(resultado.url);

    const conteudoExtraido =
      typeof extracao?.raw_content === "string" &&
      extracao.raw_content.trim() !== ""
        ? extracao.raw_content
        : null;

    const extracaoConcluida = Boolean(conteudoExtraido);

    const conteudoOriginal =
      conteudoExtraido ?? resultado.content;

    const normalizacao = normalizarFonte(conteudoOriginal);

    const dataPublicacaoOriginal =
      resultado.published_date ?? null;

    const dataPublicacao = normalizarDataPublicacao(
      dataPublicacaoOriginal
    );

    return {
      tipo_fonte: extracaoConcluida
        ? "tavily_extract"
        : "tavily_search",

      titulo: resultado.title,
      url: resultado.url,

      conteudo: conteudoOriginal,

      normalizacao,

      coletado_em: coletadoEm,

      data_publicacao: dataPublicacao,
      data_atualizacao: null,

      relevancia: resultado.score ?? null,

      metadados_provedor: {
        provedor: "tavily",

        request_id: dadosBusca.request_id ?? null,
        resultado_id: resultado.id ?? null,

        response_time_busca: dadosBusca.response_time ?? null,
        response_time_extracao: dadosExtracao.response_time ?? null,

        consulta: dadosBusca.query ?? pergunta,

        raw_content_busca: resultado.raw_content ?? null,

        data_publicacao_original: dataPublicacaoOriginal,

        extracao: {
          tentada: urlsSelecionadas.includes(resultado.url),
          concluida: extracaoConcluida,
          request_id: dadosExtracao.request_id ?? null,
          erro: dadosExtracao.erro
        }
      }
    };
  });

  // Valida as evidências retornadas.

  const evidenciasValidas = [];

  for (const evidencia of evidencias) {
    const validacao = validarEvidencia(evidencia);

    if (!validacao.valida) {
      throw new Error(
        `Evidência inválida retornada pela Tavily: ${validacao.erros.join("; ")}`
      );
    }

    evidenciasValidas.push(evidencia);
  }

  return evidenciasValidas;
}

module.exports = { pesquisarComTavily };
