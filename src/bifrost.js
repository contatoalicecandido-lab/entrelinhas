
const { randomUUID } = require("node:crypto");
const { AsyncLocalStorage } = require("node:async_hooks");

// Cadeia de modelos servida pelo Bifrost. O principal responde normalmente;
// se ele falhar (erro, limite de uso do provedor, modelo indisponível), o
// próprio Bifrost tenta os reservas em ordem, sem lógica de retentativa aqui.
// Configurável por BIFROST_MODEL e BIFROST_FALLBACKS ("none" desliga).
const MODELO_PADRAO = "groq/openai/gpt-oss-20b";
const RESERVAS_PADRAO = ["groq/openai/gpt-oss-120b", "groq/llama-3.3-70b-versatile"];
// Modelo propositalmente inexistente, usado só na demonstração de failover.
const MODELO_QUEDA_SIMULADA = "groq/entrelinhas-simulated-outage";

function configuracaoModelos() {
  const principal = (process.env.BIFROST_MODEL ?? "").trim() || MODELO_PADRAO;
  const bruto = (process.env.BIFROST_FALLBACKS ?? "").trim();
  const reservas = bruto.toLowerCase() === "none"
    ? []
    : bruto
      ? bruto.split(",").map(m => m.trim()).filter(Boolean)
      : RESERVAS_PADRAO;
  return { principal, reservas: reservas.filter(m => m !== principal) };
}

// Contexto por verificação (ex.: demonstração de queda do modelo principal),
// propagado para todas as chamadas ao modelo sem alterar cada assinatura.
const contextoGateway = new AsyncLocalStorage();
function executarComContextoGateway(contexto, funcao) {
  return contextoGateway.run({ ...contexto }, funcao);
}

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
    modelo_solicitado: null,
    cadeia_modelos: [],
    queda_simulada: false,
    foi_fallback: null,
    servido_por: null,
    latencia_total_s: null,
    tokens: null,
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

    const { principal, reservas } = configuracaoModelos();
    const quedaSimulada = contextoGateway.getStore()?.simularQuedaPrincipal === true && reservas.length > 0;
    const modeloPedido = quedaSimulada ? MODELO_QUEDA_SIMULADA : principal;
    // Na simulação, o modelo principal real vira o primeiro reserva.
    const reservasDoPedido = quedaSimulada ? [principal, ...reservas] : reservas;
    rastreabilidade.modelo_solicitado = modeloPedido;
    rastreabilidade.cadeia_modelos = [modeloPedido, ...reservasDoPedido];
    rastreabilidade.queda_simulada = quedaSimulada;
    headers["x-bf-dim-app"] = "entrelinhas";
    headers["x-bf-dim-stage"] = rastreabilidade.etapa;

    let resposta;

    try {
      resposta = await fetch(
        "http://localhost:8080/v1/chat/completions",
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: modeloPedido,
            messages,
            stream: false,
            ...(reservasDoPedido.length ? { fallbacks: reservasDoPedido } : {})
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

    // O Bifrost informa no corpo quem de fato respondeu e se foi um reserva.
    const roteamento = dados?.extra_fields?.routing_info ?? null;
    const provedorFinal = roteamento?.provider ?? dados?.extra_fields?.provider ?? rastreabilidade.provedor ?? null;
    const modeloFinal = roteamento?.model ?? dados?.model ?? rastreabilidade.modelo_resolvido ?? null;
    rastreabilidade.provedor = rastreabilidade.provedor ?? provedorFinal;
    rastreabilidade.modelo_resolvido = rastreabilidade.modelo_resolvido ?? modeloFinal;
    rastreabilidade.servido_por = provedorFinal || modeloFinal ? { provedor: provedorFinal, modelo: modeloFinal } : null;
    rastreabilidade.foi_fallback = determinarFallback({
      roteamento,
      indice: rastreabilidade.indice_fallback,
      modeloPedido,
      provedorFinal,
      modeloFinal
    });
    const latenciaTotal = Number(dados?.extra_fields?.latency);
    rastreabilidade.latencia_total_s = Number.isFinite(latenciaTotal) ? latenciaTotal : null;
    if (dados?.usage && typeof dados.usage === "object") {
      rastreabilidade.tokens = {
        entrada: dados.usage.prompt_tokens ?? null,
        saida: dados.usage.completion_tokens ?? null,
        total: dados.usage.total_tokens ?? null
      };
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

// Foi um modelo reserva? Usa, nesta ordem: routing_info.is_fallback, o
// índice de fallback no cabeçalho e, por último, a comparação do modelo
// pedido com o que respondeu. Sem nenhum sinal, devolve null (desconhecido).
function determinarFallback({ roteamento, indice, modeloPedido, provedorFinal, modeloFinal }) {
  if (typeof roteamento?.is_fallback === "boolean") return roteamento.is_fallback;
  if (indice !== null && indice !== undefined && indice !== "") {
    const n = Number(indice);
    if (Number.isFinite(n)) return n > 0;
  }
  if (modeloFinal) {
    const pedido = String(modeloPedido);
    const final = String(modeloFinal);
    const completo = provedorFinal && !final.startsWith(`${provedorFinal}/`) ? `${provedorFinal}/${final}` : final;
    return !(completo === pedido || pedido.endsWith(`/${final}`));
  }
  return null;
}

const perguntarAoGemini = perguntarAoModelo;

module.exports = {
  perguntarAoModelo,
  perguntarAoGemini,
  configuracaoModelos,
  determinarFallback,
  executarComContextoGateway,
  MODELO_QUEDA_SIMULADA
};
