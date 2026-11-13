
const assert = require("node:assert/strict");

process.env.BIFROST_KEY = "chave-ficticia-para-teste";

const { perguntarAoModelo } = require("../src/bifrost");

async function executarTeste() {
  const fetchOriginal = global.fetch;

  const metadadosEsperados = {
    id_bifrost: "bifrost-teste-001",
    id_trace: "trace-teste-001",
    provedor: "groq",
    modelo_resolvido: "openai/gpt-oss-20b",
    modelo_original: "openai/gpt-oss-20b",
    indice_fallback: "0",
    latencia_upstream_ms: "120"
  };

  let requisicaoInterceptada = false;
  let metadadosRecebidos = null;

  try {
    global.fetch = async (url, configuracao) => {
      requisicaoInterceptada = true;

      assert.equal(
        url,
        "http://localhost:8080/v1/chat/completions"
      );

      const headers = configuracao.headers;

      assert.equal(headers["x-bf-vk"], "chave-ficticia-para-teste");
      assert.ok(headers["x-request-id"]);
      assert.ok(headers["x-bf-lh-call-id"]);
      assert.equal(
        headers["x-bf-lh-verification-id"],
        "verificacao-teste-001"
      );
      assert.equal(
        headers["x-bf-lh-etapa"],
        "CLASSIFICACAO"
      );
      assert.equal(
        headers["x-bf-lh-afirmacao-id"],
        "afirmacao_1"
      );
      assert.equal(
        headers["x-bf-lh-evidencia-url"],
        "https://nodejs.org/"
      );
      assert.equal(headers["x-bf-lh-tentativa"], "2");

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "Resposta sintética do modelo."
              }
            }
          ]
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "x-bifrost-request-id": metadadosEsperados.id_bifrost,
            "x-bifrost-trace-id": metadadosEsperados.id_trace,
            "x-bifrost-provider": metadadosEsperados.provedor,
            "x-bifrost-resolved-model": metadadosEsperados.modelo_resolvido,
            "x-bifrost-original-model": metadadosEsperados.modelo_original,
            "x-bifrost-fallback-index": metadadosEsperados.indice_fallback,
            "x-bifrost-upstream-latency-ms": metadadosEsperados.latencia_upstream_ms
          }
        }
      );
    };

    console.log("1. Executando chamada simulada...");

    const resposta = await perguntarAoModelo(
      "Pergunta sintética para teste.",
      "Instruções sintéticas para teste.",
      {
        idVerificacao: "verificacao-teste-001",
        etapa: "CLASSIFICACAO",
        idAfirmacao: "afirmacao_1",
        urlEvidencia: "https://nodejs.org/",
        tentativa: 2,
        onMetadata: (dados) => {
          metadadosRecebidos = dados;
        }
      }
    );

    console.log("2. Conferindo resposta...");

    assert.equal(
      resposta,
      "Resposta sintética do modelo."
    );

    assert.equal(requisicaoInterceptada, true);
    assert.ok(metadadosRecebidos);

    console.log("3. Conferindo rastreabilidade...");

    assert.equal(
      metadadosRecebidos.id_verificacao,
      "verificacao-teste-001"
    );

    assert.equal(
      metadadosRecebidos.etapa,
      "CLASSIFICACAO"
    );

    assert.equal(
      metadadosRecebidos.id_afirmacao,
      "afirmacao_1"
    );

    assert.equal(
      metadadosRecebidos.tentativa,
      2
    );

    assert.equal(
      metadadosRecebidos.id_bifrost,
      metadadosEsperados.id_bifrost
    );

    assert.equal(
      metadadosRecebidos.id_trace,
      metadadosEsperados.id_trace
    );

    assert.equal(
      metadadosRecebidos.provedor,
      metadadosEsperados.provedor
    );

    assert.equal(
      metadadosRecebidos.modelo_resolvido,
      metadadosEsperados.modelo_resolvido
    );

    assert.equal(
      metadadosRecebidos.latencia_upstream_ms,
      120
    );

    assert.equal(
      metadadosRecebidos.status_http,
      200
    );

    assert.equal(
      metadadosRecebidos.status,
      "SUCESSO"
    );

    assert.ok(metadadosRecebidos.id_chamada);
    assert.ok(metadadosRecebidos.id_requisicao_enviada);
    assert.ok(metadadosRecebidos.registrada_em);

    console.log("4. Conferindo resultado...");
    console.log("Resposta:", resposta);
    console.log("ID Bifrost:", metadadosRecebidos.id_bifrost);
    console.log("ID Trace:", metadadosRecebidos.id_trace);
    console.log("Etapa:", metadadosRecebidos.etapa);
    console.log("Tentativa:", metadadosRecebidos.tentativa);
    console.log("Status:", metadadosRecebidos.status);

    console.log("\nTESTE DE RASTREABILIDADE BIFROST APROVADO!");

  } finally {
    global.fetch = fetchOriginal;
  }
}

executarTeste().catch((erro) => {
  console.error("\nTESTE FALHOU:", erro.message);
  process.exitCode = 1;
});
