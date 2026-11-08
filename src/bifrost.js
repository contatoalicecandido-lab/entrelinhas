
const { randomUUID } = require("node:crypto");

async function notificarRastreabilidade(callback, dados) {
  if (typeof callback !== "function") {
    return;
  }

  try {
    await callback(dados);
  } catch (erro) {
    console.warn(
      "Não foi possível registrar a rastreabilidade do Bifrost:",
      erro.message
    );
  }
}

async function perguntarAoModelo(
  pergunta,
  instrucoesSistema = null,
  opcoes = {}
) {
  if (typeof pergunta !== "string" || pergunta.trim() === "") {
    throw new Error("A pergunta não pode estar vazia.");
  }

  if (
    instrucoesSistema !== null &&
    (typeof instrucoesSistema !== "string" ||
      instrucoesSistema.trim() === "")
  ) {
    throw new Error("As instruções do sistema são inválidas.");
  }

  if (
    !opcoes ||
    typeof opcoes !== "object" ||
    Array.isArray(opcoes)
  ) {
    throw new Error("As opções de rastreabilidade são inválidas.");
  }

  if (!process.env.BIFROST_KEY) {
    throw new Error("A chave de acesso do Bifrost não foi configurada.");
  }

  const idChamada = randomUUID();
  const idRequisicao = randomUUID();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);

  const rastreabilidade = {
    id_chamada: idChamada,
    id_requisicao_enviada: idRequisicao,
    id_verificacao: opcoes.idVerificacao ?? null,
    etapa: opcoes.etapa ?? "NAO_INFORMADA",
    id_afirmacao: opcoes.idAfirmacao ?? null,
    url_evidencia: opcoes.urlEvidencia ?? null,
    tentativa: opcoes.tentativa ?? 1,
    provedor: null,
    modelo_solicitado: "groq/openai/gpt-oss-20b",
    modelo_resolvido: null,
    modelo_original: null,
    id_bifrost: null,
    id_trace: null,
    indice_fallback: null,
    latencia_upstream_ms: null,
    status_http: null,
    status: "INICIADA",
    registrada_em: new Date().toISOString()
  };

  let notificacaoRealizada = false;

  async function registrar(status) {
    if (notificacaoRealizada) {
      return;
    }

    notificacaoRealizada = true;
    rastreabilidade.status = status;

    await notificarRastreabilidade(
      opcoes.onMetadata,
      { ...rastreabilidade }
    );
  }

  try {
    const messages = [];

    if (instrucoesSistema) {
      messages.push({
        role: "system",
        content: instrucoesSistema
      });
    }

    messages.push({
      role: "user",
      content: pergunta
    });

    const headers = {
      "Content-Type": "application/json",
      "x-bf-vk": process.env.BIFROST_KEY,
      "x-request-id": idRequisicao,
      "x-bf-lh-call-id": idChamada,
      "x-bf-lh-etapa": rastreabilidade.etapa
    };

    if (opcoes.idVerificacao) {
      headers["x-bf-lh-verification-id"] =
        String(opcoes.idVerificacao);
    }

    if (opcoes.idAfirmacao) {
      headers["x-bf-lh-afirmacao-id"] =
        String(opcoes.idAfirmacao);
    }

    if (opcoes.urlEvidencia) {
      headers["x-bf-lh-evidencia-url"] =
        String(opcoes.urlEvidencia);
    }

    headers["x-bf-lh-tentativa"] =
      String(rastreabilidade.tentativa);

    let resposta;

    try {
      resposta = await fetch(
        "http://localhost:8080/v1/chat/completions",
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: "groq/openai/gpt-oss-20b",
            messages,
            stream: false
          }),
          signal: controller.signal
        }
      );
    } catch (erro) {
      rastreabilidade.erro = erro.message;
      await registrar(
        erro.name === "AbortError"
          ? "TIMEOUT"
          : "ERRO_TRANSPORTE"
      );
      throw erro;
    }

    rastreabilidade.status_http = resposta.status;

    rastreabilidade.id_bifrost =
      resposta.headers.get("x-bifrost-request-id");

    rastreabilidade.id_trace =
      resposta.headers.get("x-bifrost-trace-id");

    rastreabilidade.provedor =
      resposta.headers.get("x-bifrost-provider");

    rastreabilidade.modelo_resolvido =
      resposta.headers.get("x-bifrost-resolved-model");

    rastreabilidade.modelo_original =
      resposta.headers.get("x-bifrost-original-model");

    rastreabilidade.indice_fallback =
      resposta.headers.get("x-bifrost-fallback-index");

    const latencia = resposta.headers.get(
      "x-bifrost-upstream-latency-ms"
    );

    rastreabilidade.latencia_upstream_ms =
      latencia !== null ? Number(latencia) : null;

    const corpo = await resposta.text();

    let dados;

    try {
      dados = JSON.parse(corpo);
    } catch {
      dados = null;
    }

    if (!resposta.ok) {
      rastreabilidade.erro =
        dados
          ? JSON.stringify(dados)
          : corpo.slice(0, 1000);

      await registrar("ERRO_HTTP");

      throw new Error(
        `Erro Bifrost (${resposta.status}): ${
          dados ? JSON.stringify(dados) : corpo
        }`
      );
    }

    const conteudo = dados?.choices?.[0]?.message?.content;

    if (
      typeof conteudo !== "string" ||
      conteudo.trim() === ""
    ) {
      rastreabilidade.erro =
        "Resposta vazia ou em formato inesperado.";

      await registrar("RESPOSTA_INVALIDA");

      throw new Error(
        "O Bifrost retornou uma resposta vazia ou em formato inesperado."
      );
    }

    await registrar("SUCESSO");

    return conteudo;

  } catch (erro) {
    if (!notificacaoRealizada) {
      rastreabilidade.erro = erro.message;

      await registrar(
        erro.name === "AbortError"
          ? "TIMEOUT"
          : "ERRO"
      );
    }

    if (erro.name === "AbortError") {
      throw new Error(
        "O modelo demorou mais de 90 segundos para responder."
      );
    }

    throw erro;

  } finally {
    clearTimeout(timeout);
  }
}

const perguntarAoGemini = perguntarAoModelo;

module.exports = {
  perguntarAoModelo,
  perguntarAoGemini
};
